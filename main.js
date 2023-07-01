let APP_ID = "43b666f4bb514e4895ccbebeaf09bc09";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomID = urlParams.get('room');

if (!roomID) {
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true 
};

let init = async () => {

    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({ uid, token });

    channel = client.createChannel(roomID);
    await channel.join();

    channel.on('MemberJoined', handleUserJoined);
    channel.on('MemberLeft', handleUserLeft);

    client.on('MessageFromPeer', handleMessageFromPeer);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);     // asking persmission for video and not audio
    document.getElementById('user-1').srcObject = localStream;
}

let handleUserLeft = (MemberID) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
}

let handleMessageFromPeer = async (message, MemberID) => {
    message = JSON.parse(message.text);
    if (message.type === 'offer') {
        createAnswer(MemberID, message.offer);
    }
    if (message.type === 'answer') {
        addAnswer(message.answer);
    }
    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let handleUserJoined = async (MemberID) => {
    console.log('A new user joined the channel: ', MemberID);
    createOffer(MemberID);
}

let createPeerConnection = async (MemberID) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame');

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });     // asking persmission for video and not audio
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberID);
        }
    }
}

let createOffer = async (MemberID) => {

    await createPeerConnection(MemberID);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberID);
}

let createAnswer = async (MemberID, offer) => {

    await createPeerConnection(MemberID);
    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberID);
}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer);
    }
}

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
}

let copyToClipboard = (ola) => {
    navigator.clipboard.writeText(ola)
        .then(() => {
            console.log('Text copied to clipboard');
            alert('Text copied to clipboard');
        })
        .catch((error) => {
            console.error('Failed to copy text:', error);
        });
}

let shareInvitation = () => {
    copyToClipboard(roomID);
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(0,0,0)'; 
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(16, 117, 16,0.9)';
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(0,0,0)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(16, 117, 16,0.9)';
    }
}
window.addEventListener('beforeunload', leaveChannel);
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
document.getElementById('share-btn').addEventListener('click', shareInvitation);
init()