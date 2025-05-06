import { webSocketSignalingService, SignalingMessage } from '@/services/WebSocketSignalingService';

const PEER_CONNECTION_CONFIG = {
  iceServers: [
    // Public STUN servers for NAT traversal
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    
    // Enhanced TURN server configuration with multiple options
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh'
    },
    // Additional backup TURN servers
    {
      urls: 'turn:relay.backups.cz:3478',
      username: 'webrtc',
      credential: 'webrtc'
    }
  ],
  iceCandidatePoolSize: 10, // Increase candidate pool for better connectivity chances
  bundlePolicy: 'max-bundle' as RTCBundlePolicy, // Explicitly cast to the correct type
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy, // Explicitly cast to the correct type
  iceTransportPolicy: 'all' as RTCIceTransportPolicy // Explicitly cast to the correct type
};

// Keep track of active peer connections
const peerConnections: Record<string, RTCPeerConnection> = {};
let localStream: MediaStream | null = null;
let currentSessionId: string | null = null;
let currentPeerId: string | null = null;
const connectionRetryAttempts: Record<string, number> = {};
const MAX_RETRY_ATTEMPTS = 3;

// Utility function to detect browser and OS for better compatibility handling
const detectBrowserAndOS = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform;
  
  let browser = 'unknown';
  let version = 'unknown';
  let os = 'unknown';
  let mobile = false;
  
  // Browser detection with more accurate patterns
  if (/edg/.test(userAgent)) {
    browser = 'edge';
  } else if (/firefox/.test(userAgent)) {
    browser = 'firefox';
  } else if (/chrome/.test(userAgent) && !/edg/.test(userAgent)) {
    browser = 'chrome';
  } else if (/safari/.test(userAgent) && !/chrome/.test(userAgent) && !/edg/.test(userAgent)) {
    browser = 'safari';
  } else if (/opr|opera/.test(userAgent)) {
    browser = 'opera';
  }
  
  // OS detection
  if (/android/.test(userAgent)) {
    os = 'android';
    mobile = true;
  } else if (/iphone|ipad|ipod/.test(userAgent)) {
    os = 'ios';
    mobile = true;
  } else if (/win/.test(platform)) {
    os = 'windows';
  } else if (/mac/.test(platform)) {
    os = 'macos';
  } else if (/linux/.test(platform)) {
    os = 'linux';
  }
  
  // Try to extract browser version
  let match;
  if (browser === 'firefox') {
    match = userAgent.match(/firefox\/(\d+(\.\d+)?)/);
  } else if (browser === 'chrome') {
    match = userAgent.match(/chrome\/(\d+(\.\d+)?)/);
  } else if (browser === 'safari') {
    match = userAgent.match(/version\/(\d+(\.\d+)?)/);
  } else if (browser === 'edge') {
    match = userAgent.match(/edg\/(\d+(\.\d+)?)/);
  } else if (browser === 'opera') {
    match = userAgent.match(/opr\/(\d+(\.\d+)?)/);
  }
  
  if (match && match[1]) {
    version = match[1];
  }
  
  return {
    browser,
    version,
    os,
    mobile,
    isFirefox: browser === 'firefox',
    isSafari: browser === 'safari',
    isChrome: browser === 'chrome',
    isEdge: browser === 'edge',
    isOpera: browser === 'opera',
    isIOS: os === 'ios',
    isAndroid: os === 'android',
    isMobile: mobile
  };
};

/**
 * Enhanced SDP modification to ensure wide codec compatibility across browsers
 */
const modifySdp = (sdp: string): string => {
  try {
    const browserInfo = detectBrowserAndOS();
    console.log("SDP modification for browser:", browserInfo);
    
    // Skip SDP modification for problematic browser environments
    if ((browserInfo.isSafari && browserInfo.isMobile) || 
        (browserInfo.isIOS) || 
        (browserInfo.browser === 'unknown')) {
      console.log("Using default SDP settings for potentially problematic browser");
      return sdp;
    }

    let lines = sdp.split('\r\n');
    let mLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (mLineIndex === -1) {
      console.log("No video m-line found in SDP");
      return sdp;
    }
    
    // Check for available codecs in the SDP
    const hasVP8 = lines.some(line => line.includes('VP8/90000'));
    const hasH264 = lines.some(line => line.includes('H264/90000'));
    
    console.log("Available codecs in original SDP - VP8:", hasVP8, "H264:", hasH264);
    
    // For Chrome and most browsers, ensure VP8 is prioritized for best compatibility
    if (browserInfo.isChrome || (!browserInfo.isSafari && !browserInfo.isFirefox)) {
      if (hasVP8) {
        // Find the payload type for VP8
        const vpLineIndex = lines.findIndex(line => line.includes('VP8/90000'));
        if (vpLineIndex !== -1) {
          const vpPayloadType = lines[vpLineIndex].split(' ')[0].split(':')[1];
          
          // Modify the m-line to prioritize VP8
          const mLine = lines[mLineIndex].split(' ');
          const videoIndex = mLine.indexOf('video');
          const portIndex = videoIndex + 1;
          const protoIndex = portIndex + 1;
          
          // Extract all payload types
          const payloadTypes = mLine.slice(protoIndex + 1);
          
          // Remove VP8 from the list
          const vpIndex = payloadTypes.indexOf(vpPayloadType);
          if (vpIndex !== -1) {
            payloadTypes.splice(vpIndex, 1);
          }
          
          // Put VP8 at the front of payload types list
          payloadTypes.unshift(vpPayloadType);
          
          // Reconstruct m-line with VP8 prioritized
          lines[mLineIndex] = [...mLine.slice(0, protoIndex + 1), ...payloadTypes].join(' ');
          console.log("Modified SDP to prioritize VP8");
        }
      }
    }
    
    // For Safari, ensure H264 is prioritized as it has better support there
    if (browserInfo.isSafari && hasH264) {
      // Find the payload type for H264
      const h264LineIndex = lines.findIndex(line => line.includes('H264/90000'));
      if (h264LineIndex !== -1) {
        const h264PayloadType = lines[h264LineIndex].split(' ')[0].split(':')[1];
        
        // Modify the m-line to prioritize H264
        const mLine = lines[mLineIndex].split(' ');
        const videoIndex = mLine.indexOf('video');
        const portIndex = videoIndex + 1;
        const protoIndex = portIndex + 1;
        
        // Extract all payload types
        const payloadTypes = mLine.slice(protoIndex + 1);
        
        // Remove H264 from the list
        const h264Index = payloadTypes.indexOf(h264PayloadType);
        if (h264Index !== -1) {
          payloadTypes.splice(h264Index, 1);
        }
        
        // Put H264 at the front of payload types list
        payloadTypes.unshift(h264PayloadType);
        
        // Reconstruct m-line with H264 prioritized
        lines[mLineIndex] = [...mLine.slice(0, protoIndex + 1), ...payloadTypes].join(' ');
        console.log("Modified SDP to prioritize H264");
      }
    }
    
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
  
  // Connect to signaling server with retry mechanism
  let signalingConnectAttempts = 0;
  const MAX_SIGNALING_ATTEMPTS = 3;
  
  const connectWithRetry = async (): Promise<boolean> => {
    try {
      console.log(`Attempting to connect to signaling server (Attempt ${signalingConnectAttempts + 1}/${MAX_SIGNALING_ATTEMPTS})`);
      const connected = await webSocketSignalingService.connect(sessionId, currentPeerId);
      
      if (!connected) {
        signalingConnectAttempts++;
        if (signalingConnectAttempts < MAX_SIGNALING_ATTEMPTS) {
          console.log(`Connection failed. Retrying in ${signalingConnectAttempts * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, signalingConnectAttempts * 1000));
          return connectWithRetry();
        }
        console.error('Failed to connect to signaling server after multiple attempts');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error connecting to signaling server:', error);
      signalingConnectAttempts++;
      if (signalingConnectAttempts < MAX_SIGNALING_ATTEMPTS) {
        console.log(`Connection error. Retrying in ${signalingConnectAttempts * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, signalingConnectAttempts * 1000));
        return connectWithRetry();
      }
      return false;
    }
  };
  
  const connected = await connectWithRetry();
  if (!connected) {
    console.error('Failed to connect to signaling server after exhausting retry attempts');
    return;
  }
  
  console.log("Successfully connected to signaling server");
  
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
  
  // Setup periodic connection health checks
  setInterval(() => {
    Object.entries(peerConnections).forEach(([peerId, connection]) => {
      if (connection.iceConnectionState === 'disconnected' || 
          connection.iceConnectionState === 'failed' ||
          connection.connectionState === 'failed') {
        console.log(`Detected unhealthy connection with ${peerId}, attempting recovery...`);
        
        // Attempt ICE restart
        if (connection.restartIce) {
          console.log(`Restarting ICE for peer ${peerId}`);
          connection.restartIce();
          createAndSendOffer(peerId);
        } else {
          console.log(`ICE restart not supported for ${peerId}, recreating connection`);
          closePeerConnection(peerId);
          createPeerConnection(peerId, onTrack);
          createAndSendOffer(peerId);
        }
      }
    });
  }, 10000);
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
  const browserInfo = detectBrowserAndOS();
  console.log("Participant browser info:", browserInfo);

  // Log stream info
  const videoTracks = stream.getVideoTracks();
  console.log(`Participant stream details: ${videoTracks.length} video tracks`);
  videoTracks.forEach(track => {
    console.log("Video track:", {
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    });
    
    // Log video constraints
    try {
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
    } catch (e) {
      console.log("Could not get track constraints:", e);
    }
  });
  
  // Connect to signaling server with enhanced retry logic
  let signalingConnectAttempts = 0;
  const MAX_SIGNALING_ATTEMPTS = 3;
  
  const connectWithRetry = async (): Promise<boolean> => {
    try {
      console.log(`Attempting to connect to signaling server (Attempt ${signalingConnectAttempts + 1}/${MAX_SIGNALING_ATTEMPTS})`);
      const connected = await webSocketSignalingService.connect(sessionId, participantId);
      
      if (!connected) {
        signalingConnectAttempts++;
        if (signalingConnectAttempts < MAX_SIGNALING_ATTEMPTS) {
          console.log(`Connection failed. Retrying in ${signalingConnectAttempts * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, signalingConnectAttempts * 1000));
          return connectWithRetry();
        }
        console.error('Failed to connect to signaling server after multiple attempts');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error connecting to signaling server:', error);
      signalingConnectAttempts++;
      if (signalingConnectAttempts < MAX_SIGNALING_ATTEMPTS) {
        console.log(`Connection error. Retrying in ${signalingConnectAttempts * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, signalingConnectAttempts * 1000));
        return connectWithRetry();
      }
      return false;
    }
  };
  
  const connected = await connectWithRetry();
  if (!connected) {
    // Try to use a fallback communication method when signaling fails
    console.log("Signaling server connection failed, attempting to use fallback communication");
    
    try {
      // Create a BroadcastChannel for local fallback communication
      const fallbackChannel = new BroadcastChannel(`fallback-${sessionId}`);
      fallbackChannel.postMessage({
        type: 'participant-joined',
        peerId: participantId,
        timestamp: Date.now()
      });
      
      // Store fallback communication method reference for cleanup
      window._fallbackChannels = window._fallbackChannels || {};
      window._fallbackChannels[participantId] = fallbackChannel;
      
      // Also try localStorage method for browsers that don't support BroadcastChannel
      try {
        localStorage.setItem(`fallback-${sessionId}-${participantId}`, JSON.stringify({
          type: 'participant-joined',
          peerId: participantId,
          timestamp: Date.now()
        }));
        
        // Clean up after a delay
        setTimeout(() => {
          try {
            localStorage.removeItem(`fallback-${sessionId}-${participantId}`);
          } catch (e) {
            console.error("Error removing fallback from localStorage:", e);
          }
        }, 10000);
      } catch (e) {
        console.log("Could not use localStorage for fallback communication", e);
      }
      
      // We still need to set up the peer connection for direct WebRTC
      createPeerConnection('host', null);
      
      console.log("Established fallback communication, will attempt to negotiate via fallback");
      
      // Return true since we established a fallback mechanism
      return;
    } catch (e) {
      console.error("Failed to establish even fallback communication:", e);
      throw new Error("Failed to establish any form of communication channel");
    }
  }
  
  console.log("Successfully connected to signaling server");
  
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
  
  // Periodically check connection health and retry if necessary
  const connectionHealthCheckInterval = setInterval(() => {
    if (peerConnections['host']) {
      const connectionState = peerConnections['host'].connectionState;
      const iceConnectionState = peerConnections['host'].iceConnectionState;
      
      console.log(`Connection health check - connection: ${connectionState}, ICE: ${iceConnectionState}`);
      
      if ((connectionState === 'failed' || iceConnectionState === 'failed') && 
          (connectionRetryAttempts['host'] || 0) < MAX_RETRY_ATTEMPTS) {
        
        connectionRetryAttempts['host'] = (connectionRetryAttempts['host'] || 0) + 1;
        console.log(`Connection unhealthy, attempting recovery (attempt ${connectionRetryAttempts['host']}/${MAX_RETRY_ATTEMPTS})`);
        
        // Recreate peer connection
        closePeerConnection('host');
        createPeerConnection('host', null);
        createAndSendOffer('host');
      }
    }
  }, 15000);
  
  // Store interval for cleanup - cast to NodeTimer for type compatibility
  window._healthCheckIntervals = window._healthCheckIntervals || {};
  window._healthCheckIntervals[participantId] = connectionHealthCheckInterval as unknown as number;
};

// Create a peer connection with enhanced error monitoring
const createPeerConnection = (
  peerId: string, 
  onTrack: ((participantId: string, track: MediaStreamTrack) => void) | null
): RTCPeerConnection => {
  // Close existing connection if any
  if (peerConnections[peerId]) {
    closePeerConnection(peerId);
  }
  
  console.log(`Creating new peer connection for ${peerId} with config:`, PEER_CONNECTION_CONFIG);
  
  // Create new connection with browser-specific optimizations
  const browserInfo = detectBrowserAndOS();
  let peerConnection: RTCPeerConnection;
  
  try {
    peerConnection = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
    console.log(`Peer connection created for ${peerId}`);
  } catch (error) {
    console.error(`Error creating peer connection for ${peerId}:`, error);
    // Try with minimal configuration as fallback
    console.log("Attempting with minimal configuration");
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
  }
  
  peerConnections[peerId] = peerConnection;
  
  // Add local tracks to the connection if available
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    console.log(`Adding ${videoTracks.length} video tracks to peer connection for ${peerId}`);
    
    localStream.getTracks().forEach(track => {
      console.log(`Adding track: ${track.kind} (${track.id}) to peer connection`);
      try {
        peerConnection.addTrack(track, localStream!);
      } catch (e) {
        console.error(`Error adding track ${track.id} to connection:`, e);
      }
    });
  } else {
    console.log(`No local stream available for ${peerId}`);
  }
  
  // Set up ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`Generated ICE candidate for ${peerId}:`, event.candidate.candidate.substring(0, 50) + '...');
      
      // Try WebSocket signaling first
      try {
        webSocketSignalingService.send({
          type: 'candidate',
          targetId: peerId,
          candidate: event.candidate,
          senderId: currentPeerId
        });
      } catch (e) {
        console.warn(`WebSocket signaling failed for ICE candidate to ${peerId}, trying fallback:`, e);
        
        // Try BroadcastChannel fallback
        try {
          const fallbackChannel = new BroadcastChannel(`fallback-${currentSessionId}`);
          fallbackChannel.postMessage({
            type: 'candidate',
            targetId: peerId,
            senderId: currentPeerId,
            candidate: event.candidate,
            timestamp: Date.now()
          });
          setTimeout(() => fallbackChannel.close(), 1000);
        } catch (e) {
          console.warn("BroadcastChannel fallback failed:", e);
        }
        
        // Try localStorage fallback as well
        try {
          const fallbackKey = `ice-${currentSessionId}-${currentPeerId}-${Date.now()}`;
          localStorage.setItem(fallbackKey, JSON.stringify({
            type: 'candidate',
            targetId: peerId,
            senderId: currentPeerId,
            candidate: event.candidate,
            timestamp: Date.now()
          }));
          
          // Clean up after a delay
          setTimeout(() => {
            try {
              localStorage.removeItem(fallbackKey);
            } catch (e) {
              console.error("Error removing ICE candidate from localStorage:", e);
            }
          }, 30000);
        } catch (e) {
          console.error("localStorage fallback failed:", e);
        }
      }
    }
  };
  
  // Set up connection state change handler with enhanced logging
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state for ${peerId}: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'connected') {
      console.log(`Successfully connected to ${peerId}! RTCPeerConnection is fully established`);
      // Reset retry counter on successful connection
      connectionRetryAttempts[peerId] = 0;
    }
    
    // Log all connection state transitions for debugging
    if (peerConnection.connectionState === 'disconnected') {
      console.warn(`Connection to ${peerId} disconnected, may reconnect automatically`);
    } else if (peerConnection.connectionState === 'failed') {
      console.error(`Connection to ${peerId} failed`);
    } else if (peerConnection.connectionState === 'closed') {
      console.log(`Connection to ${peerId} closed`);
    }
  };
  
  // Set up ICE connection state change handler with enhanced recovery logic
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state for ${peerId}: ${peerConnection.iceConnectionState}`);
    
    if (peerConnection.iceConnectionState === 'failed') {
      console.log(`ICE connection failed for ${peerId}, attempting recovery...`);
      
      if (connectionRetryAttempts[peerId] === undefined) {
        connectionRetryAttempts[peerId] = 0;
      }
      
      if (connectionRetryAttempts[peerId] < MAX_RETRY_ATTEMPTS) {
        connectionRetryAttempts[peerId]++;
        console.log(`Recovery attempt ${connectionRetryAttempts[peerId]}/${MAX_RETRY_ATTEMPTS}`);
        
        // Try ICE restart first if supported
        try {
          console.log(`Attempting ICE restart for ${peerId}`);
          peerConnection.restartIce();
          createAndSendOffer(peerId, true); // true for ICE restart
        } catch (e) {
          console.error('Error restarting ICE:', e);
          
          // If ICE restart fails, recreate the connection
          console.log(`Recreating connection for ${peerId}`);
          setTimeout(() => {
            closePeerConnection(peerId);
            createPeerConnection(peerId, onTrack);
            createAndSendOffer(peerId);
          }, 1000);
        }
      } else {
        console.error(`Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached for ${peerId}`);
        // At this point we might want to notify the user about persistent connection issues
      }
    }
    
    if (peerConnection.iceConnectionState === 'connected' || 
        peerConnection.iceConnectionState === 'completed') {
      // Reset retry counter on successful connection
      connectionRetryAttempts[peerId] = 0;
    }
  };
  
  // Set up track handler with enhanced error handling
  if (onTrack) {
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}:`, event.track);
      console.log(`Track details: kind=${event.track.kind}, id=${event.track.id}, readyState=${event.track.readyState}`);
      
      try {
        onTrack(peerId, event.track);
      } catch (e) {
        console.error(`Error in onTrack handler for ${peerId}:`, e);
      }
      
      // Monitor track state changes
      event.track.onended = () => {
        console.log(`Track ${event.track.id} from ${peerId} ended`);
      };
      
      event.track.onmute = () => {
        console.log(`Track ${event.track.id} from ${peerId} muted`);
      };
      
      event.track.onunmute = () => {
        console.log(`Track ${event.track.id} from ${peerId} unmuted`);
      };
    };
  }
  
  // Log negotiation needed events
  peerConnection.onnegotiationneeded = () => {
    console.log(`Negotiation needed for ${peerId}`);
    // We don't automatically send an offer here as it could conflict with other operations
  };
  
  // Log signaling state changes
  peerConnection.onsignalingstatechange = () => {
    console.log(`Signaling state changed for ${peerId}: ${peerConnection.signalingState}`);
  };
  
  // Handle ICE gathering state changes
  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state for ${peerId}: ${peerConnection.iceGatheringState}`);
  };
  
  // Use event listeners for error handling instead of the non-existent onerror property
  peerConnection.addEventListener('error', (event) => {
    console.error(`Peer connection error for ${peerId}:`, event);
  });
  
  return peerConnection;
};

// Create and send an offer with enhanced error handling
const createAndSendOffer = async (peerId: string, iceRestart: boolean = false): Promise<void> => {
  const peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.error(`No peer connection for ${peerId}`);
    return;
  }
  
  try {
    // Configure offer options based on browser compatibility and connection needs
    const browserInfo = detectBrowserAndOS();
    
    const offerOptions: RTCOfferOptions = {
      offerToReceiveAudio: false,
      offerToReceiveVideo: true,
      iceRestart: iceRestart // Enable ice restart if requested
    };
    
    console.log(`Creating offer for ${peerId} with options:`, offerOptions);
    const offer = await peerConnection.createOffer(offerOptions);
    
    // Modify SDP for better compatibility
    if (offer.sdp) {
      offer.sdp = modifySdp(offer.sdp);
    }
    
    console.log(`Setting local description for ${peerId}`);
    await peerConnection.setLocalDescription(offer);
    
    // Send offer via signaling service with fallback mechanisms
    try {
      webSocketSignalingService.send({
        type: 'offer',
        targetId: peerId,
        senderId: currentPeerId,
        description: peerConnection.localDescription
      });
      console.log(`Sent offer to ${peerId} via WebSocket`);
    } catch (e) {
      console.warn(`WebSocket signaling failed for offer to ${peerId}, trying fallback:`, e);
      
      // Try BroadcastChannel fallback
      try {
        const fallbackChannel = new BroadcastChannel(`fallback-${currentSessionId}`);
        fallbackChannel.postMessage({
          type: 'offer',
          targetId: peerId,
          senderId: currentPeerId,
          description: peerConnection.localDescription,
          timestamp: Date.now()
        });
        setTimeout(() => fallbackChannel.close(), 1000);
      } catch (e) {
        console.warn("BroadcastChannel fallback failed:", e);
      }
      
      // Try localStorage fallback as well
      try {
        const fallbackKey = `offer-${currentSessionId}-${currentPeerId}-${Date.now()}`;
        localStorage.setItem(fallbackKey, JSON.stringify({
          type: 'offer',
          targetId: peerId,
          senderId: currentPeerId,
          description: peerConnection.localDescription,
          timestamp: Date.now()
        }));
        
        // Clean up after a delay
        setTimeout(() => {
          try {
            localStorage.removeItem(fallbackKey);
          } catch (e) {
            console.error("Error removing offer from localStorage:", e);
          }
        }, 30000);
      } catch (e) {
        console.error("localStorage fallback failed:", e);
      }
    }
  } catch (error) {
    console.error(`Error creating offer for ${peerId}:`, error);
    
    // Retry with simpler configuration if there was an error
    if (!iceRestart) { // avoid infinite recursion
      console.log(`Retrying offer creation for ${peerId} with simplified settings`);
      try {
        const simpleOffer = await peerConnection.createOffer({
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(simpleOffer);
        
        webSocketSignalingService.send({
          type: 'offer',
          targetId: peerId,
          description: peerConnection.localDescription
        });
        console.log(`Sent simplified offer to ${peerId}`);
      } catch (retryError) {
        console.error(`Retry failed for offer to ${peerId}:`, retryError);
      }
    }
  }
};

// Handle an incoming offer with enhanced compatibility
const handleOffer = async (peerId: string, description: RTCSessionDescription): Promise<void> => {
  // Create peer connection if it doesn't exist
  if (!peerConnections[peerId]) {
    createPeerConnection(peerId, null);
  }
  
  const peerConnection = peerConnections[peerId];
  
  try {
    // Log the incoming offer SDP for debugging
    console.log(`Processing offer from ${peerId}: ${description.sdp?.substring(0, 100)}...`);
    
    // Apply SDP modifications for better compatibility
    if (description.sdp) {
      const modifiedSdp = modifySdp(description.sdp);
      description = new RTCSessionDescription({
        type: description.type,
        sdp: modifiedSdp
      });
    }
    
    await peerConnection.setRemoteDescription(description);
    console.log(`Remote description set for ${peerId}`);
    
    const answer = await peerConnection.createAnswer();
    
    // Modify the answer SDP for better compatibility
    if (answer.sdp) {
      answer.sdp = modifySdp(answer.sdp);
    }
    
    await peerConnection.setLocalDescription(answer);
    console.log(`Local description (answer) set for ${peerId}`);
    
    // Send answer via signaling service with fallback mechanisms
    try {
      webSocketSignalingService.send({
        type: 'answer',
        targetId: peerId,
        senderId: currentPeerId,
        description: peerConnection.localDescription
      });
      console.log(`Sent answer to ${peerId} via WebSocket`);
    } catch (e) {
      console.warn(`WebSocket signaling failed for answer to ${peerId}, trying fallback:`, e);
      
      // Try BroadcastChannel fallback
      try {
        const fallbackChannel = new BroadcastChannel(`fallback-${currentSessionId}`);
        fallbackChannel.postMessage({
          type: 'answer',
          targetId: peerId,
          senderId: currentPeerId,
          description: peerConnection.localDescription,
          timestamp: Date.now()
        });
        setTimeout(() => fallbackChannel.close(), 1000);
      } catch (e) {
        console.warn("BroadcastChannel fallback failed:", e);
      }
      
      // Try localStorage fallback as well
      try {
        const fallbackKey = `answer-${currentSessionId}-${currentPeerId}-${Date.now()}`;
        localStorage.setItem(fallbackKey, JSON.stringify({
          type: 'answer',
          targetId: peerId,
          senderId: currentPeerId,
          description: peerConnection.localDescription,
          timestamp: Date.now()
        }));
        
        // Clean up after a delay
        setTimeout(() => {
          try {
            localStorage.removeItem(fallbackKey);
          } catch (e) {
            console.error("Error removing answer from localStorage:", e);
          }
        }, 30000);
      } catch (e) {
        console.error("localStorage fallback failed:", e);
      }
    }
  } catch (error) {
    console.error(`Error handling offer from ${peerId}:`, error);
    
    // Attempt recovery by recreating the connection
    try {
      console.log(`Attempting recovery for connection with ${peerId}`);
      closePeerConnection(peerId);
      createPeerConnection(peerId, null);
      
      await peerConnection.setRemoteDescription(description);
      const simpleAnswer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(simpleAnswer);
      
      webSocketSignalingService.send({
        type: 'answer',
        targetId: peerId,
        description: peerConnection.localDescription
      });
    } catch (recoveryError) {
      console.error(`Recovery attempt failed for ${peerId}:`, recoveryError);
    }
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
    
    // Apply SDP modifications for better compatibility
    if (description.sdp) {
      const modifiedSdp = modifySdp(description.sdp);
      description = new RTCSessionDescription({
        type: description.type,
        sdp: modifiedSdp
      });
    }
    
    await peerConnection.setRemoteDescription(description);
    console.log(`Remote description (answer) set for ${peerId}`);
  } catch (error) {
    console.error(`Error handling answer from ${peerId}:`, error);
    
    // More graceful error handling with retry logic
    if (error instanceof Error && error.name === 'InvalidStateError') {
      console.log("Invalid state when setting remote description, attempting to recover");
      
      // Wait a bit and try again
      setTimeout(async () => {
        try {
          if (peerConnection.signalingState !== 'closed') {
            await peerConnection.setRemoteDescription(description);
            console.log(`Retry successful: Remote description set for ${peerId}`);
          } else {
            console.log(`Connection already closed for ${peerId}, cannot retry`);
          }
        } catch (retryError) {
          console.error(`Retry failed for ${peerId}:`, retryError);
        }
      }, 1000);
    }
  }
};

// Handle an incoming ICE candidate with enhanced validation
const handleCandidate = async (peerId: string, candidate: RTCIceCandidate): Promise<void> => {
  const peerConnection = peerConnections[peerId];
  if (!peerConnection) {
    console.error(`No peer connection for ${peerId}`);
    return;
  }
  
  try {
    // Validate candidate format to prevent errors
    if (!candidate || !candidate.candidate) {
      console.warn(`Received invalid ICE candidate from ${peerId}, skipping`);
      return;
    }
    
    console.log(`Adding ICE candidate from ${peerId}: ${candidate.candidate.substring(0, 50)}...`);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(`ICE candidate added for ${peerId}`);
  } catch (error) {
    console.error(`Error handling ICE candidate from ${peerId}:`, error);
    
    if (error instanceof Error && error.name === 'InvalidStateError') {
      console.log(`Invalid state when adding ICE candidate for ${peerId}, queueing for retry`);
      
      // Queue the candidate and try again later
      setTimeout(async () => {
        try {
          if (peerConnection.signalingState !== 'closed') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`Retry successful: ICE candidate added for ${peerId}`);
          } else {
            console.log(`Connection already closed for ${peerId}, cannot retry adding ICE candidate`);
          }
        } catch (retryError) {
          console.error(`Retry failed for adding ICE candidate for ${peerId}:`, retryError);
        }
      }, 1000);
    }
  }
};

// Close a peer connection
const closePeerConnection = (peerId: string): void => {
  if (peerConnections[peerId]) {
    console.log(`Closing peer connection for ${peerId}`);
    try {
      peerConnections[peerId].close();
    } catch (e) {
      console.error(`Error closing connection for ${peerId}:`, e);
    }
    delete peerConnections[peerId];
    // Reset retry counter when explicitly closing
    delete connectionRetryAttempts[peerId];
  }
};

// Set local media stream
export const setLocalStream = (stream: MediaStream): void => {
  console.log(`Setting local stream with ${stream.getTracks().length} tracks`);
  
  if (localStream) {
    // Stop existing tracks before replacing
    console.log("Stopping existing tracks before replacing stream");
    localStream.getTracks().forEach(track => {
      track.stop();
    });
  }
  
  localStream = stream;
  
  // Update existing peer connections with new stream
  Object.keys(peerConnections).forEach(peerId => {
    const peerConnection = peerConnections[peerId];
    console.log(`Updating stream for peer ${peerId}`);
    
    try {
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
        try {
          peerConnection.addTrack(track, stream);
        } catch (e) {
          console.error(`Error adding track ${track.id} to connection:`, e);
        }
      });
      
      // Renegotiate the connection if needed
      createAndSendOffer(peerId);
    } catch (e) {
      console.error(`Error updating tracks for peer ${peerId}:`, e);
    }
  });
};

// End WebRTC session and clean up
export const endWebRTC = (): void => {
  // Close all peer connections
  Object.keys(peerConnections).forEach(peerId => {
    console.log(`Closing connection to ${peerId} during cleanup`);
    closePeerConnection(peerId);
  });
  
  // Disconnect from signaling server
  try {
    webSocketSignalingService.disconnect();
    console.log("Disconnected from signaling server");
  } catch (e) {
    console.error("Error disconnecting from signaling server:", e);
  }
  
  // Clean up local stream
  if (localStream) {
    console.log(`Stopping ${localStream.getTracks().length} local tracks`);
    localStream.getTracks().forEach(track => {
      console.log(`Stopping track: ${track.kind} (${track.id})`);
      track.stop();
    });
    localStream = null;
  }
  
  // Clean up health check intervals
  if (window._healthCheckIntervals) {
    Object.values(window._healthCheckIntervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    window._healthCheckIntervals = {};
  }
  
  // Clean up fallback channels
  if (window._fallbackChannels) {
    Object.values(window._fallbackChannels).forEach((channel: any) => {
      if (channel && channel.close) channel.close();
    });
    window._fallbackChannels = {};
  }
  
  currentSessionId = null;
  currentPeerId = null;
  console.log("WebRTC session ended and cleaned up");
};

// Export as cleanupWebRTC for backward compatibility
export const cleanupWebRTC = endWebRTC;
