/********************************************************************** WebRTC text communication prototype
Javascript browser app

Authors : Gabriel Guilbart & Raphaël Traineau
Project from Ecole Centrale de Nantes and Kosmopolead

The JS comments concern javascript/node socket language and not WebRTC or the app 

Please note that the app is builded for only TWO users
**********************************************************************/

'use strict'; //JS : instruction for navigator, for a different interpretation of a function or all file code

/*** Sending listeners ***/
document.getElementById("send").onclick = sendData;//button Send listener
document.getElementById("toSend").onkeypress = function(){
//enter pressed on toSend textarea listener
	if(window.event.keyCode == '13') {//'enter' code
		sendData();//JS : () needed !
	};
}

//connection globals				
var textChannel; 
var peerConnection;

var isFirst = 2;//initialized at 2, at 1 you are communication initiator, at 0 follower. The js code is the same whether you are initiator or not but the instructions are not.
var iceSent = 0;//to check whether the ice candidate was sent or not. //TODO : prevent multiple tries !

//ice servers addresses to open users NATs
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
  
var pc_constraints = null;
  
var socket = io.connect();//connect to server's websocket. Answers if you are first or not :

//JS : socket.on = socket messages listeners
/***
	'Server connection' server's message listener
	Check whether the navigator is initiator from server's message
	Sent when a navigator connects to the server
***/
socket.on('Server connection',function(info) {
	if(info == 'Initiator'){
		isFirst = 1;
		console.log('first');
		}
	else{
		isFirst = 0;
		console.log('not first');
	}
});

/***
	'Start' server's message listener
	If initiator, launches connections and send its ice candidate. If not, do nothing
	Sent when two navigators are connected to the server
***/
socket.on('start',function(){
	if(isFirst == 1){
		//create peer connection (global)
		try {
			peerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			//JS : alert display a window
			alert('RTCPeerConnection failed');
			console.log(e.message);
		}
		//create data channel (global too)
		try {
			textChannel = peerConnection.createDataChannel({reliable: false});//TODO reliable is used only by Chrome ?
		} catch (e) {
			alert('Send channel creation failed');
			console.log(e.message);
		}
		textChannel.onmessage = handleMessage;//message receiving listener
		
		//creates an offer and a session description and send them
		//JS - TODO : not really understandable o_0
		peerConnection.createOffer(function (sessionDescription) {
			peerConnection.setLocalDescription(sessionDescription);
			trace('Offer from localPeerConnection \n' + sessionDescription.sdp);//trace equals to console.log. Comes from Google's adapter.js
			socket.emit('offerSessionDescription',sessionDescription);
		},null, null);
	peerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
	}
});

/***
	'iceCandidate' server's message listener
	Add to peer connection object the ice candidate received
	Sent each time the server get an ice candidate
***/
socket.on('iceCandidate',function(rsdp, rmid, rcand){
	try{
	peerConnection.addIceCandidate(new RTCIceCandidate({
		sdpMLineIndex: rsdp, 
		candidate: rcand
		}));
	}catch(e){
		alert('adding ice candidate failed');
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
});


/***
	sendIceCandidate function
	Send browser ice candidate (if not ever did)
***/
//JS same kind of event than http://en.wikipedia.org/wiki/Event-driven_architecture#Event_channel ?
function sendIceCandidate(event){
	if(iceSent == 0){//TODO find why it tries to send so much times ice candidate
		if(event.candidate){
			console.log('sending ice candidate success');
			socket.emit('sendIceCandidate',event.candidate.sdpMLineIndex, event.candidate.sdpMid, event.candidate.candidate);//strange but works that way
			iceSent = 1;
		}
		else{
			alert('sending ice candidate failed');
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
	}
}

/***
	'offerSessionDescription' server's message listener
	Not initiator : create its own connections' objects, create answer and ice candidate and send 
	Sent when server gets initiator's RTC offer
***/
socket.on('offerSessionDescription', function(offererSessionDescription){
	if(isFirst == 0){
		console.log('received offer');
		try {
			peerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			alert('RTCPeerConnection failed');
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
		//set remote description from the one received
		peerConnection.setRemoteDescription( new RTCSessionDescription (offererSessionDescription));
		
		//create session description from our browser
		//JS : finally... what's createAnswer parameter ?
		peerConnection.createAnswer(function (sessionDescription) {
			peerConnection.setLocalDescription(sessionDescription);
			socket.emit('answerToOffer',sessionDescription);
		});
		
		console.log('offer sent');
		peerConnection.ondatachannel = gotReceiveChannel;
		peerConnection.onicecandidate = sendIceCandidate;
	}
});

/***
	'answerSessionDescription' server's message listener
	Initiator : set remote description from answer. Not initiator : nothing.
	Sent when server gets answerer's RTC answer to initiator's offer
***/
socket.on('answerSessionDescription', function(answererSessionDescription){
	if(isFirst == 1){
		console.log('received answer');
		peerConnection.setRemoteDescription( new RTCSessionDescription (answererSessionDescription));
	}
});

/***
	gotReceiveChannel function
	Only called by non-initiator. Sets dataChannel from the one received from the server.
	See offerSessionDescription socket's listener for initiator equivalent.
***/
//JS same kind of event than http://en.wikipedia.org/wiki/Event-driven_architecture#Event_channel ?
function gotReceiveChannel(event) {
	console.log('receive channel');
	textChannel = event.channel;
	textChannel.onmessage = handleMessage;
}

/***
	handleMessage function
	dataChannel.onmessage listener. Display received messages.
	Set on offerSessionDescription socket listener for initiator and gotReceiveChannel for non-initiator
***/
function handleMessage(event){
	console.log('got message');
	document.getElementById("messages").innerHTML += "<p><b>Lui : </b>"+event.data+"</p>";
}

/***
	sendData function
	Send textarea's content through dataChannel.
	Called when user click on Send or press Enter. 
***/
function sendData(){
	var toSend = document.getElementById("toSend");
	console.log(toSend.value);
	try{
		textChannel.send(toSend.value);
		document.getElementById("messages").innerHTML += "<p><b>Moi :</b> "+ toSend.value +"</p>";
		//once message sent, textarea is cleared and focused once new (in button clicked case)
		toSend.value = '';
		toSend.focus();
	}
	catch(e){
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
}


	