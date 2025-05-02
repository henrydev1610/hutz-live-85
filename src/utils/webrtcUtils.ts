import { webSocketSignalingService, SignalingMessage } from '@/services/WebSocketSignalingService';

const PEER_CONNECTION_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    // Additional TURN servers to help with difficult NAT situations
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Keep track of active peer connections
const peerConnections: Record<string, RTCPeerConnection> = {};
let localStream: MediaStream | null = null;
let currentSessionId: string | null = null;
let currentPeerId: string | null = null;

// Initialize signaling and WebRTC for a host
export const initHostWebRTC = async (
  sessionId: string,
  onTrack: (participantId: string, track: MediaStreamTrack) => void
): Promise<void> => {
  // Generate a unique host ID
  currentPeerId = 'host';
  currentSessionId = sessionId;
  
  // Connect to signaling server
  try {
    const connected = await webSocketSignalingService.connect(sessionId, currentPeerId);
    if (!connected) {
      console.error('Failed to connect to signaling server');
      return;
    }
  } catch (error) {
    console.error('Error connecting to signaling server:', error);
    return;
  }
  
  // Set up signaling event handlers
  webSocketSignalingService.on('user-joined', (message: SignalingMessage) => {
    if (message.peerId && message.peerId !== currentPeerId) {
      console.log(`User joined: ${message.peerId}`);
      handleNewParticipant(message.peerId);
    }
  });
  
  webSocketSignalingService.on('user-left', (message: SignalingMessage) => {
    if (message.peerId && message.peerId !== currentPeerId) {
      console.log(`User left: ${message.peerId}`);
      closePeerConnection(message.peerId);
    }
  });
  
  webSocketSignalingService.on('offer', async (message: SignalingMessage) => {
    if (message.senderId && message.description) {
      console.log(`Received offer from: ${message.senderId}`);
      await handleOffer(message.senderId, message.description);
    }
  });
  
  webSocketSignalingService.on('answer', async (message: SignalingMessage) => {
    if (message.senderId && message.description) {
      console.log(`Received answer from: ${message.senderId}`);
      await handleAnswer(message.senderId, message.description);
    }
  });
  
  webSocketSignalingService.on('candidate', async (message: SignalingMessage) => {
    if (message.senderId && message.candidate) {
      console.log(`Received ICE candidate from: ${message.senderId}`);
      await handleCandidate(message.senderId, message.candidate);
    }
  });
  
  // Function to handle new participants
  function handleNewParticipant(participantId: string): void {
    // Create a new peer connection for this participant
    createPeerConnection(participantId, onTrack);
    
    // Create and send offer to the participant
    createAndSendOffer(participantId);
  }

  // Initialize with existing participants if any
  webSocketSignalingService.on('peer-list', (message: SignalingMessage) => {
    if (message.peers && Array.isArray(message.peers)) {
      message.peers.forEach(peerId => {
        console.log(`Existing peer in room: ${peerId}`);
        handleNewParticipant(peerId);
      });
    }
  });
};

// Initialize signaling and WebRTC for a participant
export const initParticipantWebRTC = async (
  sessionId: string,
  participantId: string,
  stream: MediaStream,
): Promise<void> => {
  localStream = stream;
  currentSessionId = sessionId;
  currentPeerId = participantId;
  
  // Connect to signaling server
  try {
    const connected = await webSocketSignalingService.connect(sessionId, participantId);
    if (!connected) {
      console.error('Failed to connect to signaling server');
      return;
    }
  } catch (error) {
    console.error('Error connecting to signaling server:', error);
    return;
  }
  
  // Set up signaling event handlers
  webSocketSignalingService.on('offer', async (message: SignalingMessage) => {
    if (message.senderId && message.description) {
      console.log(`Received offer from: ${message.senderId}`);
      await handleOffer(message.senderId, message.description);
    }
  });
  
  webSocketSignalingService.on('answer', async (message: SignalingMessage) => {
    if (message.senderId && message.description) {
      console.log(`Received answer from: ${message.senderId}`);
      await handleAnswer(message.senderId, message.description);
    }
  });
  
  webSocketSignalingService.on('candidate', async (message: SignalingMessage) => {
    if (message.senderId && message.candidate) {
      console.log(`Received ICE candidate from: ${message.senderId}`);
      await handleCandidate(message.senderId, message.candidate);
    }
  });
  
  // Create and send offer to the host
  createPeerConnection('host', null);
  createAndSendOffer('host');
};

// Create a peer connection
const createPeerConnection = (
  peerId: string, 
  onTrack: ((participantId: string, track: MediaStreamTrack) => void) | null
): RTCPeerConnection => {
  // Close existing connection if any
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
  }
  
  // Create new connection
  const peerConnection = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
  peerConnections[peerId] = peerConnection;
  
  // Add local tracks to the connection if available
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream!);
    });
  }
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      webSocketSignalingService.send({
        type: 'candidate',
        targetId: peerId,
        candidate: event.candidate
      });
    }
  };
  
  // Set up connection state change handler
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state for ${peerId}: ${peerConnection.connectionState}`);
  };
  
  // Set up ICE connection state change handler
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`);
    
    if (peerConnection.iceConnectionState === 'failed') {
      console.log(`ICE connection failed for ${peerId}, restarting...`);
      try {
        peerConnection.restartIce();
      } catch (e) {
        console.error('Error restarting ICE:', e);
        
        // Recreate the connection
        setTimeout(() => {
          closePeerConnection(peerId);
          createPeerConnection(peerId, onTrack);
          createAndSendOffer(peerId);
        }, 1000);
      }
    }
  };
  
  // Set up track handler
  if (onTrack) {
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}:`, event.track);
      onTrack(peerId, event.track);
    };
  }
  
  return peerConnection;
};

// Create and send an offer
const createAndSendOffer = async (peerId: string): Promise<void> => {
  const peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.error(`No peer connection for ${peerId}`);
    return;
  }
  
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    webSocketSignalingService.send({
      type: 'offer',
      targetId: peerId,
      description: peerConnection.localDescription
    });
  } catch (error) {
    console.error(`Error creating offer for ${peerId}:`, error);
  }
};

// Handle an incoming offer
const handleOffer = async (peerId: string, description: RTCSessionDescription): Promise<void> => {
  // Create peer connection if it doesn't exist
  if (!peerConnections[peerId]) {
    createPeerConnection(peerId, null);
  }
  
  const peerConnection = peerConnections[peerId];
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    webSocketSignalingService.send({
      type: 'answer',
      targetId: peerId,
      description: peerConnection.localDescription
    });
  } catch (error) {
    console.error(`Error handling offer from ${peerId}:`, error);
  }
};

// Handle an incoming answer
const handleAnswer = async (peerId: string, description: RTCSessionDescription): Promise<void> => {
  const peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.error(`No peer connection for ${peerId}`);
    return;
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  } catch (error) {
    console.error(`Error handling answer from ${peerId}:`, error);
  }
};

// Handle an incoming ICE candidate
const handleCandidate = async (peerId: string, candidate: RTCIceCandidate): Promise<void> => {
  const peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.error(`No peer connection for ${peerId}`);
    return;
  }
  
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error(`Error handling ICE candidate from ${peerId}:`, error);
  }
};

// Close a peer connection
const closePeerConnection = (peerId: string): void => {
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  }
};

// Set local media stream
export const setLocalStream = (stream: MediaStream): void => {
  localStream = stream;
  
  // Update existing peer connections with new stream
  Object.keys(peerConnections).forEach(peerId => {
    const peerConnection = peerConnections[peerId];
    
    // Remove existing tracks
    const senders = peerConnection.getSenders();
    senders.forEach(sender => {
      if (sender.track) {
        peerConnection.removeTrack(sender);
      }
    });
    
    // Add new tracks
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
  });
};

// End WebRTC session and clean up
export const endWebRTC = (): void => {
  // Close all peer connections
  Object.keys(peerConnections).forEach(peerId => {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  });
  
  // Disconnect from signaling server
  webSocketSignalingService.disconnect();
  
  // Clean up local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  currentSessionId = null;
  currentPeerId = null;
};
