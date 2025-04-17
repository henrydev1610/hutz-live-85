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

// Enhanced Ice servers configuration (STUN/TURN servers with TCP/TLS fallback)
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com'
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      credential: 'webrtc',
      username: 'webrtc'
    }
  ],
  iceCandidatePoolSize: 10,
};

// Advanced RTCPeerConnection configuration
const peerConnectionConfig = {
  ...iceServers,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  // Prefer UDP but allow fallback to TCP/TLS
  iceTransportPolicy: 'all',
};

// Initialize WebRTC for a participant
export const initParticipantWebRTC = async (
  sessionId: string, 
  participantId: string,
  localStream: MediaStream
): Promise<void> => {
  console.log(`Initializing WebRTC for participant ${participantId} in session ${sessionId}`);
  
  // Create WebRTC channel for signaling with multiple fallback mechanisms
  setupSignalingChannel(sessionId, participantId, 'participant');
  
  // Send a notification that we're ready to connect with better retry logic
  const sendReadyMessage = () => {
    console.log("Sending ready-to-connect message");
    sendSignalingMessage({
      type: 'offer',
      sender: participantId,
      payload: { type: 'ready-to-connect' },
      sessionId,
      timestamp: Date.now(),
    });
  };
  
  // Initial send
  sendReadyMessage();
  
  // Retry several times to ensure the message gets through
  const retryInterval = setInterval(sendReadyMessage, 2000);
  setTimeout(() => clearInterval(retryInterval), 10000); // Stop after 10 seconds
  
  // Store local stream for later use with connections
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    console.log("Got local video track for WebRTC");
    // Store local stream
    setLocalStream(localStream);
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

// Create a new peer connection for a participant with improved reliability
export const createPeerConnection = async (
  remoteId: string,
  localStream?: MediaStream,
  onTrack?: (event: RTCTrackEvent) => void
): Promise<RTCPeerConnection> => {
  console.log(`Creating peer connection with ${remoteId}`);
  
  // Clean up any existing connection first
  if (peerConnections[remoteId]) {
    const oldConnection = peerConnections[remoteId].connection;
    console.log(`Closing existing connection for ${remoteId}`);
    oldConnection.close();
    delete peerConnections[remoteId];
  }
  
  const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
  
  // Configure to prefer H.264 codec
  try {
    const transceiver = pc.addTransceiver('video', {
      direction: 'sendrecv',
      streams: localStream ? [localStream] : undefined,
    });
    
    // Set codec preferences with H.264 first
    const codecs = RTCRtpSender.getCapabilities('video')?.codecs;
    if (codecs) {
      // Prioritize H.264 codecs
      const h264Codecs = codecs.filter(codec => 
        codec.mimeType.toLowerCase() === 'video/h264'
      );
      
      const otherCodecs = codecs.filter(codec => 
        codec.mimeType.toLowerCase() !== 'video/h264'
      );
      
      if (h264Codecs.length > 0 && transceiver.setCodecPreferences) {
        transceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
        console.log("Successfully prioritized H.264 codec");
      }
    }
  } catch (error) {
    console.warn("Could not set codec preferences:", error);
  }
  
  // Add local tracks to the connection if available
  if (localStream) {
    localStream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection for ${remoteId}`);
      try {
        if (!pc.getTransceivers().some(t => 
          t.sender.track && t.sender.track.kind === track.kind
        )) {
          pc.addTrack(track, localStream);
        }
      } catch (err) {
        console.error(`Error adding ${track.kind} track:`, err);
      }
    });
  }
  
  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE candidate generated for ${remoteId}:`, event.candidate.protocol);
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
  
  // Handle ICE connection state changes
  pc.oniceconnectionstatechange = () => {
    console.log(`ICE Connection state with ${remoteId}: ${pc.iceConnectionState}`);
    
    // Detailed logging for connection troubleshooting
    switch(pc.iceConnectionState) {
      case 'checking':
        console.log('Checking ICE connection...');
        break;
      case 'connected':
        console.log('ICE connected successfully!');
        break;
      case 'completed':
        console.log('ICE negotiation completed');
        break;
      case 'failed':
        console.error('ICE connection failed');
        // Implement a reconnection strategy
        attemptReconnection(remoteId, localStream, onTrack);
        break;
      case 'disconnected':
        console.warn('ICE connection disconnected');
        // Try to recover automatically
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log('Connection still disconnected, attempting recovery');
            attemptReconnection(remoteId, localStream, onTrack);
          }
        }, 2000);
        break;
      case 'closed':
        console.log('ICE connection closed');
        // Remove from active connections
        delete peerConnections[remoteId];
        break;
    }
  };
  
  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${remoteId}: ${pc.connectionState}`);
    
    // If connection fails, attempt to reconnect
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log(`Connection ${pc.connectionState}, attempting reconnection`);
      attemptReconnection(remoteId, localStream, onTrack);
    }
  };
  
  // Improved track handling from remote peer
  if (onTrack) {
    pc.ontrack = (event) => {
      console.log(`Received ${event.track.kind} track from ${remoteId}, readyState: ${event.track.readyState}`);
      
      // Call the handler immediately
      onTrack(event);
      
      // Monitor track ended events
      event.track.onended = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} ended`);
      };
      
      event.track.onmute = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} muted`);
      };
      
      event.track.onunmute = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} unmuted`);
      };
    };
  }
  
  // Store the connection
  peerConnections[remoteId] = { 
    connection: pc,
    stream: localStream
  };
  
  return pc;
};

// Attempt to reconnect a failed connection
const attemptReconnection = (
  remoteId: string,
  localStream?: MediaStream,
  onTrack?: (event: RTCTrackEvent) => void
) => {
  console.log(`Attempting to reconnect with ${remoteId}`);
  
  // Clean up the existing connection
  if (peerConnections[remoteId]) {
    const oldConnection = peerConnections[remoteId].connection;
    oldConnection.close();
    delete peerConnections[remoteId];
  }
  
  // Wait a moment before trying to reconnect
  setTimeout(async () => {
    try {
      console.log(`Creating new connection for ${remoteId}`);
      await createPeerConnection(remoteId, localStream, onTrack);
      
      // For host, create and send a new offer
      if (onTrack) { // Host has onTrack handler
        const pc = peerConnections[remoteId]?.connection;
        if (pc) {
          const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            iceRestart: true
          });
          
          // Set specific video bandwidth and parameters in SDP
          if (offer.sdp) {
            offer.sdp = setSdpBitrateAndParams(offer.sdp, 1500, true);
          }
          
          await pc.setLocalDescription(offer);
          
          sendSignalingMessage({
            type: 'offer',
            sender: 'host',
            receiver: remoteId,
            payload: pc.localDescription,
            sessionId: '', // Will be filled by the signaling channel
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error(`Reconnection attempt with ${remoteId} failed:`, error);
    }
  }, 1000);
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
      await handleSignalingMessage(message, role, peerId, sessionId);
    };
    
    // Set up Supabase Realtime as backup
    const supabaseChannel = supabase.channel(`webrtc-${sessionId}`)
      .on('broadcast', { event: 'message' }, async (payload) => {
        const message: WebRTCMessage = payload.payload;
        await handleSignalingMessage(message, role, peerId, sessionId);
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

// Handle incoming signaling messages with improved participant reconnection logic
const handleSignalingMessage = async (
  message: WebRTCMessage, 
  role: 'host' | 'participant',
  peerId: string,
  sessionId: string
) => {
  const { type, sender, receiver, payload } = message;
  
  // Filter messages not intended for this peer
  if (receiver && receiver !== peerId) return;
  
  console.log(`Received ${type} from ${sender} for ${receiver || 'broadcast'}`);
  
  if (role === 'host') {
    // Host-specific handling
    if (type === 'offer' && payload.type === 'ready-to-connect') {
      // Participant is ready to connect
      console.log(`Creating connection for participant ${sender}`);
      
      // Check if we already have a connection
      const existingConnection = peerConnections[sender]?.connection;
      if (existingConnection && existingConnection.connectionState === 'connected') {
        console.log(`Already have a connected peer for ${sender}, ignoring duplicate ready message`);
        return;
      }
      
      const pc = await createPeerConnection(sender, undefined, (event) => {
        // When we receive tracks from the participant
        console.log('Received track from participant:', event.track.kind);
        // Forward this to the display/UI
        if (onParticipantTrack) {
          onParticipantTrack(sender, event);
        }
      });
      
      // Create and send an offer with specific configuration
      try {
        // Create offer with options for reliability and quality
        const offerOptions = {
          offerToReceiveAudio: false,
          offerToReceiveVideo: true,
          iceRestart: true,
          voiceActivityDetection: false
        };
        
        const offer = await pc.createOffer(offerOptions);
        
        // Set specific video bandwidth and parameters in SDP
        if (offer.sdp) {
          // Modify SDP to set video bitrate and parameters
          offer.sdp = setSdpBitrateAndParams(offer.sdp, 1500, true);
        }
        
        await pc.setLocalDescription(offer);
        
        // Send offer multiple times to ensure delivery
        const sendOffer = () => {
          sendSignalingMessage({
            type: 'offer',
            sender: peerId,
            receiver: sender,
            payload: pc.localDescription,
            sessionId,
            timestamp: Date.now(),
          });
        };
        
        // Initial send
        sendOffer();
        
        // Retry a few times
        setTimeout(sendOffer, 1000);
        setTimeout(sendOffer, 3000);
        
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    } else if (type === 'participant-leave' || payload?.type === 'participant-leave') {
      // Participant has left, clean up their connection
      console.log(`Participant ${sender} has left, cleaning up their connection`);
      if (peerConnections[sender]) {
        peerConnections[sender].connection.close();
        delete peerConnections[sender];
      }
    }
    else if (type === 'answer') {
      // Handle answer from participant
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          console.log(`Successfully set remote description for ${sender}`);
        } catch (error) {
          console.error(`Error setting remote description for ${sender}:`, error);
        }
      }
    }
    else if (type === 'ice-candidate') {
      // Add ICE candidate from participant
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
          console.log(`Added ICE candidate for ${sender}`);
        } catch (error) {
          console.error(`Error adding ICE candidate for ${sender}:`, error);
        }
      }
    }
  } 
  else if (role === 'participant') {
    // Participant-specific handling
    if (type === 'offer' && payload.type !== 'ready-to-connect') {
      // Received offer from host
      console.log("Received full offer from host");
      try {
        // Clean up any existing connection first
        cleanupWebRTC();
        
        const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
        
        // Configure to prefer H.264 codec
        try {
          const transceiver = pc.addTransceiver('video', {
            direction: 'sendrecv'
          });
          
          // Set codec preferences with H.264 first
          const codecs = RTCRtpSender.getCapabilities('video')?.codecs;
          if (codecs) {
            // Prioritize H.264 codecs
            const h264Codecs = codecs.filter(codec => 
              codec.mimeType.toLowerCase() === 'video/h264'
            );
            
            const otherCodecs = codecs.filter(codec => 
              codec.mimeType.toLowerCase() !== 'video/h264'
            );
            
            if (h264Codecs.length > 0 && transceiver.setCodecPreferences) {
              transceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
              console.log("Successfully prioritized H.264 codec on participant side");
            }
          }
        } catch (error) {
          console.warn("Could not set codec preferences:", error);
        }
        
        // Add local tracks
        if (localStream) {
          console.log("Adding local stream tracks to peer connection");
          localStream.getTracks().forEach(track => {
            try {
              console.log(`Adding ${track.kind} track to participant connection`);
              pc.addTrack(track, localStream);
            } catch (err) {
              console.error(`Error adding track:`, err);
            }
          });
        } else {
          console.warn("No local stream available for participant connection");
        }
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Participant generated ICE candidate:", event.candidate.protocol);
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
        
        // Monitor ICE connection state
        pc.oniceconnectionstatechange = () => {
          console.log(`Participant ICE state: ${pc.iceConnectionState}`);
          
          if (pc.iceConnectionState === 'failed') {
            console.error("Participant ICE connection failed, attempting recovery");
            
            // Try to restart ICE
            if (pc.restartIce) {
              pc.restartIce();
            }
          }
        };
        
        // Set remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        
        // Create and send answer
        const answer = await pc.createAnswer();
        
        // Set specific video bandwidth and parameters in SDP
        if (answer.sdp) {
          // Modify SDP to set video bitrate and parameters
          answer.sdp = setSdpBitrateAndParams(answer.sdp, 1500, true);
        }
        
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
        
        console.log("Successfully created and sent answer");
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    }
    else if (type === 'ice-candidate') {
      // Add ICE candidate from host
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
          console.log("Added host ICE candidate");
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    }
  }
};

// Helper function to modify SDP for better video quality and H.264 preference
const setSdpBitrateAndParams = (sdp: string, bitrate: number, preferH264: boolean): string => {
  let modifiedSdp = sdp;
  
  // Set bitrate
  const videoSection = modifiedSdp.split('m=video')[1]?.split('m=')[0];
  if (videoSection) {
    const lines = modifiedSdp.split('\r\n');
    const videoLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    const videoMLine = lines[videoLineIndex];
    
    if (videoLineIndex >= 0) {
      let insertPos = videoLineIndex + 1;
      while (insertPos < lines.length && !lines[insertPos].startsWith('m=')) {
        insertPos++;
      }
      
      // Add bitrate parameters
      lines.splice(insertPos, 0, `b=AS:${bitrate}`);
      lines.splice(insertPos + 1, 0, `b=TIAS:${bitrate * 1000}`);
      
      // If we want to prefer H.264, rearrange the payload types in the m=video line
      if (preferH264) {
        const mLineParts = videoMLine.split(' ');
        if (mLineParts.length > 3) {
          // Find the H.264 payload types
          const payloadTypes = mLineParts.slice(3);
          let h264PayloadTypes: string[] = [];
          
          // Locate H.264 payload types by searching in the SDP
          for (const pt of payloadTypes) {
            const rtpmapLine = lines.find(line => line.match(new RegExp(`a=rtpmap:${pt}\\s+H264`)));
            if (rtpmapLine) {
              h264PayloadTypes.push(pt);
            }
          }
          
          if (h264PayloadTypes.length > 0) {
            // Remove H.264 payload types from the array
            const filteredTypes = payloadTypes.filter(pt => !h264PayloadTypes.includes(pt));
            // Add H.264 payload types first
            const newPayloadTypes = [...h264PayloadTypes, ...filteredTypes];
            // Reconstruct the m=video line
            mLineParts.splice(3, payloadTypes.length, ...newPayloadTypes);
            lines[videoLineIndex] = mLineParts.join(' ');
          }
        }
      }
      
      // Add specific parameters for better video quality
      const fmtpLineIndex = lines.findIndex(line => line.includes('a=fmtp:') && line.includes('profile-level-id'));
      if (fmtpLineIndex >= 0) {
        // Already has fmtp line, modify it
        const currentLine = lines[fmtpLineIndex];
        if (!currentLine.includes('packetization-mode')) {
          lines[fmtpLineIndex] = `${currentLine};packetization-mode=1`;
        }
      }
      
      modifiedSdp = lines.join('\r\n');
    }
  }
  
  return modifiedSdp;
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
    console.log(`Cleaning up connection for participant ${participantId}`);
    const connection = peerConnections[participantId].connection;
    connection.close();
    delete peerConnections[participantId];
  } else {
    // Close all connections
    console.log(`Cleaning up all WebRTC connections`);
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

// Check if a participant is connected
export const isParticipantConnected = (participantId: string): boolean => {
  const connection = peerConnections[participantId]?.connection;
  if (!connection) return false;
  
  return (
    connection.connectionState === 'connected' || 
    connection.iceConnectionState === 'connected' ||
    connection.iceConnectionState === 'completed'
  );
};

// Get all connected participant IDs
export const getConnectedParticipants = (): string[] => {
  return Object.keys(peerConnections).filter(id => isParticipantConnected(id));
};
