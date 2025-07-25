import device from '../../units/device/index.js'
export const command = 'device'
export const builder = function(yargs) {
    return yargs
        .strict()
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
        .option('connect-port', {
            describe: 'Port allocated to adb connections.'
            , type: 'number'
            , demand: true
        })
        .option('connect-push', {
            alias: 'p'
            , describe: 'ZeroMQ PULL endpoint to connect to.'
            , array: true
            , demand: true
        })
        .option('connect-sub', {
            alias: 's'
            , describe: 'ZeroMQ PUB endpoint to connect to.'
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
        .option('provider', {
            alias: 'n'
            , describe: 'Name of the provider.'
            , type: 'string'
            , demand: true
        })
        .option('public-ip', {
            describe: 'The IP or hostname to use in URLs.'
            , type: 'string'
            , demand: true
        })
        .option('screen-frame-rate', {
            describe: 'The frame rate (frames/s) to be used for screen transport on the network. ' +
            'Float value must be > 0.0 otherwise the default behavior is kept'
            , type: 'number'
            , default: process.env.SCREEN_FRAME_RATE || -1
        })
        .option('screen-jpeg-quality', {
            describe: 'The JPG quality to use for the screen.'
            , type: 'number'
            , default: process.env.SCREEN_JPEG_QUALITY || 1 // 80
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
        .option('screen-port', {
            describe: 'Port allocated to the screen WebSocket.'
            , type: 'number'
            , demand: true
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
        .option('serial', {
            describe: 'The USB serial number of the device.'
            , type: 'string'
            , demand: true
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
        .option('vnc-port', {
            describe: 'Port allocated to VNC connections.'
            , type: 'number'
            , demand: true
        })
        .option('need-scrcpy', {
            describe: 'Need using Scrcpy instead Minicap for screen capture.'
            , type: 'boolean'
            , default: false
        })
        .option('device-name', {
            describe: 'Device name'
            , type: 'string'
            , default: false
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
}
export const handler = function(argv) {
    return device({
        serial: argv.serial
        , provider: argv.provider
        , publicIp: argv.publicIp
        , endpoints: {
            sub: argv.connectSub
            , push: argv.connectPush
        }
        , groupTimeout: argv.groupTimeout * 1000 // change to ms
        , storageUrl: argv.storageUrl
        , adbHost: argv.adbHost
        , adbPort: argv.adbPort
        , screenFrameRate: argv.screenFrameRate
        , screenJpegQuality: argv.screenJpegQuality
        , screenGrabber: argv.screenGrabber
        , screenPingInterval: argv.screenPingInterval
        , screenPort: argv.screenPort
        , screenWsUrlPattern: argv.screenWsUrlPattern
        , connectUrlPattern: argv.connectUrlPattern
        , connectPort: argv.connectPort
        , vncPort: argv.vncPort
        , vncInitialSize: argv.vncInitialSize
        , heartbeatInterval: argv.heartbeatInterval
        , bootCompleteTimeout: argv.bootCompleteTimeout
        , muteMaster: argv.muteMaster
        , lockRotation: argv.lockRotation
        , cleanup: argv.cleanup
        , cleanupDisableBluetooth: argv.cleanupDisableBluetooth
        , cleanupBluetoothBonds: argv.cleanupBluetoothBonds
        , screenReset: argv.screenReset
        , needScrcpy: argv.needScrcpy
        , deviceName: argv.deviceName
        , host: argv.host
        , urlWithoutAdbPort: argv.urlWithoutAdbPort
        , deviceCode: argv.deviceCode
        , secret: argv.secret
    })
}
