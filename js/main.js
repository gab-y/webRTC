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

document.getElementById("name").value = Math.floor(Math.random()*10001);//give a random number name for users

/*** connection globals ***/
//textChannels : webRTC dataChannel objects, to send any kind of data, text, files...
//peerConnections : webRTC peerConnection objects

//connection objects linked to connection that user launched, because he connected first or someone connected after it  				
var ownerTextChannel; 
var ownerPeerConnection;

//connection objects linked to connection that user connected to, with second to last user
var clientTextChannel;
var clientPeerConnection;

var appID = 0;//this app ID. Thanks to it this app ignore its own icecandidates carried by server (see socket.onicecandidate)

/*** connection roles ***/
			//  Client used - Owner used
/*var NONE = 0;//      No           No
var CLIENT = 1;//    Yes          No        First connection is considered with client connection used
var BOTH = 2;//      Yes          Yes
var OWNER = 3;//     No           Yes       Only in disconnection case
*/
var clientUsed = false; var ownerUsed = false;

//var connectionRole = NONE;//initialized with no connections
//The js file is the same whether you are initiator or not but the instructions are not.

//ice servers addresses to open users NATs
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[
	//mozilla's stun
	{'url':'stun:23.21.150.121'},
	//viagenie.ca's turn
    {
      'url': 'turn:numb.viagenie.ca:3478',
      'username': 'gabriel.guilbart@gmail.com',
      'credential': 'soublavetin'
    }	
]} : {'iceServers': [
	//google's stun
	{'url': 'stun:stun.l.google.com:19302'},
	//viagenie.ca's turn
    {
      'url': 'turn:numb.viagenie.ca:3478',
      'username': 'gabriel.guilbart@gmail.com',
      'credential': 'soublavetin'
    }
]};
  
var pc_constraints = null;//constraints about media

  
var socket = io.connect();//connect to server's websocket. Answers if you are first or not :

//connection attempt timers. If it take too much time attempt is cancelled. These timers are used because ICE agent doesn't seem to get aware of misconnections 
var ownerTimer;
var clientTimer;

//JS : socket.on = socket messages listeners

/***
	'new connection' server's message listener
	Send when a navigator connects to the server (but not at this app connection !)
	Changes connectionRole
***/
socket.on('new connection',function(count){
	//connectionRole = connectionRole == NONE ? CLIENT : BOTH;//when a new user connects connectionRole changes
	if(!ownerUsed){
		clientUsed = true;
	}
	//console.log('status : '+connectionRole);
	if(appID == 0){
		appID = count;//getting ID from socket
		console.log("I'm #"+appID+" !");
	}
});

/***
	'Start' server's message listener
	If in initiator (=CLIENT) role, launches connections (owner) and send its ice candidate. If not, do nothing
	Sent when a navigator connected, and there are at least two navigators connected to the server
***/
socket.on('start',function(){
	console.log('receive start');
	if(clientUsed && !ownerUsed){
		//create peer connection (global)
		try {
			ownerPeerConnection = new RTCPeerConnection(pc_config, pc_constraints);
			console.log("RTCPeerConnection succeeded");
		} catch (e) {
			//JS : alert display a window
			alert('RTCPeerConnection failed');
			console.log(e.message);
		}
		//create data channel (global too)
		try {
			ownerTextChannel = ownerPeerConnection.createDataChannel({reliable: false});//reliable : guarantee messages arrive, and their order. Potentially slower. 
		} catch (e) {
			alert('Send channel creation failed');
			console.log(e.message);
		}
		ownerTextChannel.onmessage = ownerMessage;//message receiving listener
		
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
			null);//options - optional
		ownerPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
		
		//10 seconds after a connection is attempted, checks if it's succeed, if not, cancels 
		ownerTimer = setTimeout(function(){
			if(ownerPeerConnection.iceConnectionState == 'checking'){
				console.log('connection seems to have failed');
				//connectionRole = CLIENT;
				ownerUsed = false;
				ownerPeerConnection.close();
				ownerTextChannel.close();
				ownerPeerConnection = null;
				ownerTextChannel = null;
			}
		},10000);
	}
});

/***
	'iceCandidate' server's message listener
	Add to peer connection object the ice candidate received
	Sent each time the server get an ice candidate
***/
socket.on('iceCandidate',function(rsdp, rmid, rcand, senderID){
	if(senderID != appID){//check it's not this app own candidates
		//console.log("received ice candidate from "+senderID+", current state is "+ connectionRole);
		if(clientUsed && !ownerUsed){//if launching a connexion, add candidate to own connection
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
			if(!clientUsed){//if following a connexion, add candidate to remote connection
				try{
				clientPeerConnection.addIceCandidate(new RTCIceCandidate({
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
		socket.emit('sendIceCandidate',event.candidate.sdpMLineIndex, event.candidate.sdpMid, event.candidate.candidate, appID);//JS: candidate object has to be divided
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
	if(!clientUsed){//not communication initiator
		console.log('received offer');
		try {
			clientPeerConnection = new RTCPeerConnection(pc_config, pc_constraints);
			console.log("RTCPeerConnection succeeded");
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
		clientPeerConnection.onicecandidate = sendIceCandidate;//create its own ice candidate an send it to node server
		//note the ON-icecandidate : several ice candidates are returned
		
		//on disconnection callback function 
		//close clientConnection and change connectionRole
		clientPeerConnection.oniceconnectionstatechange = function(){
			if(clientPeerConnection.iceConnectionState == 'disconnected'){
				console.log('client disconnected');
				//connectionRole = connectionRole == BOTH ? OWNER : NONE; 
				clientUsed = false;
				clientPeerConnection.close();
				clientTextChannel.close();
				clientPeerConnection = null;
				clientTextChannel = null;
				socket.emit('reorder');//ask to rebuild connections
			}
			if(clientPeerConnection.iceConnectionState == 'connected'){
				clientUsed = true;
				handleMessage(null,"<i>Connected</i>");
			}
		}
		//10 seconds after a connection is attempted, checks if it's succeed, if not, cancels 
		clientTimer = setTimeout(function(){
			if(clientPeerConnection.iceConnectionState == 'checking'){//if ice agent is still checking connections (not an usual behaviour)
				console.log('connection seems to have failed');
				handleMessage(null, "<i>Connection seems to have failed, please reload</i>");
				//connectionRole = connectionRole == BOTH ? OWNER : NONE;
				clientUsed = false;
				clientPeerConnection.close();
			}
		},10000);
	}
});

/***
	'answerSessionDescription' server's message listener
	Initiator (CLIENT) : set remote description on own connection from answer. Not initiator : nothing.
	Sent when server gets answerer's RTC answer to initiator's offer
***/
socket.on('answerSessionDescription', function(answererSessionDescription){
	if(clientUsed && !ownerUsed){
		console.log('received answer');
		ownerPeerConnection.setRemoteDescription( new RTCSessionDescription (answererSessionDescription));
		trace('Answer received :\n' + answererSessionDescription.sdp);//trace equals to log
		//on disconnection callback function
		//close ownerConnection and change connectionRole
		// !! take several seconds to detect disconnection
		ownerPeerConnection.oniceconnectionstatechange = function(){
			if(ownerPeerConnection.iceConnectionState == 'disconnected'){
				console.log('owner disconnected');
				//connectionRole = CLIENT;
				ownerUsed = false;
				ownerPeerConnection.close();
				ownerTextChannel.close();
				//socket.emit('reorder');//ask to rebuild connections
			}
			if(ownerPeerConnection.iceConnectionState == 'connected'){
				ownerUsed = true;
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
	
	//if(!ownerUsed && !clientUsed){
		clientTextChannel.onopen = function () {
			joinedToClient();//when client channel opens, send through it a connection message
		};
	//}
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
	document.getElementById("messages").innerHTML += "<div>"+data+"</div>";//display message
	if(channel != null && typeof(channel) != 'undefined'){//resend message through the other channel
		try {
			channel.send(data);
		}catch(e){
			trace(e.message);
		}
	}
	
	//displaying : scroll to the last message
	var messages = document.getElementById("messages").getElementsByTagName("div");
	messages[messages.length - 1].scrollIntoView(true);
}

/***
	sendData function
	Send textarea's content through both dataChannels (if exist).
	Called when user click on Send or press Enter. 
***/
function sendData(){
	var toSend = document.getElementById("toSend");
	try{
		handleMessage(null,"<b>"+document.getElementById("name").value+"</b> : "+ toSend.value);
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
	//displaying : once message sent, textarea is cleared and focused once new (in button clicked case)
	toSend.value = '';
	toSend.focus();
}

/***
	joinedToClient function
	Displaying : Send a message as client to tell its connection
	Called when clienttextChannel opens
***/
function joinedToClient(){
	try{
		clientTextChannel.send("<i>A user joined</i>");//"<i>"+document.getElementById("name").value +" joined</i>");
	}
	catch(e){
		trace(e.message);//trace equals to console.log. Comes from Google's adapter.js
	}
}

/***
	on closing navigator listener
	Displaying : send a message to tell its leaving
***/
window.onbeforeunload = function(){
	if(typeof(clientTextChannel) != 'undefined'){
		clientTextChannel.send("<i>"+document.getElementById("name").value+" left. Please wait a little. </i>");
	}
	if(typeof(ownerTextChannel) != 'undefined'){
		ownerTextChannel.send("<i>"+document.getElementById("name").value+" left. Please wait a little. </i>");
	}
}

