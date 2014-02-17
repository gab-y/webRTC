'use strict';

var isFirst = 2;
var iceSent = 0;

document.getElementById("send").onclick = sendData;
var textChannel; 
var peerConnection;

var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
  
var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true},
    {'RtpDataChannels': true}
  ]};

var sessionDescription; 
  
var socket = io.connect();
socket.emit('begin');

socket.on('iceCandidate',function(rsdp, rmid, rcand){
	try{
	peerConnection.addIceCandidate(new RTCIceCandidate({
		sdpMLineIndex: rsdp, 
		candidate: rcand
		})
	);
	}catch(e){
		trace(e.message);
	}
});
socket.on('offerSessionDescription', function(offererSessionDescription){
	if(isFirst == 0){
		console.log('received offer');
		try {
		peerConnection = new RTCPeerConnection(pc_config, pc_constraints);
		} catch (e) {
			alert('RTCPeerConnection failed');
		}
		peerConnection.setRemoteDescription( new RTCSessionDescription (offererSessionDescription));
		peerConnection.createAnswer(function (sessionDescription) {
			peerConnection.setLocalDescription(sessionDescription);
			socket.emit('answerToOffer',sessionDescription);
		});
		console.log('offer sent');
		peerConnection.ondatachannel = gotReceiveChannel;
		peerConnection.onicecandidate = sendIceCandidate;
	}
});

socket.on('answerSessionDescription', function(answererSessionDescription){
	console.log('got an answer...');
	if(isFirst == 1){
		console.log('received answer');
		peerConnection.setRemoteDescription( new RTCSessionDescription (answererSessionDescription));
	}
});



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

socket.on('start',function(){

		if(isFirst == 1){
			try {
				peerConnection = new RTCPeerConnection(pc_config, pc_constraints);
			} catch (e) {
			alert('RTCPeerConnection failed');
			}
			try {
				textChannel = peerConnection.createDataChannel("sendDataChannel",{reliable: false});
			} catch (e) {
				alert('Send channel creation failed');
			}
			
			//textChannel.onopen = handletextChannelStateChange;
			//textChannel.onclose = handletextChannelStateChange;
			textChannel.onmessage = handleMessage;
			
			peerConnection.createOffer(function (sessionDescription) {
				peerConnection.setLocalDescription(sessionDescription);
				trace('Offer from localPeerConnection \n' + sessionDescription.sdp);
				socket.emit('offerSessionDescription',sessionDescription);
			},null, { 'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true } });
		}
	peerConnection.onicecandidate = sendIceCandidate;
	
});

function gotReceiveChannel(event) {
	console.log('receive channel');
  textChannel = event.channel;
  textChannel.onmessage = handleMessage;
  //textChannel.onopen = handleReceiveChannelStateChange;
  //textChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event){
	console.log('got message');
	document.getElementById("messages").innerHTML += "<p>"+event.data+"</p>";
}

function sendData(){
		console.log(document.getElementById("toSend").value);
	try{
		//enableMessageInterface(textChannel.readyState == "open");
		textChannel.send(document.getElementById("toSend").value);
	}
	catch(e){
		trace(e.message);
	}
}

function sendIceCandidate(event){
	if(iceSent == 0){
		if(event.candidate){
			console.log(event);
			console.log('sending ice candidate success');
			socket.emit('sendIceCandidate',event.candidate.sdpMLineIndex, event.candidate.sdpMid, event.candidate.candidate);
			iceSent = 1;
		}
		else{
			alert('sending ice candidate failed');
			console.log('sending ice candidate failed');
		}
	}
}

function handletextChannelStateChange(){}
	