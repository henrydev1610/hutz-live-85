
import { supabase } from '@/integrations/supabase/client';

export type WebRTCMessage = {
  type: 'offer' | 'answer' | 'ice-candidate';
  sender: string;
  receiver?: string;
  payload: any;
  sessionId: string;
  timestamp: number;
};

export type PeerConnection = {
  connection: RTCPeerConnection;
  stream?: MediaStream;
  videoTrack?: MediaStreamTrack;
};

// Store active peer connections
const peerConnections: Record<string, PeerConnection> = {};

// Ice servers configuration (STUN/TURN servers)
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Initialize WebRTC for a participant
export const initParticipantWebRTC = async (
  sessionId: string, 
  participantId: string,
  localStream: MediaStream
): Promise<void> => {
  console.log(`Initializing WebRTC for participant ${participantId} in session ${sessionId}`);
  
  // Create WebRTC channel for signaling
  setupSignalingChannel(sessionId, participantId, 'participant');
  
  // Send a notification that we're ready to connect
  sendSignalingMessage({
    type: 'offer',
    sender: participantId,
    payload: { type: 'ready-to-connect' },
    sessionId,
    timestamp: Date.now(),
  });
  
  // Store local stream for later use with connections
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    console.log("Got local video track for WebRTC");
  }
};

// Initialize WebRTC for a host
export const initHostWebRTC = (
  sessionId: string,
  hostId: string = 'host'
): void => {
  console.log(`Initializing WebRTC for host in session ${sessionId}`);
  
  // Create WebRTC channel for signaling
  setupSignalingChannel(sessionId, hostId, 'host');
};

// Create a new peer connection for a participant
export const createPeerConnection = async (
  remoteId: string,
  localStream?: MediaStream,
  onTrack?: (event: RTCTrackEvent) => void
): Promise<RTCPeerConnection> => {
  console.log(`Creating peer connection with ${remoteId}`);
  
  const pc = new RTCPeerConnection(iceServers);
  
  // Add local tracks to the connection if available
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }
  
  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        type: 'ice-candidate',
        sender: 'host',
        receiver: remoteId,
        payload: event.candidate,
        sessionId: '', // Will be filled by the signaling channel
        timestamp: Date.now(),
      });
    }
  };
  
  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${remoteId}: ${pc.connectionState}`);
  };
  
  // Handle tracks from remote peer
  if (onTrack) {
    pc.ontrack = onTrack;
  }
  
  // Store the connection
  peerConnections[remoteId] = { 
    connection: pc,
    stream: localStream
  };
  
  return pc;
};

// Handle WebRTC signaling through different channels
const setupSignalingChannel = (
  sessionId: string, 
  peerId: string,
  role: 'host' | 'participant'
) => {
  // Use BroadcastChannel for same-origin communication
  try {
    const channel = new BroadcastChannel(`telao-webrtc-${sessionId}`);
    
    channel.onmessage = async (event) => {
      const message: WebRTCMessage = event.data;
      await handleSignalingMessage(message, role, peerId, localStream);
    };
    
    // Set up Supabase Realtime as backup
    const supabaseChannel = supabase.channel(`webrtc-${sessionId}`)
      .on('broadcast', { event: 'message' }, async (payload) => {
        const message: WebRTCMessage = payload.payload;
        await handleSignalingMessage(message, role, peerId, localStream);
      })
      .subscribe();
      
    return () => {
      channel.close();
      supabase.removeChannel(supabaseChannel);
    };
  } catch (error) {
    console.error('Error setting up signaling channel:', error);
  }
};

// Handle incoming signaling messages
const handleSignalingMessage = async (
  message: WebRTCMessage, 
  role: 'host' | 'participant',
  peerId: string,
  localStream?: MediaStream
) => {
  const { type, sender, receiver, payload, sessionId } = message;
  
  // Filter messages not intended for this peer
  if (receiver && receiver !== peerId) return;
  
  console.log(`Received ${type} from ${sender} for ${receiver || 'broadcast'}`);
  
  if (role === 'host') {
    // Host-specific handling
    if (type === 'offer' && payload.type === 'ready-to-connect') {
      // Participant is ready to connect
      const pc = await createPeerConnection(sender, undefined, (event) => {
        // When we receive tracks from the participant
        console.log('Received track from participant:', event.track.kind);
        // Forward this to the display/UI
        if (onParticipantTrack) {
          onParticipantTrack(sender, event);
        }
      });
      
      // Create and send an offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendSignalingMessage({
        type: 'offer',
        sender: peerId,
        receiver: sender,
        payload: pc.localDescription,
        sessionId,
        timestamp: Date.now(),
      });
    }
    else if (type === 'answer') {
      // Handle answer from participant
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      }
    }
    else if (type === 'ice-candidate') {
      // Add ICE candidate from participant
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      }
    }
  } 
  else if (role === 'participant') {
    // Participant-specific handling
    if (type === 'offer' && payload.type !== 'ready-to-connect') {
      // Received offer from host
      const pc = new RTCPeerConnection(iceServers);
      
      // Add local tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: 'ice-candidate',
            sender: peerId,
            receiver: sender,
            payload: event.candidate,
            sessionId,
            timestamp: Date.now(),
          });
        }
      };
      
      // Set remote description (the offer)
      await pc.setRemoteDescription(new RTCSessionDescription(payload));
      
      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      sendSignalingMessage({
        type: 'answer',
        sender: peerId,
        receiver: sender,
        payload: pc.localDescription,
        sessionId,
        timestamp: Date.now(),
      });
      
      // Store the connection
      peerConnections[sender] = { 
        connection: pc,
        stream: localStream
      };
    }
    else if (type === 'ice-candidate') {
      // Add ICE candidate from host
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      }
    }
  }
};

// Send a signaling message through available channels
export const sendSignalingMessage = (message: WebRTCMessage) => {
  try {
    // Try BroadcastChannel
    const channel = new BroadcastChannel(`telao-webrtc-${message.sessionId}`);
    channel.postMessage(message);
    setTimeout(() => channel.close(), 100);
    
    // Try Supabase as backup
    supabase.channel(`webrtc-${message.sessionId}`).send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });
    
  } catch (error) {
    console.error('Error sending signaling message:', error);
  }
};

// Callback for when a participant's track is received
let onParticipantTrack: ((participantId: string, event: RTCTrackEvent) => void) | null = null;

// Set the callback function for participant tracks
export const setOnParticipantTrackCallback = (callback: (participantId: string, event: RTCTrackEvent) => void) => {
  onParticipantTrack = callback;
};

// Helper to get a participant's connection
export const getParticipantConnection = (participantId: string): PeerConnection | undefined => {
  return peerConnections[participantId];
};

// Clean up WebRTC connections
export const cleanupWebRTC = (participantId?: string) => {
  if (participantId && peerConnections[participantId]) {
    const connection = peerConnections[participantId].connection;
    connection.close();
    delete peerConnections[participantId];
  } else {
    // Close all connections
    Object.keys(peerConnections).forEach(id => {
      peerConnections[id].connection.close();
    });
    // Clear the connections object
    Object.keys(peerConnections).forEach(id => {
      delete peerConnections[id];
    });
  }
};

// Global variable to store local stream
let localStream: MediaStream | undefined;

// Set the local stream
export const setLocalStream = (stream: MediaStream) => {
  localStream = stream;
};

