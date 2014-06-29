var serialportModule = require('serialport'),
    SerialPort = serialportModule.SerialPort;

var sp = null;
exports.open = function(port, rate, cb) {
    console.log('opening the serial port',port,'at rate',rate);
    sp = new SerialPort(port,{
        baudrate:rate
    });
    sp.on('open',function() {
        console.log('port finally opened');
        sp.on('data',function(data) {
            //console.log("got some data",data.toString());
            cb(data);
        });
        sp.on('close',function(err) {
            console.log('port closed from the other end',err);
            cb(err);
        });
        sp.on('error',function(err) {
            console.log('serial port error',err);
            cb(err);
        });
    });
}

exports.close = function(port, cb) {
    console.log("closing the serial port",port);
    sp.close(function(err) {
        console.log("the port is really closed now");
        if(cb) cb();
    });
}

exports.list = function(callback){
    serialportModule.list(function(err,list){
        // format the data (workaround serialport issue on Win (&*nix?))
        list.forEach(function(port){
            if(port.pnpId){
                var data = /^USB\\VID_([a-fA-F0-9]{4})\&PID_([a-fA-F0-9]{4})/.exec(port.pnpId);
                if(data){
                    port.vendorId = port.vendorId || '0x'+data[1];
                    port.productId = port.productId || '0x'+data[2];
                }
            }
        });
        callback(list);
    });
}