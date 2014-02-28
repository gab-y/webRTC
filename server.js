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

/*** server creation ***/
//static server uses index.html
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(process.env.PORT || 2013);//2013);
var io = require('socket.io').listen(app);

/*** socket creation ***/
//on('connection') means one browser connect to socket
io.sockets.on('connection', function(socket){
	socket.broadcast.emit('new connection');
	socket.broadcast.emit('start');
	
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
	
	socket.on('reorder',function(){
		socket.broadcast.emit('start');
	});
});
