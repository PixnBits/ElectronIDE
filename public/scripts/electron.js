angular.module('electron', [
		'ui.ace'
	])
	.factory('ServerData', function($rootScope, $timeout){
		var socket = io.connect('http://localhost');

		var localBoards = [],
			localPorts = [];

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

		$timeout(function(){
			// request the list of boards from the server
			//$rootScope.$emit('wsOut', 'boards');
			//$rootScope.$emit('wsOut', 'ports');
			socket.emit('boards');
			socket.emit('ports');
		});

		return {
			boards : localBoards,
			ports: localPorts
		};
	})
	.controller('MainController', function($scope, ServerData){
		$scope.boards = ServerData.boards;
		$scope.ports = ServerData.ports;
		$scope.activePort;
		$scope.activeBoard;

		$scope.setActivePort = function(port){
			$scope.activePort = port;

			// attempt to determine which board is connected at this port
			var boardMatched = ServerData.boards.filter(function(board){
				if(board && board.build && board.build.pid){
					return board.build.pid === port.productId && board.build.vid === port.vendorId;
				}
			})[0];

			if(boardMatched){
				$scope.setActiveBoard(boardMatched);
			}
		};

		$scope.setActiveBoard = function(board){
			$scope.activeBoard = board;
		};
	})
	.controller('FileEditorController', function($scope){
		$scope.files = [
			{
				name: 'Your Sketchy.ino',
				contents: 'int led = 13;'
			},
			{
				name: 'support.h',
				contents: 'Serial.begin(9600);'
			}
		];
	})
;