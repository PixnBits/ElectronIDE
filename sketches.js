var fs = require('fs');

var settings = require('./settings.js');
var platform = require('./platform');
var plat = platform.getDefaultPlatform();

exports.makeNewSketch = function(name,cb) {
    var dir = plat.getUserSketchesDir()+'/'+name;
    if(fs.existsSync(dir)) {
        if(cb)cb(null);
        return;
    }
    fs.mkdirSync(dir);
    var example = fs.readFileSync(settings.sketchtemplate).toString();
    fs.writeFileSync(plat.getUserSketchesDir()+'/'+name+'/'+name+'.ino',example);
    if(cb) cb(name,example);
}

exports.deleteSketch = function(name, cb) {
    var dir = plat.getUserSketchesDir()+'/'+name;
    fs.readdirSync(dir).forEach(function(file) {
        console.log("deleting file = ",file);
        fs.unlinkSync(dir+'/'+file);
    });
    fs.rmdirSync(dir);
    if(cb) cb(name);
}

exports.renameSketch = function(oldname, newname, cb) {
    fs.rename(
        plat.getUserSketchesDir()+'/'+oldname,
        plat.getUserSketchesDir()+'/'+newname, function(err) {
        console.log("rename error = ",err);

        fs.rename(
            plat.getUserSketchesDir()+'/'+newname+'/'+oldname+'.ino',
            plat.getUserSketchesDir()+'/'+newname+'/'+newname+'.ino', function(err) {
                console.log("rename error = ",err);
                cb(newname);
            });
    });
}


//TODO use fs.watch (http://nodejs.org/api/all.html#all_fs_watch_filename_options_listener) to notice when the user changes files/folders out of band (external editor)

function listChildren(path){
    var list = fs
                .readdirSync(path)
                .map(function(name){
                    var childPath = path+'/'+name;
                    var stat = fs.statSync(childPath);
                    var data = { label: name };

                    if(stat.isDirectory()){
                        //FIXME detect infinite recursion (i.e.:symlink)
                        data.children = listChildren(childPath)
                    }

                    return data;
                });

    return list;
}
exports.listSketches = function(cb) {
    var list = listChildren(plat.getUserSketchesDir());

    if(cb) cb(list);
}

exports.getSketch = function(name, cb) {
    var dir = plat.getUserSketchesDir() + '/' + name;
    var obj = {
        name:name,
        files:[]
    };
    fs.readdirSync(dir).forEach(function(filename) {
        //skip hidden files
        if(filename.indexOf('.')==0) return;
        var file = fs.readFileSync(dir+'/'+filename);
        //console.log("file",filename);
        if(filename.toLowerCase() == 'info.json') {
            console.log("info file");
            obj.info = JSON.parse(file.toString());
            console.log("info = ",obj.info);
            return;
        }
        obj.files.push({
            filename:filename,
            content:file.toString(),
        });
    });
    if(cb) cb(obj);


}

exports.saveSketch = function(name, code, cb) {
    console.log("saving to ",name);
    var dir = plat.getUserSketchesDir() + '/' + name;
    console.log("dir = ",dir);
    var file = dir+'/'+name+'.ino';
    console.log("file = ",file);
    fs.writeFileSync(file,code);
    if(cb)cb();
}
