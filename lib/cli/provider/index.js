import os from 'os'
import ip from 'my-local-ip'
import path from 'path'
import provider from '../../units/provider/index.js'
import {fork} from 'child_process'
export const command = 'provider [serial..]'
export const describe = 'Start a provider unit.'
export const builder = function(yargs) {
    return yargs
        .strict()
        .env('STF_PROVIDER')
        .option('adb-host', {
            describe: 'The ADB server host.'
            , type: 'string'
            , default: '127.0.0.1'
        })
        .option('adb-port', {
            describe: 'The ADB server port.'
            , type: 'number'
            , default: 5037
        })
        .option('allow-remote', {
            alias: 'R'
            , describe: 'Whether to allow remote devices in STF. Highly ' +
            'unrecommended due to almost unbelievable slowness on the ADB side ' +
            'and duplicate device issues when used locally while having a ' +
            'cable connected at the same time.'
            , type: 'boolean'
        })
        .option('boot-complete-timeout', {
            describe: 'How long to wait for boot to complete during device setup.'
            , type: 'number'
            , default: 60000
        })
        .option('cleanup', {
            describe: 'Attempt to reset the device between uses by uninstalling' +
            'apps, resetting accounts and clearing caches. Does not do a perfect ' +
            'job currently. Negate with --no-cleanup.'
            , type: 'boolean'
            , default: true
        })
        .option('cleanup-disable-bluetooth', {
            describe: 'Whether to disable Bluetooth during cleanup.'
            , type: 'boolean'
            , default: false
        })
        .option('cleanup-bluetooth-bonds', {
            describe: 'Whether to remove Bluetooth bonds during cleanup.'
            , type: 'boolean'
            , default: false
        })
        .option('connect-push', {
            alias: 'p'
            , describe: 'Device-side ZeroMQ PULL endpoint to connect to.'
            , array: true
            , demand: true
        })
        .option('connect-sub', {
            alias: 's'
            , describe: 'Device-side ZeroMQ PUB endpoint to connect to.'
            , array: true
            , demand: true
        })
        .option('connect-url-pattern', {
            describe: 'The URL pattern to use for `adb connect`.'
            , type: 'string'
            , default: '${publicIp}:${publicPort}'
        })
        .option('group-timeout', {
            alias: 't'
            , describe: 'Timeout in seconds for automatic release of inactive devices.'
            , type: 'number'
            , default: 900
        })
        .option('heartbeat-interval', {
            describe: 'Send interval in milliseconds for heartbeat messages.'
            , type: 'number'
            , default: 10000
        })
        .option('lock-rotation', {
            describe: 'Whether to lock rotation when devices are being used. ' +
            'Otherwise changing device orientation may not always work due to ' +
            'sensitive sensors quickly or immediately reverting it back to the ' +
            'physical orientation.'
            , type: 'boolean'
        })
        .option('max-port', {
            describe: 'Highest port number for device workers to use.'
            , type: 'number'
            , default: 7700
        })
        .option('min-port', {
            describe: 'Lowest port number for device workers to use.'
            , type: 'number'
            , default: 7400
        })
        .option('mute-master', {
            describe: 'Whether to mute master volume.'
            , choices: ['always', 'inuse', 'never']
            , default: 'never'
            , coerce: val => {
                if (val === true) {
                    return 'inuse' // For backwards compatibility.
                }
                if (val === false) {
                    return 'never' // For backwards compatibility.
                }
                return val
            }
        })
        .option('name', {
            alias: 'n'
            , describe: 'An easily identifiable name for the UI and/or log output.'
            , type: 'string'
            , default: os.hostname()
        })
        .option('public-ip', {
            describe: 'The IP or hostname to use in URLs.'
            , type: 'string'
            , default: ip()
        })
        .option('screen-frame-rate', {
            describe: 'The frame rate (frames/s) to be used for screen transport on the network. ' +
            'Float value must be > 0.0 otherwise the default behavior is kept'
            , type: 'number'
            , default: process.env.SCREEN_FRAME_RATE || 20
        })
        .option('screen-jpeg-quality', {
            describe: 'The JPG quality to use for the screen.'
            , type: 'number'
            , default: process.env.SCREEN_JPEG_QUALITY || 80
        })
        .option('screen-grabber', {
            describe: 'The tool to be used for screen capture. ' +
            'Value must be either: minicap-bin (default) or minicap-apk'
            , type: 'string'
            , default: process.env.SCREEN_GRABBER || 'minicap-bin'
        })
        .option('screen-ping-interval', {
            describe: 'The interval at which to send ping messages to keep the ' +
            'screen WebSocket alive.'
            , type: 'number'
            , default: 30000
        })
        .option('screen-reset', {
            describe: 'Go back to home screen and reset screen rotation ' +
            'when user releases device. Negate with --no-screen-reset.'
            , type: 'boolean'
            , default: true
        })
        .option('screen-ws-url-pattern', {
            describe: 'The URL pattern to use for the screen WebSocket.'
            , type: 'string'
            , default: 'ws://${publicIp}:${publicPort}' // using ws because we can't use wss on localhost
        })
        .option('storage-url', {
            alias: 'r'
            , describe: 'The URL to the storage unit.'
            , type: 'string'
            , demand: true
        })
        .option('vnc-initial-size', {
            describe: 'The initial size to use for the experimental VNC server.'
            , type: 'string'
            , default: '600x800'
            , coerce: function(val) {
                return val.split('x').map(Number)
            }
        })
        .option('need-scrcpy', {
            describe: 'Need using Scrcpy instead Minicap for screenshots.'
            , type: 'boolean'
            , default: false
        })
        .option('vnc-port', {
            describe: 'Port allocated to VNC connections.'
            , type: 'number'
            , demand: true
            , default: 5900
        })
        .option('device-name', {
            describe: 'Device name'
            , type: 'string'
            , default: false
        })
        .option('device-type', {
            describe: 'Device type'
            , type: 'string'
            , default: 'Android'
        })
        .option('host', {
            describe: 'Provider hostname.'
            , type: 'string'
            , demand: true
            , default: '127.0.0.1'
        })
        .option('url-without-adb-port', {
            describe: 'If there isnt adbPort in DB use baseUrl.'
            , type: 'boolean'
            , default: true
        })
        .option('device-code', {
            describe: 'device pin or graph code needed for device unlock'
            , type: 'string'
            , default: '0000'
        })
        .option('secret', {
            describe: 'The secret to use for auth JSON Web Tokens. Anyone who ' +
                'knows this token can freely enter the system if they want, so keep ' +
                'it safe.'
            , type: 'string'
            , default: process.env.SECRET || 'kute kittykat'
            , demand: true
        })
        .epilog('Each option can be be overwritten with an environment variable ' +
        'by converting the option to uppercase, replacing dashes with ' +
        'underscores and prefixing it with `STF_PROVIDER_` (e.g. ' +
        '`STF_PROVIDER_NAME`).')
}
export const handler = function(argv) {
    var cli = path.resolve(import.meta.dirname, '..')
    function range(from, to) {
        var items = []
        for (var i = from; i <= to; ++i) {
            items.push(i)
        }
        return items
    }
    return provider({
        name: argv.name
        , killTimeout: 30000
        , ports: range(argv.minPort, argv.maxPort)
        , filter: function(device) {
            return argv.serial === undefined || argv.serial.length === 0 || argv.serial.indexOf(device.id) !== -1
        }
        , allowRemote: argv.allowRemote
        , fork: function(device, ports) {
            var args = [
                'device'
                , '--serial', device.id
                , '--device-name', argv.deviceName
                , '--provider', argv.name
                , '--screen-port', ports.shift()
                , '--connect-port', ports.shift()
                , '--vnc-port', argv.vncPort
                , '--public-ip', argv.publicIp
                , '--group-timeout', argv.groupTimeout
                , '--storage-url', argv.storageUrl
                , '--adb-host', argv.adbHost
                , '--adb-port', argv.adbPort
                , '--screen-frame-rate', argv.screenFrameRate
                , '--screen-jpeg-quality', argv.screenJpegQuality
                , '--screen-grabber', argv.screenGrabber
                , '--screen-ping-interval', argv.screenPingInterval
                , '--screen-ws-url-pattern', argv.screenWsUrlPattern
                , '--connect-url-pattern', argv.connectUrlPattern
                , '--heartbeat-interval', argv.heartbeatInterval
                , '--boot-complete-timeout', argv.bootCompleteTimeout
                , '--vnc-initial-size', argv.vncInitialSize.join('x')
                , '--mute-master', argv.muteMaster
                , '--need-scrcpy', argv.needScrcpy
                , '--host', argv.host
                , '--url-without-adb-port', argv.urlWithoutAdbPort
                , '--device-code', argv.deviceCode
                , '--secret', argv.secret
            ]
                .concat(argv.connectSub.reduce(function(all, val) {
                    return all.concat(['--connect-sub', val])
                }, []))
                .concat(argv.connectPush.reduce(function(all, val) {
                    return all.concat(['--connect-push', val])
                }, []))
                .concat(argv.lockRotation ? ['--lock-rotation'] : [])
                .concat(!argv.cleanup ? ['--no-cleanup'] : [])
                .concat(argv.cleanupDisableBluetooth ? ['--cleanup-disable-bluetooth'] : [])
                .concat(argv.cleanupBluetoothBonds ? ['--cleanup-bluetooth-bonds'] : [])
                .concat(!argv.screenReset ? ['--no-screen-reset'] : [])
            return fork(cli, args)
        }
        , endpoints: {
            sub: argv.connectSub
            , push: argv.connectPush
        }
        , adbHost: argv.adbHost
        , adbPort: argv.adbPort
        , deviceType: argv.deviceType
    })
}
