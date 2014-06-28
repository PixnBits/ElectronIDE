angular.module('electron', [])
	.run(function($rootScope, $timeout){

		var ws = new WebSocket('ws://127.0.0.1:4203');

		ws.onopen = function(evt){
			console.log('WebSocket open', evt);
		};
		// ws.onclose = function(evt) { onClose(evt) };
		// ws.onerror = function(evt) { onError(evt) };

		ws.onmessage = function(evt) {
			console.log('message on websocket', evt);

			var parsedData;
			try{
				parsedData = JSON.parse(evt.data);
			}catch(e){}
			console.log('parsedData', parsedData);

			if(parsedData){
				//$rootScope.$broadcast('wsIn', parsedData.name, parsedData.data);
				$rootScope.$broadcast('wsIn-'+parsedData.name, parsedData.data);
			}else{
				console.error('could not parse data', evt);
			}
		};

		$rootScope.$on('wsOut', function sendDataThroughWebSocket($event, name, data){
			if(ws.readyState !== WebSocket.OPEN){
				console.log('delaying sending the msg');
				return $timeout(function(){
					sendDataThroughWebSocket($event, name, data);
				});
			}
			console.log('sending message to websocket', name, data);
			ws.send(JSON.stringify({name: name, data: data}));
		});

	})
	.factory('ServerData', function($rootScope, $timeout){
		var localBoards = [],
			localPorts = [];

		$rootScope.$on('wsIn-boards', function($event, serverBoards){
			$rootScope.$apply(function(){
				[].splice.apply(localBoards, [0,Infinity].concat(serverBoards))
			});
		});
		$rootScope.$on('wsIn-ports', function($event, serverPorts){
			$rootScope.$apply(function(){
				[].splice.apply(localPorts, [0,Infinity].concat(serverPorts))
			});
		});

		$timeout(function(){
			// request the list of boards from the server
			$rootScope.$emit('wsOut', 'boards');
			$rootScope.$emit('wsOut', 'ports');
		});

		return {
			boards : localBoards,
			ports: localPorts
		};
	})
	.controller('MainController', function($scope, ServerData){
		$scope.sanity = "Keep it";
		//$scope.$emit('wsOut', 'hi', {'a':1});

		$scope.boards = ServerData.boards;
		$scope.ports = ServerData.ports;
		$scope.activePort;
		$scope.activeBoard;

		$scope.setActivePort = function(port){
			$scope.activePort = port;
		};
		$scope.setActiveBoard = function(board){
			$scope.activeBoard = board;
		};
	})
;