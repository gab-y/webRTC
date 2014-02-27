/********************************************************************** WebRTC text communication prototype
Javascript node.js server app

Authors : Gabriel Guilbart & Raphaël Traineau
Project from Ecole Centrale de Nantes and Kosmopolead

Modules used : static-server and socket.io 

Please note that the app is builded for only TWO users
**********************************************************************/
/*** modules needed ***/
var static = require('node-static');
var http = require('http');
//io

/*** server creation ***/
//static server uses index.html
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(2013);
var io = require('socket.io').listen(app);

/*** globals ***/
var flag = 1; // flag downed once two browsers are connected

/*** socket creation ***/
//on('connection') means one browser connect to socket
io.sockets.on('connection', function(socket){
	socket.broadcast.emit('new connection');

	//first connection
	if(flag==1){
		flag = 0;
	}
	//second connection
	else{
		if(flag == 0){
			socket.broadcast.emit('start');
		}
	}
	
/*** socket functions ***/
	//on(sendIceCandidate) : broadcasts received ice candidate
	socket.on('sendIceCandidate',function(sdpMLine,sdpMid,candidate){
		socket.broadcast.emit('iceCandidate',sdpMLine, sdpMid, candidate);
	});
	
	//on(offerSessionDescription) : broadcasts received offer
	socket.on('offerSessionDescription', function(sessionDescription){
		socket.broadcast.emit('offerSessionDescription',sessionDescription);
	});
	
	//on(answerToOffer) : broadcasts received answer to previous offer
	socket.on('answerToOffer', function(sessionDescription){
		socket.broadcast.emit('answerSessionDescription',sessionDescription);
	});
});
