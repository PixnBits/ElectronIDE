var HOSTNAME = location.protocol + '//' + location.host;

function POST(url,payload,cb) {
    var data = new FormData();
    if(payload instanceof FormData) {
        data = payload;
    } else {
        for(var name in payload) {
            data.append(name,payload[name]);
        }
    }
    $.ajax({
        url: HOSTNAME+url,
        type: "POST",
        data: data,
        processData: false,  // tell jQuery not to process the data
        contentType: false,   // tell jQuery not to set contentType
        success: function(res) {
            var resp = JSON.parse(res);
            console.log("POST got back",resp);
            if(cb) cb(resp);
        }
    });
}

$(document).ready(function() {

var langTools = ace.require("ace/ext/language_tools");
var editor = ace.edit('ace-editor');
editor.setOptions({
    enableBasicAutocompletion: true,
});
//editor.setTheme('ace/theme/xcode');
editor.getSession().setMode('ace/mode/c_cpp');
editor.getSession().setUseWrapMode(true);

var BOARDS = [];
var PORTS = [];

var STATE = {
    port:'',
    board:'',
    sketch:'',
    rate:9600,
}
function setPort(port) {
    STATE.port = port;
    $("#port-selector .data").text(port);

    // attempt to determine which board is connected at this port
    // find port in PORTS
    var fullPort = PORTS.filter(function(portData){
        return port === portData.comName;
    })[0];

    if(fullPort){
        var boardMatched = BOARDS.filter(function(board, ind){
            if(board && board.build && board.build.pid){
                return board.build.pid === fullPort.productId && board.build.vid === fullPort.vendorId;
            }
        })[0];

        if(boardMatched){
            setBoard(boardMatched.id);
        }
    }

}
function setBoard(board) {
    STATE.board = board;
    $("#board-selector .data").text(board);

    var match = BOARDS.filter(function(board) {  return board.id == STATE.board;  });
    var tmpl = $("#board-info-template").text();
    $("#board-info-pane").empty().append(Mustache.render(tmpl,match[0]));
}
function setRate(rate) {
    STATE.rate = rate;
    $("#serial-selection-button .data").text(rate);
}

function setSketch(sketch) {
    STATE.sketch = sketch;
    $("#sketch-name").text(sketch.name);
    editor.setValue(sketch.files[0].content);
}

function loadSketch(name) {
    $.get(HOSTNAME+'/sketch/'+name,function(res) {
        console.log("the result is ",res);
        setSketch(res);
        var infotemplate = $("#sketch-info-template").text();
        $("#sketch-info").empty().append(Mustache.render(infotemplate,res.info));
        $("#sketch-info .libraries a").click(function(e) {
            e.preventDefault();
            var libname =  $(this).attr('data-id');
            console.log('clicked on lib', libname);
            $('.nav-tabs a[href="#docs-pane"]').tab('show');
            $.get(HOSTNAME+'/docs/library/'+libname,function(res2) {
                var libdoctemplate = $("#library-doc-template").text();
                console.log('got back docs',res2);
                $("#docs-pane").empty().append(Mustache.render(libdoctemplate,res2));
            })
        })

    })
}

function fetchSerialports(cb) {
    $.get(HOSTNAME+"/ports",function(res) {
        PORTS = JSON.parse(res);
        cb(PORTS);
    })
}
function populateSerialports(ports) {
    var template = $("#port-selector-template").text();
    $("#port-selector .dropdown-menu")
        .empty()
        .append(Mustache.render(template,ports));
    $("#port-selector .dropdown-menu a").click(function(e) {
        e.preventDefault();
        setPort($(this).attr('data-name'));
    })
}
fetchSerialports(populateSerialports);


function fetchBoards(cb) {
    $.get(HOSTNAME+"/boards",function(res) {
        cb(JSON.parse(res));
    })
}

function populateBoards(boards) {
    BOARDS = boards;
    var template = $("#board-selector-template").text();
    $("#board-selector .dropdown-menu")
        .empty()
        .append(Mustache.render(template,boards));
    $("#board-selector .dropdown-menu a").click(function(e) {
        e.preventDefault();
        setBoard($(this).attr('data-id'));
    })
}

fetchBoards(populateBoards);

function compileCode() {
    appendConsole("compiling", STATE.sketch.name);
    POST('/compile',{
        code: editor.getValue(),
        board: STATE.board,
        sketch: STATE.sketch.name,
    }, function(resp) {
        appendConsoleResponse(resp.status);
        if(resp.status == 'error') {
            appendConsoleResponse(resp.output);
        }
    });
}

function compileAndRunCode() {
    appendConsole('compiling and running');
    var data = new FormData();
    data.append('code',editor.getValue());
    data.append('board',STATE.board);
    data.append('port',STATE.port);
    data.append('sketch',STATE.sketch.name);
    $.ajax({
        url: HOSTNAME+'/run',
        type: "POST",
        data: data,
        processData: false,  // tell jQuery not to process the data
        contentType: false,   // tell jQuery not to set contentType
        success: function(res) {
            appendConsoleResponse(JSON.parse(res).status);
        },
    });
}

function toggleSerialConsole() {
    if(STATE.serial == 'open') {
        STATE.serial = 'closed';
        $("#open-serial-button").text('open');
        $("#serial").text($("#serial").text()+"closed\n");
        POST('/serial/close',{
            port:STATE.port,
        }, function(resp) {
            console.log("response is",resp);
            if(resp.status == 'error') {
                $("#serial").text($("#serial").text()+"error: " + resp.message + "\n");
            }
        });
    } else {
        STATE.serial = 'open';
        $("#open-serial-button").text('close');
        $("#serial").text($("#serial").text()+"opened at " + STATE.rate + " baud\n");
        POST('/serial/open',{
            port:STATE.port,
            rate:STATE.rate,
        }, function(resp) {
            console.log("response is",resp);
            if(resp.status == 'error') {
                $("#serial").text($("#serial").text()+"error: " + resp.message + "\n");
            }
        });
    }
}


function appendConsole(str) {
    $("#console").append('<p>'+str+'</p>');
    var objDiv = document.getElementById("console");
    objDiv.scrollTop = objDiv.scrollHeight;
}
function appendConsoleResponse(str) {
    $("#console").append('<p class="response">'+str+'</p>');
    var objDiv = document.getElementById("console");
    objDiv.scrollTop = objDiv.scrollHeight;
}
$("#compile").click(function(e) {
    e.preventDefault();
    compileCode();
});
$("#run").click(function(e) {
    e.preventDefault();
    compileAndRunCode();
});


function fetchSketches(cb) {
    $.get(HOSTNAME+"/sketches",function(res) {
        cb(JSON.parse(res));
    });
}

function populateSketches(sketches) {
    var template = $("#sketch-template").text();
    $("#sketch-picker")
        .empty()
        .append(Mustache.render(template,sketches));
    $("#sketch-picker a").click(function(e) {
        console.log('switching');
        e.preventDefault();
        loadSketch($(this).attr('data-name'));
    });
    $("#sketch-picker .edit-button").click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        var name = $(this).attr('data-name');
        console.log('renaming',name);

        $("#rename-sketch-dialog .old-name").val(name);
        $("#rename-sketch-dialog .new-name").val(name);

        $("#rename-sketch-dialog").modal('show');
    });
    $("#sketch-picker .delete-button").click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        var name = $(this).attr('data-name');
        console.log('deleting',name);
        POST('/sketches/delete',{name:name},function(res){
            console.log("repsonse from delete is",res);
            appendConsole('deleted sketch '+name);
            if(res.status == 'error') {
                appendConsoleResponse(res.output);
            } else {
                fetchSketches(populateSketches);
            }
        });
    });
}

fetchSketches(populateSketches);


$("#search-button").click(function(e){
    e.preventDefault();
    console.log("searching",$("#search-help").val());
    $.get(HOSTNAME+'/search?query='+$("#search-help").val(),function(res) {
        console.log("got back",res);
        $("#search-results").css('display','block').empty().append(
            Mustache.render($("#library-template").text(),res)
        );
        $("#search-results a").click(function(e) {
            e.preventDefault();
            var libid = $(this).attr('data-id');
            var libname = $(this).attr('data-name');
            $("#search-results").css('display','none');
            console.log("adding library",libid);
            editor.gotoLine(0);
            editor.insert("#include <"+libname+".h>\n");
        });
    });
})


$("#new-sketch-button").click(function(e){
    e.preventDefault();
    var name = "Sketch"+Math.floor(Math.random()*10000);
    $("#new-sketch-dialog input").val(name);
    $("#new-sketch-dialog").modal('show');
});

$("#create-sketch-button").click(function(e) {
    e.preventDefault();
    $("#new-sketch-dialog").modal('hide');
    var name = $("#new-sketch-dialog input").val();
    console.log('name = ',name);
    POST("/new",{name:name},function(res){
        console.log("new sketch = ",res);
        appendConsole('created new sketch '+name);
        if(res.status == 'error') {
            appendConsoleResponse(res.output);
        } else {
            fetchSketches(populateSketches);
        }
    });

});

$("#rename-sketch-button").click(function(e) {
    e.preventDefault();
    $("#rename-sketch-dialog").modal('hide');
    var oldname = $("#rename-sketch-dialog .old-name").val();
    var newname = $("#rename-sketch-dialog .new-name").val();
    console.log('renaming name = ',oldname, 'to',newname);
    POST('/rename', {oldname:oldname, newname:newname}, function(res) {
        console.log("response from rename is ",res);
        if(res.status == 'error') {
            appendConsoleResponse(res.output);
        } else {
            fetchSketches(populateSketches);
        }
    })
});

$("#edit-sketches-button").click(function(e) {
    e.preventDefault();
    $("#sketch-picker .edit-button").toggleClass('hidden');
    $("#sketch-picker .delete-button").toggleClass('hidden');
})

$("#save-sketch-button").click(function(e) {
    e.preventDefault();
    console.log('current sketch is ',STATE);
    STATE.sketch.files[0].content = editor.getValue();
    console.log("code = ",STATE.sketch.files[0].content);
    appendConsole("saving " + STATE.sketch.name);
    POST('/save',{
        code: STATE.sketch.files[0].content,
        name: STATE.sketch.name,
    }, function(resp) {
        appendConsoleResponse(resp.status);
        if(resp.status == 'error') {
            appendConsoleResponse(resp.output);
        }
    });

})

$("#open-serial-button").click(function(e) {
    e.preventDefault();
    toggleSerialConsole();
});

$("#clear-debug-pane").click(function(e) {
    e.preventDefault();
    $("#console").empty();
});

$("#clear-serial-pane").click(function(e) {
    e.preventDefault();
    $("#serial").empty();
});


var templ = $("#serial-selection-menu-template").text();
$("#serial-selection-menu").empty().append(Mustache.render(templ,
    [300,1200,2400,4800,9600,14400,19200,28800,38400,57600,115200]));
$("#serial-selection-menu a").click(function(e) {
        e.preventDefault();
        setRate($(this).attr('data-speed'));
    })



var wsurl = "ws:" + location.hostname + ":4203";
var monitor = new WebSocket(wsurl);
monitor.onopen = function(e) {
    console.log("opened the websocket for ",wsurl);
}
monitor.onclose = function(e) {
    console.log("closed websocket");
}
monitor.onerror = function(e) {
    console.log("error in websocket");
}
monitor.onmessage = function(e) {
    var event = JSON.parse(e.data);
    if(event.type == 'serial') {
        $("#serial").text($("#serial").text()+event.data);
        var objDiv = document.getElementById("serial");
        objDiv.scrollTop = objDiv.scrollHeight;
    } else {
        $("#console").append('<p class="response">'+event.message+'</p>');
        var objDiv = document.getElementById("console");
        objDiv.scrollTop = objDiv.scrollHeight;

    }
}


      });