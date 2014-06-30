angular.module('electron', [
		'ui.ace',
		'angularBootstrapNavTree'
	])
	.factory('ServerData', function($rootScope, $http, $timeout){
		var socket = io.connect('http://localhost');

		var localBoards = [],
			localPorts = [],
			localSketches = [],
			openedPorts = {};

		socket.on('boards', function(serverBoards){
			$rootScope.$apply(function(){
				[].splice.apply(localBoards, [0,Infinity].concat(serverBoards))
			});
		});
		socket.on('ports', function(serverPorts){
			$rootScope.$apply(function(){
				[].splice.apply(localPorts, [0,Infinity].concat(serverPorts))
			});
		});
		socket.on('sketches', function(serverSketches){
			$rootScope.$apply(function(){
				[].splice.apply(localSketches, [0,Infinity].concat(serverSketches))
			});
		});

		socket.on('portData', function(dataIn){
			$rootScope.$apply(function(){
				//TODO also set `activePort`?
				var port = openedPorts[dataIn.port];
				if(!port){
					port = openedPorts[dataIn.port] = {log:[]};
				}
				port.log.push(dataIn.data);

				//TODO use setting of max log length
				if(port.log.length > 50){
					port.log.splice(0,port.log.length-50);
				}
			});
		});

		$timeout(function(){
			// request the list of boards from the server
			//$rootScope.$emit('wsOut', 'boards');
			//$rootScope.$emit('wsOut', 'ports');
			socket.emit('boards');
			socket.emit('ports');
			socket.emit('sketches');
		});

		return {
			boards : localBoards,
			ports: localPorts,
			sketches : localSketches,
			getSketch : function(name){
				return $http.get('/sketch/'+name);
			},
			openPort: function(port, rate){
				if(!(port && rate) || openedPorts[port.comName]){
					// already open
					//TODO should return a promise instead?
					return false;
				}
				return $http.post(
					'/serial/open',
					JSON.stringify({port: port.comName, rate:rate}),
					{
						headers: {
							'Content-Type': 'application/json'
						}
					}
				)
					.success(function(data, status, headers, config){
						openedPorts[port.comName] = {
							log: []
						};
					});
			},
			openedPorts: openedPorts,
			closePort : function(portName){
				return $http.post(
					'/serial/close',
					JSON.stringify({port: portName}),
					{
						headers: {
							'Content-Type': 'application/json'
						}
					}
				)
					.success(function(data, status, headers, config){
						delete openedPorts[portName];
					});
			},
			compile: function(board, sketch, code){
				return $http.post(
					'/compile',
					JSON.stringify({
						board: board.name, // name? id?
						sketch: sketch,
						code: code
					}),
					{
						headers: {
							'Content-Type': 'application/json'
						}
					}
				)
					.success(function(data, status, headers, config){
						console.log('compiling?', status, data);
					})
					.error(function(data, status, headers, config){
						console.log('error compiling...', status, data);
					});
			}
		};
	})
	.controller('MainController', function($scope, ServerData){
		//TODO move to another controller?
		$scope.boards = ServerData.boards;
		$scope.ports = ServerData.ports;
		$scope.activePort;
		$scope.activeBoard;

		$scope.setActivePort = function(port){
			$scope.activePort = port;

			// attempt to determine which board is connected at this port
			var boardMatched = ServerData.boards.filter(function(board){
				if(board && board.build && board.build.pid){
					if('object' === typeof board.build.pid){
						return board.build.vid === port.vendorId && ~board.build.pid.indexOf(port.productId);
					}
					return board.build.vid === port.vendorId && board.build.pid === port.productId;
				}
			})[0];

			if(boardMatched){
				$scope.setActiveBoard(boardMatched);
			}

		};

		$scope.setActiveBoard = function(board){
			$scope.activeBoard = board;
			maybeOpenPort();
		};

		function maybeOpenPort(){
			console.log('maybeOpenPort??');
			if(!$scope.activePort || !$scope.activeBoard){
				return;
			}

			ServerData.openPort($scope.activePort, 9600)
				.success(function(data, status, headers, config){
					console.log('open port?', status, data);
				});
		}

		$scope.openedPorts = ServerData.openedPorts;

		$scope.closeSerialPort = function(portName){
			ServerData.closePort(portName)
				.success(function(data, status, headers, config){
					console.log('closed port?', status, data);
				});
		};

		// $scope.compile = function(){
		// 	console.log('start compile...');
		// 	ServerData.compile($scope.activeBoard, sketch??, code??already on disk???);
		// };
	})
	.controller('SketchController', function($scope, $rootScope, ServerData){
		$scope.sketches = ServerData.sketches;

		function buildSketchesIdLookup(children, lookup){
			lookup = lookup || {};

			children.forEach(function(branch){
				lookup[branch.uid] = branch;
				buildSketchesIdLookup(branch.children, lookup);
			});

			return lookup;
		}

		var sketchesById;
		function buildPathFromBranch(branch){
			// instead of doing everytime, cache and lookup below only when stale (parent not found)
			//sketchesById = buildSketchesIdLookup($scope.sketches);
			var currentBranch = branch;
			var newCurrentBranch;
			var branchPath = [currentBranch];

			while(currentBranch && currentBranch.parent_uid){

				newCurrentBranch = sketchesById && sketchesById[currentBranch.parent_uid];
				if(!newCurrentBranch){
					sketchesById = buildSketchesIdLookup($scope.sketches);
					newCurrentBranch = sketchesById[currentBranch.parent_uid];
				}
				branchPath.unshift(newCurrentBranch);
				currentBranch = newCurrentBranch;
			}

			return branchPath.map(function(branch){ return branch.label }).join('/');
		}

		$scope.treeFocus = function(branch){
			console.log('branch', branch);
			var path = buildPathFromBranch(branch);
			console.log('path?', path);
			$rootScope.$broadcast('sketch:open', path);
		};
	})
	.controller('FileEditorController', function($scope, ServerData){
		$scope.openFiles = [
			{
				name: 'Your Sketchy.ino',
				// path: 'asdf/asdf',
				contents: 'int led = 13;'
			},
			{
				name: 'support.h',
				// path: 'asdf/support.h',
				contents: 'Serial.begin(9600);'
			}
		];


		$scope.$on('sketch:open', function($event, path){
			ServerData.getSketch(path)
				.success(function(data, status, headers, config){
					angular.forEach(data.files, function(file){
						$scope.openFiles.push({
							name : file.filename,
							path: data.name + '/' + file.filename,
							contents: file.content
						});
					});
				});
		});
	})
;