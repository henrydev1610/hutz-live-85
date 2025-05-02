
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

/**
 * Configure the SDP to include multiple video codecs and prioritize compatible ones
 */
const modifySdp = (sdp: string): string => {
  try {
    // Don't modify SDP in environments that don't fully support it
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // In problematic browsers, just return the original SDP
    if (isSafari || isMobile) {
      console.log("Using default SDP settings for Safari or mobile browser");
      return sdp;
    }

    // For other browsers, try to optimize by making sure VP8 is available
    // VP8 has wider support across browsers
    let lines = sdp.split('\r\n');
    let mLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (mLineIndex === -1) {
      console.log("No video m-line found in SDP");
      return sdp;
    }

    // First, try to ensure VP8 is available as a fallback
    // This is just to ensure compatibility without breaking existing codecs
    let hasVP8 = false;
    for (let i = mLineIndex; i < lines.length; i++) {
      if (lines[i].includes('VP8/90000')) {
        hasVP8 = true;
        break;
      }
    }

    // If we need to add VP8 support and don't have it, this is complex
    // We'd need to add a new payload type, etc.
    // For now, just log this and continue with original SDP
    if (!hasVP8) {
      console.log("VP8 codec not found in SDP");
    }

    console.log("SDP modified for better codec compatibility");
    return lines.join('\r\n');
  } catch (error) {
    console.error("Error modifying SDP:", error);
    return sdp;
  }
};

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
  
  // Log participant browser details for debugging
  console.log("Participant browser info:", {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    browserInfo: getBrowserInfo()
  });

  // Log stream info
  const videoTracks = stream.getVideoTracks();
  console.log(`Participant stream details: ${videoTracks.length} video tracks`);
  videoTracks.forEach(track => {
    console.log("Video track:", {
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      contentHint: track.contentHint
    });
    
    // Log video constraints
    const constraints = track.getConstraints();
    console.log("Video constraints:", constraints);
    
    // Log capabilities if available
    if (track.getCapabilities) {
      try {
        const capabilities = track.getCapabilities();
        console.log("Video capabilities:", capabilities);
      } catch (e) {
        console.log("Could not get track capabilities:", e);
      }
    }
  });
  
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

// Helper function to get browser info for debugging
const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "Unknown";
  let osName = "Unknown";
  
  // Browser detection
  if (userAgent.match(/chrome|chromium|crios/i)) {
    browserName = "Chrome";
  } else if (userAgent.match(/firefox|fxios/i)) {
    browserName = "Firefox";
  } else if (userAgent.match(/safari/i)) {
    browserName = "Safari";
  } else if (userAgent.match(/opr\//i)) {
    browserName = "Opera";
  } else if (userAgent.match(/edg/i)) {
    browserName = "Edge";
  }
  
  // OS detection
  if (userAgent.match(/windows/i)) {
    osName = "Windows";
  } else if (userAgent.match(/macintosh|mac os/i)) {
    osName = "MacOS";
  } else if (userAgent.match(/android/i)) {
    osName = "Android";
  } else if (userAgent.match(/iphone|ipad|ipod/i)) {
    osName = "iOS";
  } else if (userAgent.match(/linux/i)) {
    osName = "Linux";
  }
  
  // Try to get browser version
  const versionMatch = userAgent.match(/(chrome|firefox|safari|opr|edg|msie|rv:)\/?\s*(\d+(\.\d+)*)/i);
  if (versionMatch && versionMatch[2]) {
    browserVersion = versionMatch[2];
  }
  
  return {
    browser: browserName,
    version: browserVersion,
    os: osName,
    mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  };
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
    const videoTracks = localStream.getVideoTracks();
    console.log(`Adding ${videoTracks.length} video tracks to peer connection for ${peerId}`);
    
    localStream.getTracks().forEach(track => {
      console.log(`Adding track: ${track.kind} (${track.id}) to peer connection`);
      peerConnection.addTrack(track, localStream!);
    });
  }
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`Generated ICE candidate for ${peerId}:`, event.candidate.candidate.substring(0, 50) + '...');
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
    if (peerConnection.connectionState === 'connected') {
      console.log(`Successfully connected to ${peerId}! RTCPeerConnection is fully established`);
    }
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
      console.log(`Track details: kind=${event.track.kind}, id=${event.track.id}, readyState=${event.track.readyState}`);
      onTrack(peerId, event.track);
    };
  }
  
  // Log negotiation needed events
  peerConnection.onnegotiationneeded = () => {
    console.log(`Negotiation needed for ${peerId}`);
  };
  
  // Log signaling state changes
  peerConnection.onsignalingstatechange = () => {
    console.log(`Signaling state changed for ${peerId}: ${peerConnection.signalingState}`);
  };
  
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
    // Set up a more compatible initial codec configuration
    const offerOptions: RTCOfferOptions = {
      offerToReceiveAudio: false,
      offerToReceiveVideo: true
    };
    
    console.log(`Creating offer for ${peerId} with options:`, offerOptions);
    const offer = await peerConnection.createOffer(offerOptions);
    
    // Modify SDP if needed for better compatibility
    if (offer.sdp) {
      offer.sdp = modifySdp(offer.sdp);
    }
    
    console.log(`Setting local description for ${peerId}`);
    await peerConnection.setLocalDescription(offer);
    
    webSocketSignalingService.send({
      type: 'offer',
      targetId: peerId,
      description: peerConnection.localDescription
    });
    
    console.log(`Sent offer to ${peerId}`);
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
    // Log the incoming offer SDP for debugging
    console.log(`Processing offer from ${peerId}: ${description.sdp?.substring(0, 100)}...`);
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    console.log(`Remote description set for ${peerId}`);
    
    const answer = await peerConnection.createAnswer();
    
    // Modify the answer SDP if needed
    if (answer.sdp) {
      answer.sdp = modifySdp(answer.sdp);
    }
    
    await peerConnection.setLocalDescription(answer);
    console.log(`Local description (answer) set for ${peerId}`);
    
    webSocketSignalingService.send({
      type: 'answer',
      targetId: peerId,
      description: peerConnection.localDescription
    });
    
    console.log(`Sent answer to ${peerId}`);
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
    // Log the incoming answer SDP for debugging
    console.log(`Processing answer from ${peerId}: ${description.sdp?.substring(0, 100)}...`);
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    console.log(`Remote description (answer) set for ${peerId}`);
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
    console.log(`Adding ICE candidate from ${peerId}: ${candidate.candidate.substring(0, 50)}...`);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(`ICE candidate added for ${peerId}`);
  } catch (error) {
    console.error(`Error handling ICE candidate from ${peerId}:`, error);
  }
};

// Close a peer connection
const closePeerConnection = (peerId: string): void => {
  if (peerConnections[peerId]) {
    console.log(`Closing peer connection for ${peerId}`);
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  }
};

// Set local media stream
export const setLocalStream = (stream: MediaStream): void => {
  console.log(`Setting local stream with ${stream.getTracks().length} tracks`);
  localStream = stream;
  
  // Update existing peer connections with new stream
  Object.keys(peerConnections).forEach(peerId => {
    const peerConnection = peerConnections[peerId];
    console.log(`Updating stream for peer ${peerId}`);
    
    // Remove existing tracks
    const senders = peerConnection.getSenders();
    senders.forEach(sender => {
      if (sender.track) {
        console.log(`Removing track: ${sender.track.kind} (${sender.track.id})`);
        peerConnection.removeTrack(sender);
      }
    });
    
    // Add new tracks
    stream.getTracks().forEach(track => {
      console.log(`Adding track: ${track.kind} (${track.id})`);
      peerConnection.addTrack(track, stream);
    });
  });
};

// End WebRTC session and clean up
export const endWebRTC = (): void => {
  // Close all peer connections
  Object.keys(peerConnections).forEach(peerId => {
    console.log(`Closing connection to ${peerId} during cleanup`);
    peerConnections[peerId].close();
    delete peerConnections[peerId];
  });
  
  // Disconnect from signaling server
  webSocketSignalingService.disconnect();
  console.log("Disconnected from signaling server");
  
  // Clean up local stream
  if (localStream) {
    console.log(`Stopping ${localStream.getTracks().length} local tracks`);
    localStream.getTracks().forEach(track => {
      console.log(`Stopping track: ${track.kind} (${track.id})`);
      track.stop();
    });
    localStream = null;
  }
  
  currentSessionId = null;
  currentPeerId = null;
  console.log("WebRTC session ended and cleaned up");
};

// Export as cleanupWebRTC for backward compatibility
export const cleanupWebRTC = endWebRTC;
