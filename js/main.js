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
document.getElementById("name").value = Math.floor(Math.random()*10001);

/*** connection globals ***/
//textChannels : webRTC dataChannel objects, to send any kind of data, text, files...
//peerConnections : webRTC peerConnection objects

//connection objects linked to connection that user launched, because he connected first or someone connected after it  				
var ownerTextChannel; 
var ownerPeerConnection;

//connection objects linked to connection that user connected to, with second to last user
var clientTextChannel;
var clientPeerConnection;

/*** connection roles ***/
			//  Client used - Owner used
var NONE = 0;//      No           No
var CLIENT = 1;//    Yes          No        First connection is considered with client connection used
var BOTH = 2;//      Yes          Yes
var OWNER = 3;//     No           Yes       Only in disconnection case
var connectionRole = NONE;//initialized with no connections
//The js file is the same whether you are initiator or not but the instructions are not.

//ice servers addresses to open users NATs
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} :
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
  
var pc_constraints = null;//constraints about media
  
var socket = io.connect();//connect to server's websocket. Answers if you are first or not :

//JS : socket.on = socket messages listeners

/***
	'new connection' server's message listener
	Send when a navigator connects to the server
	Increments role, from 0 follower, 1 initiator, more : full
***/
socket.on('new connection',function(){
	connectionRole = connectionRole == NONE ? CLIENT : BOTH; 
	console.log('status : '+connectionRole);
});

/***
	'Start' server's message listener
	If in initiator role, launches connections (owner) and send its ice candidate. If not, do nothing
	Sent when a navigator connected, and there are at least two navigators connected to the server
***/
socket.on('start',function(){
	console.log('receive start');
	if(connectionRole == CLIENT){
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
		ownerTextChannel.onopen = function () {
			//TODO : on connection behaviour : enabling typing, 'person connected', etc
			joined();
		};
		
		//creates an offer and a session description and send them
		//JS : finally, what are createOffer parameters ?
		ownerPeerConnection.createOffer(
			//success callback - mandatory
			function (sessionDescription) {
				ownerPeerConnection.setLocalDescription(sessionDescription);
				trace('Offer to be sent :\n' + sessionDescription.sdp);//trace equals to console.log. Comes from Google's adapter.js
				socket.emit('offerSessionDescription',sessionDescription);
			},
			//failure callback - mandatory
			function (){
				console.log("cannot create offer");
				alert("cannot create offer");
			},
			null);//options - optionnal
		//ownerPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
	}
});

/***
	'iceCandidate' server's message listener
	Add to peer connection object the ice candidate received
	Sent each time the server get an ice candidate
***/
socket.on('iceCandidate',function(rsdp, rmid, rcand){
	console.log("received ice candidate, current state is "+ connectionRole);
	if(connectionRole == CLIENT){//if launching a connexion, add candidate to own connection
		try{
		ownerPeerConnection.addIceCandidate(new RTCIceCandidate({
			sdpMLineIndex: rsdp, 
			sdpMid: rmid,
			candidate: rcand
			}));
		}catch(e){
			alert('adding ice candidate failed');
			console.log("adding ice candidate failed");
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
	}
	else{ 
		if(connectionRole == NONE || connectionRole == OWNER){//if following a connexion, add candidate to remote connection
			try{
			clientPeerConnection.addIceCandidate(new RTCIceCandidate({
				sdpMLineIndex: rsdp,
				sdpMid: rmid,
				candidate: rcand
				}));
			clientPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
			}catch(e){
				alert('adding ice candidate failed');
				console.log("adding ice candidate failed");
				trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
			}
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
		socket.emit('sendIceCandidate',event.candidate.sdpMLineIndex, event.candidate.sdpMid, event.candidate.candidate);//JS: candidate object has to be divided
	}
	else{
		console.log('no more candidates ?');
	}
}

/***
	'offerSessionDescription' server's message listener
	Not initiator : create its own connections' objects for remote connection, create answer and ice candidate and send 
	Sent when server gets initiator's RTC offer
***/
socket.on('offerSessionDescription', function(offererSessionDescription){
	if(connectionRole == NONE || connectionRole == OWNER){
		console.log('received offer');
		try {
			clientPeerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			console.log("RTCPeerConnection failed");
			alert('RTCPeerConnection failed');
			trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
		}
		//set remote description from the one received
		clientPeerConnection.setRemoteDescription( new RTCSessionDescription (offererSessionDescription));
		trace('Offer received :\n' + offererSessionDescription.sdp);//trace equals to log
		
		//create session description from our browser
		clientPeerConnection.createAnswer(
			//success callback
			function (sessionDescription) {
				clientPeerConnection.setLocalDescription(sessionDescription);
				trace('Answer to be sent :\n' + sessionDescription.sdp);//trace equals to log 
				socket.emit('answerToOffer',sessionDescription);
			},
			//failure callback
			function (){
				console.log("cannot create offer");
				alert("cannot create offer");
			},
			null);//options
		
		console.log('answer sent');
		clientPeerConnection.ondatachannel = gotReceiveChannel;//create a listener for receiving data channels
		//clientPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
		clientPeerConnection.oniceconnectionstatechange = function(){
			if(clientPeerConnection.iceConnectionState == 'disconnected'){
				console.log('client disconnected');
				connectionRole = connectionRole == BOTH ? OWNER : NONE;
				clientPeerConnection.close();
				clientTextChannel.close();
				socket.emit('reorder');
			}
		}
	}
});

/***
	'answerSessionDescription' server's message listener
	Initiator : set remote description on own connection from answer. Not initiator : nothing.
	Sent when server gets answerer's RTC answer to initiator's offer
***/
socket.on('answerSessionDescription', function(answererSessionDescription){
	if(connectionRole == CLIENT){
		console.log('received answer');
		ownerPeerConnection.setRemoteDescription( new RTCSessionDescription (answererSessionDescription));
		trace('Answer received :\n' + answererSessionDescription.sdp);//trace equals to log
		
		ownerPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		
		ownerPeerConnection.oniceconnectionstatechange = function(){
			if(ownerPeerConnection.iceConnectionState == 'disconnected'){
				console.log('owner disconnected');
				connectionRole = CLIENT;
				ownerPeerConnection.close();
				ownerTextChannel.close();
				socket.emit('reorder');
			}
		}		
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
	clientTextChannel.onmessage = clientMessage;//when the app gets a message, call clientMessage, which displays it and transmit it through other connection
	clientTextChannel.onopen = function () {
		//TODO : on connection behaviour : enabling typing, 'person connected', etc
		joined();
	};
}
/***
	handling messages functions
	dataChannel.onmessage listeners. Display received messages and transmit it to the other channel.
	Set on offerSessionDescription socket listener for initiator and gotReceiveChannel for non-initiator
***/
function ownerMessage(event){
	handleMessage(clientTextChannel,event.data);
}

function clientMessage(event){
	handleMessage(ownerTextChannel,event.data);
}
	
function handleMessage(channel,data){
	console.log('got message');
	document.getElementById("messages").innerHTML += "<p>"+data+"</p>";
	if(typeof(channel) != 'undefined'){
		try {
			channel.send(data);
		}catch(e){
			trace(e.message);
		}
	}
}

/***
	sendData function
	Send textarea's content through both dataChannels (if exist).
	Called when user click on Send or press Enter. 
***/
function sendData(){
	var toSend = document.getElementById("toSend");
	try{
		document.getElementById("messages").innerHTML += "<p><b>"+document.getElementById("name").value+"</b> : "+ toSend.value +"</p>";
		if(typeof(clientTextChannel) != 'undefined'){
			clientTextChannel.send("<b>"+document.getElementById("name").value+"</b> : "+toSend.value);
		}
		if(typeof(ownerTextChannel) != 'undefined'){
			ownerTextChannel.send("<b>"+document.getElementById("name").value+"</b> : "+toSend.value);
		}
	}
	catch(e){
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
	//once message sent, textarea is cleared and focused once new (in button clicked case)
	toSend.value = '';
	toSend.focus();
}

function joined(){
	try{
	document.getElementById("messages").innerHTML += "<p><i>"+document.getElementById("name").value +" joined</i></p>";
		/*if(typeof(clientTextChannel) != 'undefined'){
			clientTextChannel.send("<i>"+document.getElementById("name").value +" joined</i>");
		}*/
		if(typeof(ownerTextChannel) != 'undefined'){
			ownerTextChannel.send("<i>"+document.getElementById("name").value +" joined</i>");
		}
	}
	catch(e){
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
}

window.onbeforeunload = function(){
	if(typeof(clientTextChannel) != 'undefined'){
		clientTextChannel.send("<b>"+document.getElementById("name").value+"</b> left");
	}
	if(typeof(ownerTextChannel) != 'undefined'){
		ownerTextChannel.send("<b>"+document.getElementById("name").value+"</b> left");
	}
}

