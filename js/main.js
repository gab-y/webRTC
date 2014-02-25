/********************************************************************** 
WebRTC text communication prototype
Javascript browser app

Authors : Gabriel Guilbart & Raphaël Traineau
Project from Ecole Centrale de Nantes and Kosmopolead

The JS comments concern javascript/node socket language and not WebRTC or the app 

Please note that the app is builded for only TWO users
**********************************************************************/

'use strict'; //JS : instruction for navigator, for a different interpretation of a function or all file code

/*** Sending listeners ***/
document.getElementById("send").onclick = sendData;//button Send listener
document.getElementById("toSend").onkeypress = function(event){
//enter pressed on toSend textarea listener
	if(event.keyCode == '13') {//'enter' code
		sendData();//JS : () needed !
	};
}

//connection globals				
var ownerTextChannel; 
var ownerPeerConnection;

var clientTextChannel;
var clientPeerConnection;

var isFirst = 0;//initialized at 2, at 1 you are communication initiator, at 0 follower. The js code is the same whether you are initiator or not but the instructions are not.
var iceSent = 0;//to check whether the ice candidate was sent or not. //TODO : prevent multiple tries !

//ice servers addresses to open users NATs
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} :
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
  
var pc_constraints = null;//constraints about media
  
var socket = io.connect();//connect to server's websocket. Answers if you are first or not :

socket.on('new connection',function(){
	isFirst ++;
	console.log('status : '+isFirst);
});

//JS : socket.on = socket messages listeners
/***
	'Server connection' server's message listener
	Check whether the navigator is initiator from server's message
	Sent when a navigator connects to the server
***/
socket.on('Server connection',function(info) {
	//if(isFirst == 2){
	/*	if(info == 'Initiator'){
			isFirst = 1;
			console.log('first');
			}
		else{
			isFirst = 0;
			console.log('not first');
		}
	/*}
	else{
		if(isFirst == 1){
			isFirst = 3;
		}
		else{
			if(isFirst == 0){

				isFirst = 1;
			}
		}
	}*/
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
			ownerPeerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			//JS : alert display a window
			alert('RTCPeerConnection failed');
			console.log(e.message);
		}
		//create data channel (global too)
		try {
			ownerTextChannel = ownerPeerConnection.createDataChannel({reliable: false});//reliable : guarantee messages arrive, and their order. Potentially slower. 
				// TODO : Chrome doesn't handle reliable mode ?
		} catch (e) {
			alert('Send channel creation failed');
			console.log(e.message);
		}
		ownerTextChannel.onmessage = ownerMessage;//message receiving listener
		
		//creates an offer and a session description and send them
		//JS : finally, what are createOffer parameters ?
		ownerPeerConnection.createOffer(function (sessionDescription) {
			ownerPeerConnection.setLocalDescription(sessionDescription);
			trace('Offer from localPeerConnection \n' + sessionDescription.sdp);//trace equals to console.log. Comes from Google's adapter.js
			socket.emit('offerSessionDescription',sessionDescription);
		},null, null);//2nd null is media constraints, 1st remains a mystery
		ownerPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
	}
});

/***
	'iceCandidate' server's message listener
	Add to peer connection object the ice candidate received
	Sent each time the server get an ice candidate
***/
socket.on('iceCandidate',function(rsdp, rmid, rcand){
	if(isFirst == 1){
		try{
		ownerPeerConnection.addIceCandidate(new RTCIceCandidate({
			sdpMLineIndex: rsdp, 
			candidate: rcand
			}));
		//isFirst = 2;
		}catch(e){
			alert('adding ice candidate failed');
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
	}
	else{ 
		if(isFirst == 0){
			try{
			clientPeerConnection.addIceCandidate(new RTCIceCandidate({
				sdpMLineIndex: rsdp, 
				candidate: rcand
				}));
			//isFirst = 1;
			}catch(e){
				alert('adding ice candidate failed');
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
		}else{
			console.log('received ice, but nothing to do');
		}
	}
});


/***
	sendIceCandidate function
	Send browser ice candidate (if not ever did)
	Called by onicecandidate every time a candidate is returned by the system (as an event)
***/
function sendIceCandidate(event){
	if(event.candidate){
		console.log('sending ice candidate success');
		socket.emit('sendIceCandidate',event.candidate.sdpMLineIndex, event.candidate.sdpMid, event.candidate.candidate);//strange but works that way
	}
	else{
		console.log('onicecandidate returned an event but it\'s not a candidate...');
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
			clientPeerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			alert('RTCPeerConnection failed');
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
		//set remote description from the one received
		clientPeerConnection.setRemoteDescription( new RTCSessionDescription (offererSessionDescription));
		
		//create session description from our browser
		//JS : finally... what's createAnswer parameter ?
		clientPeerConnection.createAnswer(function (sessionDescription) {
			clientPeerConnection.setLocalDescription(sessionDescription);
			socket.emit('answerToOffer',sessionDescription);
		},null,null);//2nd null is media constraints, 1st remains a mystery
		
		console.log('offer sent');
		clientPeerConnection.ondatachannel = gotReceiveChannel;//create a listener for receiving data channels
		clientPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
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
		ownerPeerConnection.setRemoteDescription( new RTCSessionDescription (answererSessionDescription));
		//isFirst = -1; // NOT HERE !!
	}
	else{
		isFirst == 0;
	}	
});

/***
	gotReceiveChannel function
	Only called by non-initiator. Sets local dataChannel from the one received from the server.
	See offerSessionDescription socket's listener for initiator equivalent.
	Called by onDataChannel, when a dataChannel is received (in the event)
***/
function gotReceiveChannel(event) {
	console.log('receive channel');
	clientTextChannel = event.channel;
	clientTextChannel.onmessage = clientMessage;//when the app gets a message, call handleMessage, which displays it
}

/***
	handleMessage function
	dataChannel.onmessage listener. Display received messages.
	Set on offerSessionDescription socket listener for initiator and gotReceiveChannel for non-initiator
***/
function ownerMessage(event){
	console.log('got message');
	document.getElementById("messages").innerHTML += "<p><b>Lui : </b>"+event.data+"</p>";
	if(typeof(clientTextChannel) != 'undefined'){
			try{
				clientTextChannel.send(event.data);
			}catch(e){
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
		} 
}

/***
	handleMessage function
	dataChannel.onmessage listener. Display received messages.
	Set on offerSessionDescription socket listener for initiator and gotReceiveChannel for non-initiator
***/
function clientMessage(event){
	console.log('got message');
	document.getElementById("messages").innerHTML += "<p><b>Lui : </b>"+event.data+"</p>";
	if(typeof(ownerTextChannel) != 'undefined'){
			try{
				ownerTextChannel.send(event.data);
			}catch(e){
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
		} 
}

/***
	sendData function
	Send textarea's content through dataChannel.
	Called when user click on Send or press Enter. 
***/
function sendData(){
	var toSend = document.getElementById("toSend");
	try{
	document.getElementById("messages").innerHTML += "<p><b>Moi :</b> "+ toSend.value +"</p>";
		if(typeof(clientTextChannel) != 'undefined'){
			console.log("client : " + toSend.value);
			try{
				clientTextChannel.send(toSend.value);
			}catch(e){
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
		}
		if(typeof(ownerTextChannel) != 'undefined'){
			console.log("owner : " + toSend.value);
			try{
				ownerTextChannel.send(toSend.value);
			}catch(e){
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
		}
		//once message sent, textarea is cleared and focused once new (in button clicked case)
		toSend.value = '';
		toSend.focus();
	}
	catch(e){
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
}


	