import util from 'util'
import Promise from 'bluebird'
import syrup from '@devicefarmer/stf-syrup'
import WebSocket from 'ws'
import {v4 as uuidv4} from 'uuid'
import EventEmitter from 'eventemitter3'
import split from 'split'
import adbkit from '@irdk/adbkit'
import logger from '../../../../util/logger.js'
import lifecycle from '../../../../util/lifecycle.js'
import * as bannerutil from './util/banner.js'
import FrameParser from './util/frameparser.js'
import FrameConfig from './util/frameconfig.js'
import BroadcastSet from './util/broadcastset.js'
import StateQueue from '../../../../util/statequeue.js'
import RiskyStream from '../../../../util/riskystream.js'
import FailCounter from '../../../../util/failcounter.js'
import wire from '../../../../wire/index.js'
import adb from '../../support/adb.js'
import router from '../../../base-device/support/router.js'
import minicap from '../../resources/minicap.js'
import scrcpy from '../../resources/scrcpy.js'
import display from '../util/display.js'
import options from './options.js'
import group from '../group.js'
import * as jwtutil from '../../../../util/jwtutil.js'
import {NoGroupError} from '../../../../util/grouputil.js'
export default syrup.serial()
    .dependency(adb)
    .dependency(router)
    .dependency(minicap)
    .dependency(scrcpy)
    .dependency(display)
    .dependency(options)
    .dependency(group)
    .define(function(options, adb, router, minicap, scrcpy, display, screenOptions, group) {
        let log = logger.createLogger('device:plugins:screen:stream')
        log.info('ScreenGrabber option set to %s', options.screenGrabber)
        log.info('ScreenFrameRate option set to %d', options.screenFrameRate)
        const scrcpyClient = new scrcpy.Scrcpy()
        function FrameProducer(config, grabber) {
            EventEmitter.call(this)
            this.actionQueue = []
            this.runningState = FrameProducer.STATE_STOPPED
            this.desiredState = new StateQueue()
            this.output = null
            this.socket = null
            this.pid = -1
            this.banner = null
            this.parser = null
            this.frameConfig = config
            this.grabber = options.screenGrabber
            this.readable = false
            this.needsReadable = false
            this.failCounter = new FailCounter(3, 10000)
            this.failCounter.on('exceedLimit', this._failLimitExceeded.bind(this))
            this.failed = false
            this.readableListener = this._readableListener.bind(this)
        }
        util.inherits(FrameProducer, EventEmitter)
        FrameProducer.STATE_STOPPED = 1
        FrameProducer.STATE_STARTING = 2
        FrameProducer.STATE_STARTED = 3
        FrameProducer.STATE_STOPPING = 4
        FrameProducer.prototype._ensureState = function() {
            if (this.desiredState.empty()) {
                return
            }
            if (this.failed) {
                log.warn('Will not apply desired state due to too many failures')
                return
            }
            switch (this.runningState) {
            case FrameProducer.STATE_STARTING:
            case FrameProducer.STATE_STOPPING:
                // Just wait.
                break
            case FrameProducer.STATE_STOPPED:
                if (this.desiredState.next() === FrameProducer.STATE_STARTED) {
                    this.runningState = FrameProducer.STATE_STARTING
                    if (options.needScrcpy) {
                        scrcpyClient.start()
                            .then((function() {
                                this.runningState = FrameProducer.STATE_STARTED
                                this.emit('start')
                            }).bind(this))
                    }
                    else {
                        this._startService().bind(this)
                            .then(function(out) {
                                this.output = new RiskyStream(out)
                                    .on('unexpectedEnd', this._outputEnded.bind(this))
                                return this._readOutput(this.output.stream)
                            })
                            .then(function() {
                                return this._waitForPid()
                            })
                            .then(function() {
                                return this._connectService()
                            })
                            .then(function(socket) {
                                this.parser = new FrameParser()
                                this.socket = new RiskyStream(socket)
                                    .on('unexpectedEnd', this._socketEnded.bind(this))
                                return this._readBanner(this.socket.stream)
                            })
                            .then(function(banner) {
                                this.banner = banner
                                return this._readFrames(this.socket.stream)
                            })
                            .then(function() {
                                this.runningState = FrameProducer.STATE_STARTED
                                this.emit('start')
                            })
                            .catch(Promise.CancellationError, function() {
                                return this._stop()
                            })
                            .catch(function(err) {
                                return this._stop().finally(function() {
                                    this.failCounter.inc()
                                    this.grabber = 'minicap-apk'
                                })
                            })
                            .finally(function() {
                                this._ensureState()
                            })
                    }
                }
                else {
                    setImmediate(this._ensureState.bind(this))
                }
                break
            case FrameProducer.STATE_STARTED:
                if (this.desiredState.next() === FrameProducer.STATE_STOPPED) {
                    this.runningState = FrameProducer.STATE_STOPPING
                    this._stop().finally(function() {
                        this._ensureState()
                    })
                }
                else {
                    setImmediate(this._ensureState.bind(this))
                }
                break
            }
        }
        FrameProducer.prototype.start = function() {
            log.info('Requesting frame producer to start')
            this.desiredState.push(FrameProducer.STATE_STARTED)
            this._ensureState()
        }
        FrameProducer.prototype.stop = function() {
            log.info('Requesting frame producer to stop')
            this.desiredState.push(FrameProducer.STATE_STOPPED)
            this._ensureState()
        }
        FrameProducer.prototype.restart = function() {
            switch (this.runningState) {
            case FrameProducer.STATE_STARTED:
            case FrameProducer.STATE_STARTING:
                this.desiredState.push(FrameProducer.STATE_STOPPED)
                this.desiredState.push(FrameProducer.STATE_STARTED)
                this._ensureState()
                break
            }
        }
        FrameProducer.prototype.updateRotation = function(rotation) {
            if (this.frameConfig.rotation === rotation) {
                log.info('Keeping %d as current frame producer rotation', rotation)
                return
            }
            log.info('Setting frame producer rotation to %d', rotation)
            this.frameConfig.rotation = rotation
            this._configChanged()
        }
        FrameProducer.prototype.changeQuality = function(newQuality) {
            log.info('Setting frame producer quality to %d', newQuality)
            this.frameConfig.quality = newQuality
            this._configChanged()
        }
        FrameProducer.prototype.updateProjection = function(width, height) {
            if (this.frameConfig.virtualWidth === width &&
            this.frameConfig.virtualHeight === height) {
                log.info('Keeping %dx%d as current frame producer projection', width, height)
                return
            }
            log.info('Setting frame producer projection to %dx%d', width, height)
            this.frameConfig.virtualWidth = width
            this.frameConfig.virtualHeight = height
            this._configChanged()
        }
        FrameProducer.prototype.nextFrame = function() {
            var frame = null
            var chunk
            if (this.parser) {
                while ((frame = this.parser.nextFrame()) === null) {
                    chunk = this.socket.stream.read()
                    if (chunk) {
                        this.parser.push(chunk)
                    }
                    else {
                        this.readable = false
                        break
                    }
                }
            }
            return frame
        }
        FrameProducer.prototype.needFrame = function() {
            this.needsReadable = true
            this._maybeEmitReadable()
        }
        FrameProducer.prototype._configChanged = function() {
            this.restart()
        }
        FrameProducer.prototype._socketEnded = function() {
            log.warn('Connection to minicap ended unexpectedly')
            this.failCounter.inc()
            this.restart()
        }
        FrameProducer.prototype._outputEnded = function() {
            log.warn('Shell keeping minicap running ended unexpectedly')
            this.failCounter.inc()
            this.restart()
        }
        FrameProducer.prototype._failLimitExceeded = function(limit, time) {
            this._stop()
            this.failed = true
            this.emit('error', new Error(util.format('Failed more than %d times in %dms', limit, time)))
        }
        FrameProducer.prototype._startService = function() {
            log.info('Launching screen service %s', this.grabber)
            if (options.screenFrameRate <= 0.0) {
                return minicap.run(this.grabber, util.format('-S -Q %d -P %s', this.frameConfig.quality, this.frameConfig.toString()))
                    .timeout(10000)
            }
            else {
                return minicap.run(this.grabber, util.format('-S -r %d -Q %d -P %s', options.screenFrameRate, this.frameConfig.quality, this.frameConfig.toString()))
                    .timeout(10000)
            }
        }
        FrameProducer.prototype._readOutput = function(out) {
            out.pipe(split()).on('data', function(line) {
                var trimmed = line.toString().trim()
                if (trimmed === '') {
                    return
                }
                if (/ERROR/.test(line)) {
                    log.fatal('minicap error: "%s"', line)
                    return lifecycle.fatal()
                }
                var match = /^PID: (\d+)$/.exec(line)
                if (match) {
                    this.pid = Number(match[1])
                    this.emit('pid', this.pid)
                }
                log.info('minicap says: "%s"', line)
            }.bind(this))
        }
        FrameProducer.prototype._waitForPid = function() {
            if (this.pid > 0) {
                return Promise.resolve(this.pid)
            }
            var pidListener
            return new Promise(function(resolve) {
                this.on('pid', pidListener = resolve)
            }.bind(this)).bind(this)
                .timeout(5000)
                .finally(function() {
                    this.removeListener('pid', pidListener)
                })
        }
        FrameProducer.prototype._connectService = function() {
            function tryConnect(times, delay) {
                return adb.getDevice(options.serial).openLocal('localabstract:minicap')
                    .then(function(out) {
                        return out
                    })
                    .catch(function(err) {
                        if (/closed/.test(err.message) && times > 1) {
                            return Promise.delay(delay)
                                .then(function() {
                                    log.info('Retrying connect to minicap service')
                                    return tryConnect(times - 1, delay + 100) // non exp, if need exponential use - delay * 2
                                })
                        }
                        return Promise.reject(err)
                    })
            }
            log.info('Connecting to minicap service')
            return tryConnect(10, 100)
        }
        FrameProducer.prototype._stop = function() {
            return this._disconnectService(this.socket).bind(this)
                .timeout(2000)
                .then(function() {
                    return this._stopService(this.output).timeout(10000)
                })
                .then(function() {
                    this.runningState = FrameProducer.STATE_STOPPED
                    this.emit('stop')
                })
                .catch(function(err) {
                    // In practice we _should_ never get here due to _stopService()
                    // being quite aggressive. But if we do, well... assume it
                    // stopped anyway for now.
                    this.runningState = FrameProducer.STATE_STOPPED
                    this.emit('error', err)
                    this.emit('stop')
                })
                .finally(function() {
                    this.output = null
                    this.socket = null
                    this.pid = -1
                    this.banner = null
                    this.parser = null
                })
        }
        FrameProducer.prototype._disconnectService = function(socket) {
            log.info('Disconnecting from minicap service')
            if (!socket || socket.ended) {
                return Promise.resolve(true)
            }
            socket.stream.removeListener('readable', this.readableListener)
            var endListener
            return new Promise(function(resolve) {
                socket.on('end', endListener = function() {
                    resolve(true)
                })
                socket.stream.resume()
                socket.end()
            })
                .finally(function() {
                    socket.removeListener('end', endListener)
                })
        }
        FrameProducer.prototype._stopService = function(output) {
            log.info('Stopping minicap service')
            if (!output || output.ended) {
                return Promise.resolve(true)
            }
            var pid = this.pid
            function kill(signal) {
                if (pid <= 0) {
                    return Promise.reject(new Error('Minicap service pid is unknown'))
                }
                var signum = {
                    SIGTERM: -15
                    , SIGKILL: -9
                }[signal]
                log.info('Sending %s to minicap', signal)
                return Promise.all([
                    output.waitForEnd()
                    , adb.getDevice(options.serial).shell(['kill', signum, pid])
                        .then(adbkit.Adb.util.readAll)
                ])
                    .timeout(2000)
            }
            function kindKill() {
                return kill('SIGTERM')
            }
            function forceKill() {
                return kill('SIGKILL')
            }
            function forceEnd() {
                log.info('Ending minicap I/O as a last resort')
                output.end()
                return Promise.resolve(true)
            }
            return kindKill()
                .catch(Promise.TimeoutError, forceKill)
                .catch(forceEnd)
        }
        FrameProducer.prototype._readBanner = function(socket) {
            log.info('Reading minicap banner')
            return bannerutil.read(socket).timeout(2000)
        }
        FrameProducer.prototype._readFrames = function(socket) {
            this.needsReadable = true
            socket.on('readable', this.readableListener)
            // We may already have data pending. Let the user know they should
            // at least attempt to read frames now.
            this.readableListener()
        }
        FrameProducer.prototype._maybeEmitReadable = function() {
            if (this.readable && this.needsReadable) {
                this.needsReadable = false
                this.emit('readable')
            }
        }
        FrameProducer.prototype._readableListener = function() {
            this.readable = true
            this._maybeEmitReadable()
        }
        function createServer() {
            log.info('Starting WebSocket server on port %d', screenOptions.publicPort)
            var wss = new WebSocket.Server({
                port: screenOptions.publicPort
                , perMessageDeflate: false
            })
            var listeningListener, errorListener
            return new Promise(function(resolve, reject) {
                listeningListener = function() {
                    return resolve(wss)
                }
                errorListener = function(err) {
                    return reject(err)
                }
                wss.on('listening', listeningListener)
                wss.on('error', errorListener)
            })
                .finally(function() {
                    wss.removeListener('listening', listeningListener)
                    wss.removeListener('error', errorListener)
                })
        }
        return createServer()
            .then(function(wss) {
                log.info('creating FrameProducer: %s', options.screenGrabber)
                var frameProducer = new FrameProducer(new FrameConfig(display.properties, display.properties, options.screenJpegQuality))
                var broadcastSet = frameProducer.broadcastSet = new BroadcastSet()
                broadcastSet.on('nonempty', function() {
                    frameProducer.start()
                })
                broadcastSet.on('empty', function() {
                    frameProducer.stop()
                })
                broadcastSet.on('insert', function(id) {
                    // If two clients join a session in the middle, one of them
                    // may not release the initial size because the projection
                    // doesn't necessarily change, and the producer doesn't Getting
                    // restarted. Therefore we have to call onStart() manually
                    // if the producer is already up and running.
                    switch (frameProducer.runningState) {
                    case FrameProducer.STATE_STARTED:
                        broadcastSet.get(id).onStart(frameProducer)
                        break
                    }
                })
                display.on('rotationChange', function(newRotation) {
                    frameProducer.updateRotation(newRotation)
                })
                router.on(wire.ChangeQualityMessage, function(channel, message) {
                    frameProducer.changeQuality(message.quality)
                })
                frameProducer.on('start', function() {
                    broadcastSet.keys().map(function(id) {
                        return broadcastSet.get(id).onStart(frameProducer)
                    })
                })
                frameProducer.on('readable', function next() {
                    var frame = frameProducer.nextFrame()
                    if (frame) {
                        Promise.settle([broadcastSet.keys().map(function(id) {
                            return broadcastSet.get(id).onFrame(frame)
                        })]).then(next)
                    }
                    else {
                        frameProducer.needFrame()
                    }
                })
                frameProducer.on('error', function(err) {
                    log.fatal('Frame producer had an error', err.stack)
                    lifecycle.fatal()
                })
                wss.on('connection', async function(ws, req) {
                    let id = uuidv4()
                    let pingTimer

                    // Extract token from WebSocket subprotocols
                    const token = ws.protocol.substring('access_token.'.length)
                    const user = !!token && jwtutil.decode(token, options.secret)

                    if (!token || !user) {
                        log.warn('WebSocket connection attempt without token from %s', req.socket.remoteAddress)
                        ws.send(JSON.stringify({
                            type: 'auth_error'
                            , message: 'Authentication token required'
                        }))
                        ws.close(1008, 'Authentication token required')
                        return
                    }

                    const tryCheckDeviceGroup = async(fail = false) => {
                        try {
                            await new Promise(r => setTimeout(r, 200))

                            const deviceGroup = await group.get()
                            if (deviceGroup.email !== user?.email) {
                                const err = 'Device used by another user'
                                log.warn('WebSocket authentication failed for device %s: $s', options.serial, err)
                                ws.send(JSON.stringify({
                                    type: 'auth_error'
                                    , message: err
                                }))
                                ws.close(1008, 'Authentication failed')
                                return
                            }

                            log.info('WebSocket authenticated for device %s', options.serial)

                            // Send success message
                            ws.send(JSON.stringify({
                                type: 'auth_success'
                                , message: 'Authentication successful'
                            }))

                            // Sending a ping message every now and then makes sure that
                            // reverse proxies like nginx don't time out the connection [1].
                            //
                            // [1] http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout
                            pingTimer = setInterval(wsPingNotifier, 10 * 60000) // options.screenPingInterval
                        }
                        catch (/** @type {any} */err) {
                            if (!fail && err instanceof NoGroupError) {
                                await new Promise(r => setTimeout(r, 1000))
                                return tryCheckDeviceGroup(true)
                            }

                            log.error('WebSocket authentication error for device %s: %s', options.serial, err.message)
                            ws.send(JSON.stringify({
                                type: 'auth_error'
                                , message: 'Authentication error'
                            }), () => {})
                            ws.close(1008, 'Authentication error')
                        }
                    }

                    await tryCheckDeviceGroup()

                    function send(message, options) {
                        return new Promise(function(resolve, reject) {
                            switch (ws.readyState) {
                            case WebSocket.OPENING:
                            // This should never happen.
                                log.warn('Unable to send to OPENING client "%s"', id)
                                break
                            case WebSocket.OPEN:
                            // This is what SHOULD happen.
                                ws.send(message, options, function(err) {
                                    return err ? reject(err) : resolve()
                                })
                                break
                            case WebSocket.CLOSING:
                            // Ok, a 'close' event should remove the client from the set
                            // soon.
                                break
                            case WebSocket.CLOSED:
                            // This should never happen.
                                log.warn('Unable to send to CLOSED client "%s"', id)
                                clearInterval(pingTimer)
                                broadcastSet.remove(id)
                                break
                            }
                        })
                    }
                    function wsStartNotifier() {
                        return send(util.format('start %s', JSON.stringify(frameProducer.banner)))
                    }
                    function wsPingNotifier() {
                        return send('ping')
                    }
                    function wsFrameNotifier(frame) {
                        return send(frame, {
                            binary: true
                        })
                    }
                    ws.on('message', function(data) {
                        var match = /^(on|off|(size) ([0-9]+)x([0-9]+))$/.exec(data)
                        if (match) {
                            switch (match[2] || match[1]) {
                            case 'on':
                                broadcastSet.insert(id, {
                                    onStart: wsStartNotifier
                                    , onFrame: wsFrameNotifier
                                })
                                break
                            case 'off':
                                broadcastSet.remove(id)
                                // Keep pinging even when the screen is off.
                                break
                            case 'size':
                                frameProducer.updateProjection(Number(match[3]), Number(match[4]))
                                break
                            }
                        }
                    })
                    ws.on('close', function() {
                        if (pingTimer) {
                            clearInterval(pingTimer)
                        }
                        broadcastSet.remove(id)
                        log.info('WebSocket closed for device %s', options.serial)
                    })
                    if (options.needScrcpy) {
                        log.info(`Scrcpy client has gotten for device s/n ${options.serial}`)
                        scrcpyClient.on('rawData', (data) => {
                            console.log(`Data: ${data}`)
                            send(data, {binary: true})
                        })
                    }
                    ws.on('error', function(e) {
                        if (pingTimer) {
                            clearInterval(pingTimer)
                        }
                        broadcastSet.remove(id)
                        log.error('WebSocket error for device %s: %s', options.serial, e.message)
                    })
                })
                lifecycle.observe(function() {
                    wss.close()
                })
                lifecycle.observe(function() {
                    frameProducer.stop()
                })
                return frameProducer
            })
    })
