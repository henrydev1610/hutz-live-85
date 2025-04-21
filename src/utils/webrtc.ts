
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

// Enhanced Ice servers configuration with multiple fallbacks for better mobile support
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
    },
    // These Twilio TURN servers are public and provide better support for mobile networks
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
      credential: 'w1uxM55V9yYoqyVFjt+KXc/q6MrZ0nhrpLbuzCa1aes='
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
      credential: 'w1uxM55V9yYoqyVFjt+KXc/q6MrZ0nhrpLbuzCa1aes='
    },
    {
      urls: 'turn:global.turn.twilio.com:443?transport=tcp',
      username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
      credential: 'w1uxM55V9yYoqyVFjt+KXc/q6MrZ0nhrpLbuzCa1aes='
    },
    // Additional free TURN servers for even better coverage
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ],
  iceCandidatePoolSize: 10,
};

// Advanced RTCPeerConnection configuration with adaptive settings for mobile
const peerConnectionConfig = {
  ...iceServers,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  // Allow any transport type to support more network conditions
  iceTransportPolicy: 'all',
  // Enable DTLS for security
  dtlsTransportPolicy: 'all',
};

// Track disconnection events for cleanup
const disconnectionEventHandlers: Record<string, () => void> = {};

// Initialize WebRTC for a participant with a more robust approach
export const initParticipantWebRTC = async (
  sessionId: string, 
  participantId: string,
  localStream: MediaStream
): Promise<void> => {
  console.log(`Initializing WebRTC for participant ${participantId} in session ${sessionId}`);
  
  // Setup multiple signaling channels for redundancy
  setupSignalingChannel(sessionId, participantId, 'participant');
  
  // Send a ready-to-connect message through all available channels with retry
  const sendReadyMessage = () => {
    console.log("Sending ready-to-connect message");
    sendSignalingMessage({
      type: 'offer',
      sender: participantId,
      payload: { type: 'ready-to-connect' },
      sessionId,
      timestamp: Date.now(),
    });
    
    // Also use localStorage as a backup signaling method
    try {
      window.localStorage.setItem(`telao-ready-${sessionId}-${participantId}`, JSON.stringify({
        type: 'ready-to-connect',
        sender: participantId,
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        try {
          window.localStorage.removeItem(`telao-ready-${sessionId}-${participantId}`);
        } catch (e) {
          // Ignore errors
        }
      }, 30000);
    } catch (e) {
      console.warn("LocalStorage backup method failed:", e);
    }
  };
  
  // Initial send
  sendReadyMessage();
  
  // Retry multiple times with increasing intervals to ensure delivery
  setTimeout(sendReadyMessage, 1000);
  setTimeout(sendReadyMessage, 3000);
  setTimeout(sendReadyMessage, 7000);
  
  // Store local stream reference
  if (localStream) {
    console.log("Got local stream for WebRTC");
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      console.log("Got local video track for WebRTC, readyState:", videoTrack.readyState);
      setLocalStream(localStream);
    } else {
      console.warn("No video track found in local stream");
    }
  } else {
    console.error("No local stream available for WebRTC");
  }

  // Setup disconnect handling for proper cleanup
  setupDisconnectHandling(sessionId, participantId);
};

// Setup reliable disconnect handling across multiple mechanisms
const setupDisconnectHandling = (sessionId: string, participantId: string) => {
  if (disconnectionEventHandlers[participantId]) {
    window.removeEventListener('beforeunload', disconnectionEventHandlers[participantId]);
  }
  
  const disconnectHandler = () => {
    console.log(`Participant ${participantId} disconnecting from session ${sessionId}`);
    
    // Send disconnect message through WebRTC signaling
    sendSignalingMessage({
      type: 'offer',
      sender: participantId,
      payload: { type: 'participant-leave' },
      sessionId,
      timestamp: Date.now(),
    });
    
    // Also use localStorage for redundancy
    try {
      window.localStorage.setItem(`telao-leave-${sessionId}-${participantId}`, JSON.stringify({
        type: 'participant-leave',
        id: participantId,
        timestamp: Date.now()
      }));
      
      // This one we don't remove - it needs to persist for disconnect detection
    } catch (e) {
      console.warn("Could not store disconnect info in localStorage:", e);
    }
    
    // Try BroadcastChannel as well
    try {
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      channel.postMessage({
        type: 'participant-leave',
        id: participantId,
        timestamp: Date.now()
      });
      setTimeout(() => channel.close(), 100);
    } catch (e) {
      console.warn("Could not send disconnect via BroadcastChannel:", e);
    }
  };
  
  disconnectionEventHandlers[participantId] = disconnectHandler;
  window.addEventListener('beforeunload', disconnectHandler);
  
  // Also handle page visibility changes to better detect mobile background/foreground transitions
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // When page goes to background, send a heartbeat to maintain connection
      console.log("Page hidden, sending heartbeat");
      try {
        window.localStorage.setItem(`telao-heartbeat-${sessionId}-${participantId}`, Date.now().toString());
      } catch (e) {
        // Ignore errors
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', disconnectHandler);
  };
};

// Initialize WebRTC for a host
export const initHostWebRTC = (
  sessionId: string,
  hostId: string = 'host'
): void => {
  console.log(`Initializing WebRTC for host in session ${sessionId}`);
  
  // Create WebRTC channel for signaling using multiple mechanisms
  setupSignalingChannel(sessionId, hostId, 'host');
  
  // Also check localStorage for any waiting participants
  checkLocalStorageForParticipants(sessionId);
};

// Check localStorage for any participants waiting to connect
const checkLocalStorageForParticipants = (sessionId: string) => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`telao-ready-${sessionId}-`) || 
      key.startsWith(`telao-join-${sessionId}-`)
    );
    
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.sender || data.id) {
          const participantId = data.sender || data.id;
          console.log(`Found waiting participant ${participantId} in localStorage`);
          
          // Trigger the host's participant handler
          if (onParticipantConnectRequest) {
            onParticipantConnectRequest(participantId);
          }
        }
      } catch (e) {
        console.warn("Error parsing localStorage data:", e);
      }
    }
  } catch (e) {
    console.warn("Error checking localStorage for participants:", e);
  }
};

// Create a new peer connection with enhanced reliability for mobile
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
  
  // Create new connection with optimized mobile configuration
  const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
  
  // Try to configure for better mobile compatibility with H.264
  try {
    const transceiver = pc.addTransceiver('video', {
      direction: 'sendrecv',
      streams: localStream ? [localStream] : undefined,
    });
    
    // Set codec preferences with fallbacks for mobile
    const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
    if (codecs && transceiver.setCodecPreferences) {
      // Get H.264 codecs first, then VP8 as fallback, then others
      const h264Codecs = codecs.filter(codec => 
        codec.mimeType.toLowerCase() === 'video/h264'
      );
      
      const vp8Codecs = codecs.filter(codec => 
        codec.mimeType.toLowerCase() === 'video/vp8'
      );
      
      const otherCodecs = codecs.filter(codec => 
        codec.mimeType.toLowerCase() !== 'video/h264' && 
        codec.mimeType.toLowerCase() !== 'video/vp8'
      );
      
      // Prioritize codecs for better mobile compatibility
      if (h264Codecs.length > 0) {
        // On mobile, H.264 often has hardware acceleration
        transceiver.setCodecPreferences([...h264Codecs, ...vp8Codecs, ...otherCodecs]);
        console.log("Successfully prioritized H.264 codec for better mobile compatibility");
      } else if (vp8Codecs.length > 0) {
        // VP8 as fallback
        transceiver.setCodecPreferences([...vp8Codecs, ...otherCodecs]);
        console.log("H.264 not available, using VP8 instead");
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
  
  // Handle ICE candidates with more detailed logging
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE candidate generated for ${remoteId}:`, 
        event.candidate.protocol, 
        event.candidate.type, 
        event.candidate.address);
      
      sendSignalingMessage({
        type: 'ice-candidate',
        sender: 'host',
        receiver: remoteId,
        payload: event.candidate,
        sessionId: '', // Will be filled by the signaling channel
        timestamp: Date.now(),
      });
      
      // Also store in localStorage as backup if it's a relay candidate (most reliable)
      if (event.candidate.type === 'relay') {
        try {
          window.localStorage.setItem(`telao-ice-host-${remoteId}-${Date.now()}`, JSON.stringify({
            type: 'ice-candidate',
            sender: 'host',
            receiver: remoteId,
            payload: event.candidate,
            timestamp: Date.now(),
          }));
          
          // Clean up after a while
          setTimeout(() => {
            try {
              window.localStorage.removeItem(`telao-ice-host-${remoteId}-${Date.now()}`);
            } catch (e) {
              // Ignore errors
            }
          }, 30000);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }
  };
  
  // Handle ICE connection state changes with reconnection logic
  pc.oniceconnectionstatechange = () => {
    console.log(`ICE Connection state with ${remoteId}: ${pc.iceConnectionState}`);
    
    // Detailed logging for connection troubleshooting
    switch(pc.iceConnectionState) {
      case "checking":
        console.log('Checking ICE connection...');
        break;
      case "connected":
        console.log('ICE connected successfully!');
        break;
      case "completed":
        console.log('ICE negotiation completed');
        break;
      case "failed":
        console.error('ICE connection failed, attempting reconnection');
        attemptReconnection(remoteId, localStream, onTrack);
        break;
      case "disconnected":
        console.warn('ICE connection disconnected, attempting recovery');
        // Try to recover automatically with shorter timeout
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            attemptReconnection(remoteId, localStream, onTrack);
          }
        }, 1000);
        break;
      case "closed":
        console.log('ICE connection closed');
        delete peerConnections[remoteId];
        break;
    }
  };
  
  // Handle connection state changes with more detailed reporting
  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${remoteId}: ${pc.connectionState}`);
    
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log(`Connection ${pc.connectionState}, attempting reconnection`);
      attemptReconnection(remoteId, localStream, onTrack);
    }
  };
  
  // Improved track handling from remote peer with monitoring
  if (onTrack) {
    pc.ontrack = (event) => {
      console.log(`Received ${event.track.kind} track from ${remoteId}, readyState: ${event.track.readyState}`);
      
      // Call the handler immediately
      onTrack(event);
      
      // Monitor track health and status
      const monitorTrack = setInterval(() => {
        if (event.track.readyState !== 'live') {
          console.log(`Track ${event.track.kind} from ${remoteId} is no longer live (${event.track.readyState})`);
          
          if (peerConnections[remoteId] && pc.connectionState === 'connected') {
            // If connection is still active but track isn't, try to recover
            console.log(`Attempting to recover dead track for ${remoteId}`);
            
            // Signal that we need a new track
            sendSignalingMessage({
              type: 'offer',
              sender: 'host',
              receiver: remoteId,
              payload: { type: 'request-new-track' },
              sessionId: '', // Will be filled by the signaling channel
              timestamp: Date.now(),
            });
          }
          
          clearInterval(monitorTrack);
        }
      }, 2000);
      
      // Track-specific event handlers
      event.track.onended = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} ended`);
        clearInterval(monitorTrack);
      };
      
      event.track.onmute = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} muted`);
      };
      
      event.track.onunmute = () => {
        console.log(`Track ${event.track.kind} from ${remoteId} unmuted`);
      };
    };
  }
  
  // Store the connection for future reference
  peerConnections[remoteId] = { 
    connection: pc,
    stream: localStream
  };
  
  return pc;
};

// Callback for participant connect requests
let onParticipantConnectRequest: ((participantId: string) => void) | null = null;

// Set the callback for participant connect requests
export const setOnParticipantConnectRequestCallback = (callback: (participantId: string) => void) => {
  onParticipantConnectRequest = callback;
};

// Attempt to reconnect a failed connection with graduated backoff
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
          
          // Set specific video bandwidth and parameters in SDP for better mobile quality
          if (offer.sdp) {
            offer.sdp = setSdpBitrateAndParams(offer.sdp, 800, true);
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

// Handle WebRTC signaling through multiple channels for redundancy
const setupSignalingChannel = (
  sessionId: string, 
  peerId: string,
  role: 'host' | 'participant'
) => {
  // 1. Use BroadcastChannel for same-origin communication (most reliable when available)
  try {
    const channel = new BroadcastChannel(`telao-webrtc-${sessionId}`);
    
    channel.onmessage = async (event) => {
      const message: WebRTCMessage = event.data;
      await handleSignalingMessage(message, role, peerId, sessionId);
    };
    
    console.log("BroadcastChannel signaling established");
  } catch (error) {
    console.warn('BroadcastChannel not supported, falling back to alternatives:', error);
  }
  
  // 2. Set up Supabase Realtime as backup
  try {
    const supabaseChannel = supabase.channel(`webrtc-${sessionId}`)
      .on('broadcast', { event: 'message' }, async (payload) => {
        const message: WebRTCMessage = payload.payload;
        await handleSignalingMessage(message, role, peerId, sessionId);
      })
      .subscribe();
    
    console.log("Supabase Realtime signaling established");
  } catch (error) {
    console.warn('Supabase Realtime setup failed:', error);
  }
  
  // 3. Set up localStorage polling as final fallback (especially for mobile)
  const localStorageCheckInterval = setInterval(() => {
    try {
      // Check for ICE candidates
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(`telao-ice-`) && 
        (role === 'host' ? key.includes(peerId) : key.includes('host'))
      );
      
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.type === 'ice-candidate') {
            // Process message
            handleSignalingMessage(data, role, peerId, sessionId);
            // Remove processed message
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // For host, also check for participant connections
      if (role === 'host') {
        checkLocalStorageForParticipants(sessionId);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, 1000);
  
  // Return cleanup function
  return () => {
    clearInterval(localStorageCheckInterval);
  };
};

// Handle incoming signaling messages with improved participant recovery
const handleSignalingMessage = async (
  message: WebRTCMessage, 
  role: 'host' | 'participant',
  peerId: string,
  sessionId: string
) => {
  const { type, sender, receiver, payload } = message;
  
  // Filter messages not intended for this peer
  if (receiver && receiver !== peerId && receiver !== '*') return;
  
  console.log(`Received ${type} from ${sender} for ${receiver || 'broadcast'}`);
  
  if (role === 'host') {
    // Host-specific handling
    if (type === 'offer' && payload?.type === 'ready-to-connect') {
      // Participant is ready to connect
      console.log(`Creating connection for participant ${sender}`);
      
      // Check if we already have a connected peer
      const existingConnection = peerConnections[sender]?.connection;
      if (existingConnection && existingConnection.connectionState === 'connected') {
        console.log(`Already have a connected peer for ${sender}, ignoring duplicate ready message`);
        return;
      }
      
      // Notify about the connection request (e.g., to update UI)
      if (onParticipantConnectRequest) {
        onParticipantConnectRequest(sender);
      }
      
      const pc = await createPeerConnection(sender, undefined, (event) => {
        // When we receive tracks from the participant
        console.log('Received track from participant:', event.track.kind);
        // Forward this to the display/UI
        if (onParticipantTrack) {
          onParticipantTrack(sender, event);
        }
      });
      
      // Create and send an offer
      try {
        // Create offer with options for reliability and quality
        const offerOptions = {
          offerToReceiveAudio: false,
          offerToReceiveVideo: true,
          iceRestart: true,
          voiceActivityDetection: false
        };
        
        const offer = await pc.createOffer(offerOptions);
        
        // Optimize for mobile - use lower bitrate and H.264 preference
        if (offer.sdp) {
          // Use lower bitrate for mobile compatibility (800kbps)
          offer.sdp = setSdpBitrateAndParams(offer.sdp, 800, true);
        }
        
        await pc.setLocalDescription(offer);
        
        // Send offer through all available channels
        sendSignalingMessage({
          type: 'offer',
          sender: peerId,
          receiver: sender,
          payload: pc.localDescription,
          sessionId,
          timestamp: Date.now(),
        });
        
        // Also send via localStorage for reliability
        try {
          window.localStorage.setItem(`telao-offer-${sessionId}-${sender}`, JSON.stringify({
            type: 'offer',
            sender: peerId,
            receiver: sender,
            payload: pc.localDescription,
            sessionId,
            timestamp: Date.now(),
          }));
          
          setTimeout(() => {
            try {
              window.localStorage.removeItem(`telao-offer-${sessionId}-${sender}`);
            } catch (e) {
              // Ignore errors
            }
          }, 30000);
        } catch (e) {
          console.warn("localStorage backup failed for offer:", e);
        }
        
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    } 
    else if (type === 'offer' && payload?.type === 'participant-leave') {
      // Participant has left, clean up their connection
      console.log(`Participant ${sender} has left, cleaning up their connection`);
      if (peerConnections[sender]) {
        peerConnections[sender].connection.close();
        delete peerConnections[sender];
      }
      
      // Notify any subscribers about this disconnection
      if (onParticipantDisconnected) {
        onParticipantDisconnected(sender);
      }
      
      // Mark as disconnected in localStorage to ensure all components know
      try {
        window.localStorage.setItem(`telao-leave-*-${sender}`, JSON.stringify({
          type: 'participant-leave',
          id: sender,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    else if (type === 'answer') {
      // Handle answer from participant
      const pc = peerConnections[sender]?.connection;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          console.log(`Successfully set remote description for ${sender}`);
          
          // If it's been more than 5 seconds since we created this connection
          // and we don't have a track yet, request a new one
          setTimeout(() => {
            if (pc.connectionState === 'connected' && 
                pc.getReceivers().some(r => !r.track || r.track.readyState !== 'live')) {
              console.log(`Connection with ${sender} established but no active track, requesting track`);
              
              sendSignalingMessage({
                type: 'offer',
                sender: peerId,
                receiver: sender,
                payload: { type: 'request-track-renewal' },
                sessionId,
                timestamp: Date.now(),
              });
            }
          }, 5000);
          
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
    if (type === 'offer' && payload?.type !== 'ready-to-connect') {
      if (payload?.type === 'request-track-renewal' || payload?.type === 'request-new-track') {
        // Host is requesting a track renewal
        console.log("Host requested track renewal");
        
        // If we have a connection and local stream, try to replace the track
        if (peerConnections['host'] && localStream) {
          const pc = peerConnections['host'].connection;
          try {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            
            if (videoSender) {
              // Get a fresh video track
              if (localStream.getVideoTracks().length > 0) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack.readyState === 'live') {
                  console.log("Replacing video track with fresh one");
                  await videoSender.replaceTrack(videoTrack);
                } else {
                  console.log("Video track not live, requesting new stream");
                  // Full reconnect might be needed
                  cleanupWebRTC();
                  
                  // Wait for next message to reinitialize
                }
              }
            } else {
              console.log("No video sender found, adding track");
              // Try to add the track if it's not there
              if (localStream.getVideoTracks().length > 0) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack.readyState === 'live') {
                  pc.addTrack(videoTrack, localStream);
                }
              }
            }
          } catch (err) {
            console.error("Error replacing/adding track:", err);
          }
        }
        
        return;
      }
      
      // Regular offer - setup a new connection
      console.log("Received full offer from host");
      try {
        // Clean up any existing connection first
        cleanupWebRTC();
        
        const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
        
        // Optimize for mobile with H.264 preference
        try {
          const transceiver = pc.addTransceiver('video', {
            direction: 'sendrecv'
          });
          
          // Set codec preferences with mobile-optimized approach
          const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
          if (codecs && transceiver.setCodecPreferences) {
            // Get H.264 codecs first, then VP8, then others
            const h264Codecs = codecs.filter(codec => 
              codec.mimeType.toLowerCase() === 'video/h264'
            );
            
            const vp8Codecs = codecs.filter(codec => 
              codec.mimeType.toLowerCase() === 'video/vp8'
            );
            
            const otherCodecs = codecs.filter(codec => 
              codec.mimeType.toLowerCase() !== 'video/h264' && 
              codec.mimeType.toLowerCase() !== 'video/vp8'
            );
            
            // Prioritize for mobile
            if (h264Codecs.length > 0) {
              transceiver.setCodecPreferences([...h264Codecs, ...vp8Codecs, ...otherCodecs]);
              console.log("Successfully prioritized H.264 codec on participant side");
            } else if (vp8Codecs.length > 0) {
              transceiver.setCodecPreferences([...vp8Codecs, ...otherCodecs]);
              console.log("H.264 not available, using VP8 on participant side");
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
              console.log(`Adding ${track.kind} track to participant connection, state: ${track.readyState}`);
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
            console.log("Participant generated ICE candidate:", 
              event.candidate.protocol, 
              event.candidate.type, 
              event.candidate.address);
            
            sendSignalingMessage({
              type: 'ice-candidate',
              sender: peerId,
              receiver: sender,
              payload: event.candidate,
              sessionId,
              timestamp: Date.now(),
            });
            
            // Store relay candidates in localStorage as backup
            if (event.candidate.type === 'relay') {
              try {
                window.localStorage.setItem(`telao-ice-${peerId}-${sender}-${Date.now()}`, JSON.stringify({
                  type: 'ice-candidate',
                  sender: peerId,
                  receiver: sender,
                  payload: event.candidate,
                  sessionId,
                  timestamp: Date.now(),
                }));
                
                setTimeout(() => {
                  try {
                    window.localStorage.removeItem(`telao-ice-${peerId}-${sender}-${Date.now()}`);
                  } catch (e) {
                    // Ignore errors
                  }
                }, 30000);
              } catch (e) {
                // Ignore localStorage errors
              }
            }
          }
        };
        
        // Monitor ICE connection state with better mobile recovery
        pc.oniceconnectionstatechange = () => {
          console.log(`Participant ICE state: ${pc.iceConnectionState}`);
          
          if (pc.iceConnectionState === 'failed') {
            console.error("Participant ICE connection failed, attempting recovery");
            
            // Try to restart ICE if supported
            if (pc.restartIce) {
              pc.restartIce();
            }
            
            // Also try full reconnect if it stays failed
            setTimeout(() => {
              if (pc.iceConnectionState === 'failed') {
                console.log("ICE still failed after restart attempt, signaling reconnect");
                
                // Signal readiness again to trigger a new offer
                sendSignalingMessage({
                  type: 'offer',
                  sender: peerId,
                  payload: { type: 'ready-to-connect' },
                  sessionId,
                  timestamp: Date.now(),
                });
              }
            }, 2000);
          }
        };
        
        // Set remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        
        // Create and send answer with mobile optimization
        const answer = await pc.createAnswer();
        
        // Set specific video bandwidth and parameters in SDP
        if (answer.sdp) {
          // Lower bitrate for mobile (800kbps)
          answer.sdp = setSdpBitrateAndParams(answer.sdp, 800, true);
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
        
        // Monitor connection status for mobile devices
        const connectionMonitor = setInterval(() => {
          if (pc.connectionState === 'connected' && localStream) {
            // Ensure video tracks are still active (mobile may suspend them)
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length > 0) {
              const videoTrack = videoTracks[0];
              if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
                console.log("Video track is not active, requesting camera restart");
                
                // Signal this to the application level
                const event = new CustomEvent('video-track-inactive', { 
                  detail: { participantId: peerId } 
                });
                window.dispatchEvent(event);
              }
            }
          }
          
          // Clean up if disconnected
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            clearInterval(connectionMonitor);
          }
        }, 2000);
        
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

// Helper function to modify SDP for better video quality and compatibility
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
      
      // Add bitrate parameters (lower for mobile compatibility)
      lines.splice(insertPos, 0, `b=AS:${bitrate}`);
      lines.splice(insertPos + 1, 0, `b=TIAS:${bitrate * 1000}`);
      
      // If we want to prefer H.264, rearrange the payload types
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
      
      // Add specific parameters for better mobile compatibility
      const fmtpLineIndex = lines.findIndex(line => line.includes('a=fmtp:') && line.includes('profile-level-id'));
      if (fmtpLineIndex >= 0) {
        // Already has fmtp line, modify it
        const currentLine = lines[fmtpLineIndex];
        if (!currentLine.includes('packetization-mode')) {
          lines[fmtpLineIndex] = `${currentLine};packetization-mode=1`;
        }
        
        // Add additional parameters for better compatibility
        if (!currentLine.includes('level-asymmetry-allowed')) {
          lines[fmtpLineIndex] = `${lines[fmtpLineIndex]};level-asymmetry-allowed=1`;
        }
      }
      
      modifiedSdp = lines.join('\r\n');
    }
  }
  
  return modifiedSdp;
};

// Send a signaling message through available channels with better reliability
export const sendSignalingMessage = (message: WebRTCMessage) => {
  // Track success of each method
  let broadcastSuccess = false;
  let supabaseSuccess = false;
  
  try {
    // Try BroadcastChannel first (most reliable when available)
    const channel = new BroadcastChannel(`telao-webrtc-${message.sessionId}`);
    channel.postMessage(message);
    setTimeout(() => channel.close(), 100);
    broadcastSuccess = true;
  } catch (error) {
    console.warn('Error sending via BroadcastChannel:', error);
  }
  
  // Try Supabase as backup
  try {
    supabase.channel(`webrtc-${message.sessionId}`).send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });
    supabaseSuccess = true;
  } catch (error) {
    console.warn('Error sending via Supabase:', error);
  }
  
  // If both methods failed, try localStorage as last resort
  if (!broadcastSuccess && !supabaseSuccess && message.receiver) {
    try {
      window.localStorage.setItem(`telao-webrtc-${message.sessionId}-${message.receiver}-${Date.now()}`, JSON.stringify(message));
      
      // Clean up after a while
      setTimeout(() => {
        try {
          window.localStorage.removeItem(`telao-webrtc-${message.sessionId}-${message.receiver}-${Date.now()}`);
        } catch (e) {
          // Ignore errors
        }
      }, 30000);
    } catch (error) {
      console.error('All signaling methods failed:', error);
    }
  }
};

// Callback for when a participant's track is received
let onParticipantTrack: ((participantId: string, event: RTCTrackEvent) => void) | null = null;

// Callback for when a participant disconnects
let onParticipantDisconnected: ((participantId: string) => void) | null = null;

// Set the callback function for participant tracks
export const setOnParticipantTrackCallback = (callback: (participantId: string, event: RTCTrackEvent) => void) => {
  onParticipantTrack = callback;
};

// Set the callback function for participant disconnection
export const setOnParticipantDisconnectedCallback = (callback: (participantId: string) => void) => {
  onParticipantDisconnected = callback;
};

// Helper to get a participant's connection
export const getParticipantConnection = (participantId: string): PeerConnection | undefined => {
  return peerConnections[participantId];
};

// Clean up WebRTC connections with more thorough cleanup
export const cleanupWebRTC = (participantId?: string) => {
  if (participantId && peerConnections[participantId]) {
    console.log(`Cleaning up connection for participant ${participantId}`);
    const connection = peerConnections[participantId].connection;
    
    // More thorough cleanup
    try {
      // Close transceivers first
      connection.getTransceivers().forEach(transceiver => {
        try {
          transceiver.stop();
        } catch (e) {
          console.warn("Error stopping transceiver:", e);
        }
      });
      
      // Close the connection
      connection.close();
    } catch (e) {
      console.warn("Error during connection cleanup:", e);
    }
    
    delete peerConnections[participantId];
    
    // Remove disconnect event handler
    if (disconnectionEventHandlers[participantId]) {
      window.removeEventListener('beforeunload', disconnectionEventHandlers[participantId]);
      delete disconnectionEventHandlers[participantId];
    }
  } else if (!participantId) {
    // Close all connections
    console.log(`Cleaning up all WebRTC connections`);
    
    Object.keys(peerConnections).forEach(id => {
      try {
        // More thorough cleanup
        const connection = peerConnections[id].connection;
        
        // Close transceivers first
        connection.getTransceivers().forEach(transceiver => {
          try {
            transceiver.stop();
          } catch (e) {
            console.warn(`Error stopping transceiver for ${id}:`, e);
          }
        });
        
        // Close the connection
        connection.close();
      } catch (e) {
        console.warn(`Error during connection cleanup for ${id}:`, e);
      }
    });
    
    // Clear the connections object
    Object.keys(peerConnections).forEach(id => {
      delete peerConnections[id];
    });
    
    // Remove all disconnect event handlers
    Object.keys(disconnectionEventHandlers).forEach(id => {
      window.removeEventListener('beforeunload', disconnectionEventHandlers[id]);
      delete disconnectionEventHandlers[id];
    });
  }
};

// Global variable to store local stream
let localStream: MediaStream | undefined;

// Set the local stream
export const setLocalStream = (stream: MediaStream) => {
  localStream = stream;
};

// Check if a participant is connected with improved state detection
export const isParticipantConnected = (participantId: string): boolean => {
  const connection = peerConnections[participantId]?.connection;
  if (!connection) return false;
  
  // Check multiple states for more reliable detection
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
