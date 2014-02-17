var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(2013);

var io = require('socket.io').listen(app);

var flag = 1;

var offer;

io.sockets.on('connection', function(socket){
	socket.on('begin',function(){
		if(flag==1){
		socket.emit('Server connection','Initiator');
		flag = 0;
	}
	else{
		socket.emit('Server connection','Not initiator');
		
		if(flag == 0){
			socket.broadcast.emit('start');
		}
	}
	});

	socket.on('sendIceCandidate',function(sdpMLine,sdpMid,candidate){
		socket.broadcast.emit('iceCandidate',sdpMLine, sdpMid, candidate);
	});
	socket.on('offerSessionDescription', function(sessionDescription){
		//offer = sessionDescription;
		socket.broadcast.emit('offerSessionDescription',sessionDescription);//offer);
	});
	socket.on('answerToOffer', function(sessionDescription){
		socket.broadcast.emit('answerSessionDescription',sessionDescription);
	});
});
