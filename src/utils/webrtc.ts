import { addParticipantToSession, updateParticipantStatus } from './sessionUtils';
import { io } from 'socket.io-client';
import { createLogger } from './loggingUtils';

const logger = createLogger('webrtc');

// Define SocketType interface
interface SocketType {
  id: string;
  connected: boolean;
  on: (event: string, callback: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
}

const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceServers: [
    // Primary STUN servers (Google and common ones)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    
    // North America TURN servers
    {
      urls: 'turn:north-america.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:north-america.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:north-america.relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Europe TURN servers for EU participants
    {
      urls: 'turn:europe.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:europe.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Asia TURN servers for APAC participants
    {
      urls: 'turn:asia.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:asia.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Fallback TURN servers from openrelay.metered.ca
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all' as RTCIceTransportPolicy
};

let socket: SocketType | null = null;
let activePeerConnections: { [participantId: string]: RTCPeerConnection } = {};
let activeParticipants: { [participantId: string]: boolean } = {};
let signalingSessions: { [sessionId: string]: boolean } = {};
let currentSessionId: string | null = null;
let localStream: MediaStream | null = null;
let fallbackModeEnabled = false;
let onParticipantTrackCallback: ((participantId: string, track: MediaStreamTrack) => void) | null = null;
let browserType: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown' = 'unknown';
let mediaStreamEstablished = false;

// Detect browser type for specialized handling
const detectBrowser = (): void => {
  const ua = navigator.userAgent;
  
  if (/Firefox\/\d+/.test(ua)) {
    browserType = 'firefox';
  } else if (/Edg\/\d+/.test(ua) || /Edge\/\d+/.test(ua)) {
    browserType = 'edge';
  } else if (/Chrome\/\d+/.test(ua) && !/Edg\//.test(ua)) {
    browserType = 'chrome';
  } else if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua) && !/Chromium\/\d+/.test(ua)) {
    browserType = 'safari';
  } else if (/OPR\/\d+/.test(ua) || /Opera\/\d+/.test(ua)) {
    browserType = 'opera';
  }
  
  logger.info(`Detected browser: ${browserType}`);
};

// Call browser detection on module load
detectBrowser();

// Define the enableFallbackMode function that was missing
const enableFallbackMode = (): void => {
  logger.info("Enabling fallback mode for signaling");
  fallbackModeEnabled = true;
  
  // Close socket if it exists
  if (socket) {
    try {
      socket.emit('disconnect');
    } catch (e) {
      logger.error("Error disconnecting socket:", e);
    }
    socket = null;
  }
};

/**
 * Sets codec preference to H.264 if available
 */
export const setH264CodecPreference = (pc: RTCPeerConnection): void => {
  if (RTCRtpTransceiver.prototype.setCodecPreferences && RTCRtpSender.getCapabilities) {
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (!capabilities) return;
      
      const h264Codecs = capabilities.codecs.filter(codec => 
        codec.mimeType.toLowerCase() === 'video/h264'
      );
      
      if (h264Codecs.length > 0) {
        const transceivers = pc.getTransceivers();
        const videoTransceiver = transceivers.find(t => 
          t.sender && t.sender.track && t.sender.track.kind === 'video'
        );
        
        if (videoTransceiver) {
          videoTransceiver.setCodecPreferences(h264Codecs);
          logger.info('Set H.264 codec preference successfully');
        }
      }
    } catch (e) {
      logger.warn('Error setting H.264 codec preferences:', e);
    }
  }
};

/**
 * Sets codec preference to VP9 if available (better for Chrome)
 */
export const setVP9CodecPreference = (pc: RTCPeerConnection): boolean => {
  if (RTCRtpTransceiver.prototype.setCodecPreferences && RTCRtpSender.getCapabilities) {
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (!capabilities) return false;
      
      const vp9Codecs = capabilities.codecs.filter(codec => 
        codec.mimeType.toLowerCase() === 'video/vp9'
      );
      
      if (vp9Codecs.length > 0) {
        const transceivers = pc.getTransceivers();
        const videoTransceiver = transceivers.find(t => 
          t.sender && t.sender.track && t.sender.track.kind === 'video'
        );
        
        if (videoTransceiver) {
          videoTransceiver.setCodecPreferences(vp9Codecs);
          logger.info('Set VP9 codec preference successfully');
          return true;
        }
      }
      return false;
    } catch (e) {
      logger.warn('Error setting VP9 codec preferences:', e);
      return false;
    }
  }
  return false;
};

/**
 * Sets the best codec preference based on browser
 */
export const setBestCodecPreference = (pc: RTCPeerConnection): void => {
  // Chrome and Edge work best with VP9
  if (browserType === 'chrome' || browserType === 'edge') {
    const vpResult = setVP9CodecPreference(pc);
    if (!vpResult) {
      setH264CodecPreference(pc);
    }
  } 
  // Firefox works well with H.264
  else if (browserType === 'firefox') {
    setH264CodecPreference(pc);
  }
  // Safari also prefers H.264
  else if (browserType === 'safari') {
    setH264CodecPreference(pc);
  }
  // For other browsers, try both in order
  else {
    const vpResult = setVP9CodecPreference(pc);
    if (!vpResult) {
      setH264CodecPreference(pc);
    }
  }
};

/**
 * Initializes the socket connection
 */
const initSocket = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Try to use the signaling server if available
    if (!io) {
      logger.warn("Socket.io client not loaded, switching to fallback mode");
      enableFallbackMode();
      resolve();
      return;
    }

    // Skip if we already have a socket for this session
    if (socket && socket.connected && currentSessionId === sessionId) {
      logger.info('Socket already initialized for this session.');
      resolve();
      return;
    }

    // Try to connect to the signaling server
    try {
      // Fix for "process is not defined" error - use import.meta.env instead
      const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'https://signaling.hutz.co';
      logger.info(`Connecting to signaling server at ${serverUrl}...`);
      
      socket = io(serverUrl);

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        logger.warn("Socket connection timeout, switching to fallback mode");
        enableFallbackMode();
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        logger.info('Socket connected:', socket?.id);
        currentSessionId = sessionId;
        socket?.emit('joinSession', sessionId);
        resolve();
      });

      socket.on('connect_error', (error: any) => {
        clearTimeout(connectionTimeout);
        logger.error('Socket connection error, switching to fallback mode:', error);
        enableFallbackMode();
        resolve();
      });

      socket.on('disconnect', (reason: string) => {
        logger.info('Socket disconnected:', reason);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          logger.warn("Permanent disconnection, switching to fallback mode");
          enableFallbackMode();
        }
      });
    } catch (error) {
      logger.error("Error initializing socket:", error);
      enableFallbackMode();
      resolve();
    }
  });
};

/**
 * Set local stream for WebRTC
 */
export const setLocalStream = (stream: MediaStream): void => {
  if (!stream) {
    logger.warn("Attempted to set null stream");
    return;
  }
  
  localStream = stream;
  logger.info("Local stream set with tracks:", stream.getTracks().length);
  
  // Update existing peer connections with the new stream
  Object.entries(activePeerConnections).forEach(([participantId, pc]) => {
    updatePeerConnectionStream(participantId, pc);
  });
};

/**
 * Updates an existing peer connection with the current stream
 */
const updatePeerConnectionStream = (participantId: string, pc: RTCPeerConnection): void => {
  if (!localStream) {
    logger.warn(`No local stream available to update peer connection for ${participantId}`);
    return;
  }
  
  try {
    // Get existing senders
    const senders = pc.getSenders();
    const videoSender = senders.find(sender => sender.track?.kind === 'video');
    
    if (videoSender) {
      // Replace track on existing sender
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        logger.info(`Replacing video track for ${participantId}`);
        videoSender.replaceTrack(videoTracks[0])
          .then(() => logger.info(`Successfully replaced video track for ${participantId}`))
          .catch(e => logger.error(`Failed to replace video track for ${participantId}:`, e));
      }
    } else {
      // Add new tracks
      localStream.getTracks().forEach(track => {
        logger.info(`Adding ${track.kind} track for ${participantId}`);
        pc.addTrack(track, localStream!);
      });
    }
  } catch (e) {
    logger.error(`Error updating peer connection for ${participantId}:`, e);
  }
};

/**
 * Initializes the WebRTC connection for the host
 */
export const initHostWebRTC = async (
  sessionId: string,
  onTrack: (participantId: string, track: MediaStreamTrack) => void
): Promise<void> => {
  onParticipantTrackCallback = onTrack;

  await initSocket(sessionId);

  // Set up a channel specifically for stream info
  try {
    const streamChannel = new BroadcastChannel(`stream-info-${sessionId}`);
    streamChannel.onmessage = (event) => {
      const { data } = event;
      if (data.type === 'participant-stream-info') {
        console.log(`Received stream info from participant ${data.participantId}:`, data);
        // Update participant status with video info
        if (data.hasStream) {
          updateParticipantStatus(sessionId, data.participantId, { 
            hasVideo: true,
            lastActive: Date.now()
          });
        }
      }
    };
  } catch (e) {
    console.warn("BroadcastChannel not supported for stream info:", e);
  }

  // Set up broadcast channel fallback for signaling
  if (fallbackModeEnabled) {
    console.log("Using broadcast channel for signaling instead of socket.io");
    try {
      const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
      
      channel.onmessage = async (event) => {
        const { data } = event;
        
        if (data.type === 'participant-join') {
          console.log(`Participant joined via broadcast channel: ${data.participantId}`);
          activeParticipants[data.participantId] = true;
          
          // Update participant in session with video availability info
          updateParticipantStatus(sessionId, data.participantId, {
            hasVideo: data.hasVideo || false,
            active: true,
            lastActive: Date.now()
          });
          
          // Create peer connection after a short delay to allow participant to initialize
          setTimeout(() => {
            createPeerConnection(data.participantId, true);
          }, 1000);
        }
        else if (data.type === 'stream-info') {
          console.log(`Received stream info from: ${data.senderId}`, data);
          if (data.hasStream && !activePeerConnections[data.senderId]) {
            console.log(`Creating peer connection for participant with stream: ${data.senderId}`);
            createPeerConnection(data.senderId, true);
          }
          
          // Update participant in session with video info
          updateParticipantStatus(sessionId, data.senderId, {
            hasVideo: data.videoTracks > 0,
            active: true,
            lastActive: Date.now()
          });
        }
        else if (data.type === 'offer' && data.targetId === 'host') {
          console.log(`Received offer from participant: ${data.senderId}`);
          try {
            if (!activePeerConnections[data.senderId]) {
              createPeerConnection(data.senderId, false);
            }
            await activePeerConnections[data.senderId].setRemoteDescription(new RTCSessionDescription(data.description));
            const answer = await activePeerConnections[data.senderId].createAnswer();
            await activePeerConnections[data.senderId].setLocalDescription(answer);
            
            // Send answer back via broadcast channel
            channel.postMessage({
              type: 'answer',
              senderId: 'host',
              targetId: data.senderId,
              description: activePeerConnections[data.senderId].localDescription,
              timestamp: Date.now()
            });
          } catch (e) {
            console.error('Error handling offer via broadcast channel:', e);
          }
        }
        else if (data.type === 'candidate' && data.targetId === 'host') {
          console.log(`Received ICE candidate from participant: ${data.senderId}`);
          try {
            if (activePeerConnections[data.senderId] && data.candidate) {
              await activePeerConnections[data.senderId].addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } catch (e) {
            console.error('Error handling ICE candidate via broadcast channel:', e);
          }
        }
        else if (data.type === 'participant-leave') {
          console.log(`Participant left via broadcast channel: ${data.participantId}`);
          closePeerConnection(data.participantId);
        }
      };
      
      // Add diagnostic response channel
      try {
        const diagnosticChannel = new BroadcastChannel(`diagnostic-${sessionId}`);
        diagnosticChannel.onmessage = (event) => {
          const { data } = event;
          if (data.type === 'connection-diagnostics' || data.type === 'participant-diagnostics') {
            console.log(`Received diagnostics for session ${sessionId}:`, data);
          }
        };
        
        // Setup acknowledgment channel for test messages
        const liveChannel = new BroadcastChannel(`live-session-${sessionId}`);
        liveChannel.onmessage = (event) => {
          const { data } = event;
          if (data.testId && data.id) {
            console.log(`Received test message from participant ${data.id}:`, data);
            
            // Send acknowledgment
            try {
              const responseChannel = new BroadcastChannel(`response-${sessionId}`);
              responseChannel.postMessage({
                type: 'host-ack',
                testId: data.testId,
                timestamp: Date.now()
              });
              setTimeout(() => responseChannel.close(), 500);
            } catch (e) {
              console.error("Error sending acknowledgment:", e);
            }
          }
        };
      } catch (e) {
        console.warn("Error setting up diagnostic channels:", e);
      }
      
      // Keep the channel open and send regular heartbeats
      setInterval(() => {
        channel.postMessage({ type: 'host-heartbeat', timestamp: Date.now() });
      }, 5000);
      
      // Clean up on window unload
      window.addEventListener('beforeunload', () => {
        channel.postMessage({ type: 'host-leave', sessionId, timestamp: Date.now() });
        channel.close();
      });
    } catch (e) {
      console.error("Error setting up broadcast channel for signaling:", e);
    }
  }

  // Handle socket events if not in fallback mode
  if (!fallbackModeEnabled && socket) {
    socket.on('userJoined', async (participantId: string) => {
      console.log(`User joined via signaling server: ${participantId}`);
      activeParticipants[participantId] = true;
      createPeerConnection(participantId, true);
    });

    socket.on('offer', async (participantId: string, description: RTCSessionDescription) => {
      console.log(`Received offer from: ${participantId}`);
      try {
        if (!activePeerConnections[participantId]) {
          createPeerConnection(participantId, false);
        }
        await activePeerConnections[participantId].setRemoteDescription(description);
        const answer = await activePeerConnections[participantId].createAnswer();
        await activePeerConnections[participantId].setLocalDescription(answer);
        socket?.emit('answer', participantId, activePeerConnections[participantId].localDescription);
      } catch (e) {
        console.error('Error handling offer:', e);
      }
    });

    socket.on('candidate', async (participantId: string, candidate: RTCIceCandidate) => {
      console.log(`Received candidate from: ${participantId}`);
      try {
        if (candidate) {
          await activePeerConnections[participantId].addIceCandidate(candidate);
        }
      } catch (e) {
        console.error('Error handling candidate:', e);
      }
    });

    socket.on('userLeft', (participantId: string) => {
      console.log(`User ${participantId} left`);
      closePeerConnection(participantId);
    });
  }

  const createPeerConnection = async (participantId: string, isInitiator: boolean) => {
    console.log(`Creating peer connection for ${participantId}, isInitiator: ${isInitiator}`);
    
    // Close any existing connection
    if (activePeerConnections[participantId]) {
      console.log(`Closing existing connection for ${participantId}`);
      activePeerConnections[participantId].close();
    }
    
    activePeerConnections[participantId] = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

    activePeerConnections[participantId].onicecandidate = (event) => {
      if (event.candidate) {
        if (fallbackModeEnabled) {
          try {
            const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
            channel.postMessage({
              type: 'candidate',
              senderId: 'host',
              targetId: participantId,
              candidate: event.candidate,
              timestamp: Date.now()
            });
          } catch (e) {
            console.error("Error sending ICE candidate via broadcast channel:", e);
          }
        } else {
          socket?.emit('candidate', participantId, event.candidate);
        }
      }
    };

    activePeerConnections[participantId].oniceconnectionstatechange = () => {
      console.log(`ICE Connection State Change for ${participantId}:`, activePeerConnections[participantId].iceConnectionState);
      
      // Update participant status based on connection state
      if (activePeerConnections[participantId].iceConnectionState === 'connected' || 
          activePeerConnections[participantId].iceConnectionState === 'completed') {
        updateParticipantStatus(sessionId, participantId, { 
          active: true, 
          lastActive: Date.now(),
          hasVideo: true
        });
      }
      else if (activePeerConnections[participantId].iceConnectionState === 'disconnected' || 
               activePeerConnections[participantId].iceConnectionState === 'failed' ||
               activePeerConnections[participantId].iceConnectionState === 'closed') {
        if (activePeerConnections[participantId].iceConnectionState === 'failed') {
          // Try to restart ICE if it failed
          try {
            activePeerConnections[participantId].restartIce();
          } catch (e) {
            console.error("Error restarting ICE:", e);
          }
          
          // If restart doesn't work, recreate the connection
          setTimeout(() => {
            if (activePeerConnections[participantId]?.iceConnectionState === 'failed') {
              console.log("ICE restart failed, recreating connection");
              closePeerConnection(participantId);
              createPeerConnection(participantId, true);
            }
          }, 5000);
        }
        
        if (activePeerConnections[participantId].iceConnectionState === 'disconnected') {
          // Give some time for reconnection before closing
          setTimeout(() => {
            if (activePeerConnections[participantId]?.iceConnectionState === 'disconnected') {
              console.log("Connection remained disconnected, recreating");
              closePeerConnection(participantId);
              createPeerConnection(participantId, true);
            }
          }, 5000);
        } else if (activePeerConnections[participantId].iceConnectionState === 'closed') {
          closePeerConnection(participantId);
        }
      }
    };

    activePeerConnections[participantId].ontrack = (event: RTCTrackEvent) => {
      console.log(`Received track for participant ${participantId}:`, event.track);
      if (onParticipantTrackCallback) {
        onParticipantTrackCallback(participantId, event.track);
      }
      
      // Update participant video status
      updateParticipantStatus(sessionId, participantId, { 
        hasVideo: true,
        lastActive: Date.now()
      });
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        activePeerConnections[participantId].addTrack(track, localStream!);
      });
    }

    if (isInitiator) {
      try {
        const offer = await activePeerConnections[participantId].createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: true
        });
        
        // Set H.264 codec if available
        setH264CodecPreference(activePeerConnections[participantId]);
        
        await activePeerConnections[participantId].setLocalDescription(offer);
        
        if (fallbackModeEnabled) {
          try {
            const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
            channel.postMessage({
              type: 'offer',
              senderId: 'host',
              targetId: participantId,
              description: activePeerConnections[participantId].localDescription,
              timestamp: Date.now()
            });
          } catch (e) {
            console.error("Error sending offer via broadcast channel:", e);
          }
        } else {
          socket?.emit('offer', participantId, activePeerConnections[participantId].localDescription);
        }
      } catch (e) {
        console.error('Error creating offer:', e);
      }
    }
  };

  const closePeerConnection = (participantId: string) => {
    console.log(`Closing peer connection for ${participantId}`);
    if (activePeerConnections[participantId]) {
      activePeerConnections[participantId].close();
      delete activePeerConnections[participantId];
    }
    delete activeParticipants[participantId];
  };

  signalingSessions[sessionId] = true;
};

/**
 * Initializes the WebRTC connection for a participant
 */
export const initParticipantWebRTC = async (
  sessionId: string,
  participantId: string,
  stream: MediaStream
): Promise<void> => {
  if (!stream) {
    logger.error(`Cannot initialize participant WebRTC without a stream for ${participantId}`);
    throw new Error("Stream is required");
  }
  
  // Store the local stream
  localStream = stream;
  
  // Initialize socket first
  await initSocket(sessionId);
  
  // Create a peer connection for the participant
  const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
  activePeerConnections[participantId] = pc;

  // Set optimal codec preference based on browser
  setBestCodecPreference(pc);
  
  // Browser-specific handling for Safari
  if (browserType === 'safari') {
    // Safari requires special handling but we can't directly set policy on pc
    // We already set the policy in the config
  }
  
  // Add all tracks from the local stream
  try {
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
      logger.info(`Added ${track.kind} track to peer connection for ${participantId}`);
    });
  } catch (e) {
    logger.error(`Error adding tracks to peer connection for ${participantId}:`, e);
    throw e;
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      if (fallbackModeEnabled) {
        try {
          const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
          channel.postMessage({
            type: 'candidate',
            senderId: participantId,
            targetId: 'host',
            candidate: event.candidate,
            timestamp: Date.now()
          });
          setTimeout(() => channel.close(), 500);
        } catch (e) {
          logger.error(`Error sending ICE candidate via broadcast channel:`, e);
        }
      } else {
        try {
          socket?.emit('candidate', 'host', event.candidate);
        } catch (e) {
          logger.error(`Error sending ICE candidate via socket:`, e);
        }
      }
    }
  };

  pc.oniceconnectionstatechange = () => {
    logger.info(`ICE connection state for ${participantId}: ${pc.iceConnectionState}`);

    // If ICE connection fails or disconnects, try to restart it
    if (pc.iceConnectionState === 'failed') {
      // Restart ICE if supported
      try {
        pc.restartIce();
        logger.info(`Restarting ICE for ${participantId}`);
      } catch (e) {
        logger.error(`Error restarting ICE for ${participantId}:`, e);
      }
    } 
    // If closed, clean up resources
    else if (pc.iceConnectionState === 'closed') {
      closePeerConnection(participantId);
    }
    // If connected, update status
    else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      updateParticipantStatus(sessionId, participantId, { active: true, lastActive: Date.now() });
    }
  };
  
  // Set up signaling using fallback or socket.io
  if (fallbackModeEnabled) {
    try {
      const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
      
      // Listen for messages from the host
      channel.onmessage = async (event) => {
        const { data } = event;
        
        if (data.type === 'answer' && data.targetId === participantId) {
          logger.info(`Received answer from host via broadcast channel`);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.description));
          } catch (e) {
            logger.error(`Error setting remote description:`, e);
            
            // Try again with a delay - helps with Safari
            setTimeout(async () => {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.description));
                logger.info(`Successfully set remote description on retry`);
              } catch (retryError) {
                logger.error(`Error setting remote description on retry:`, retryError);
              }
            }, 1000);
          }
        }
        else if (data.type === 'candidate' && data.targetId === participantId) {
          logger.info(`Received ICE candidate from host via broadcast channel`);
          try {
            if (data.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } catch (e) {
            logger.error(`Error adding ICE candidate:`, e);
          }
        }
        else if (data.type === 'host-leave') {
          logger.info(`Host left via broadcast channel`);
          cleanupWebRTC();
        }
      };
      
      // Send a join message to the host
      channel.postMessage({
        type: 'participant-join',
        participantId,
        hasVideo: stream.getVideoTracks().length > 0,
        timestamp: Date.now()
      });
      
      // Create and send an offer to the host
      logger.info(`Creating offer for host`);
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        iceRestart: true
      });
      
      await pc.setLocalDescription(offer);
      
      channel.postMessage({
        type: 'offer',
        senderId: participantId,
        targetId: 'host',
        description: offer,
        timestamp: Date.now()
      });
    } catch (e) {
      logger.error(`Error setting up WebRTC via broadcast channel:`, e);
      throw e;
    }
  } else if (socket) {
    try {
      // Send a join message to the host
      socket.emit('participantJoin', {
        sessionId,
        participantId,
        hasVideo: stream.getVideoTracks().length > 0
      });
      
      // Set up socket listeners
      socket.on('answer', async (senderId: string, description: RTCSessionDescription) => {
        if (senderId === 'host') {
          logger.info(`Received answer from host via socket`);
          try {
            await pc.setRemoteDescription(description);
          } catch (e) {
            logger.error(`Error setting remote description:`, e);
          }
        }
      });
      
      socket.on('candidate', async (senderId: string, candidate: RTCIceCandidate) => {
        if (senderId === 'host') {
          logger.info(`Received ICE candidate from host via socket`);
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            logger.error(`Error adding ICE candidate:`, e);
          }
        }
      });
      
      // Create and send an offer to the host
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await pc.setLocalDescription(offer);
      socket.emit('offer', 'host', offer);
    } catch (e) {
      logger.error(`Error setting up WebRTC via socket:`, e);
      throw e;
    }
  } else {
    logger.error(`No signaling method available`);
    throw new Error("No signaling method available");
  }
  
  return;
};

// Initialize WebRTC connection for a telao session
export const initTelaoWebRTC = async (
  sessionId: string,
  callbacks: {
    onParticipantTrack?: (participantId: string, track: MediaStreamTrack) => void;
    onParticipantLeave?: (participantId: string) => void;
  } = {}
): Promise<() => void> => {
  if (callbacks.onParticipantTrack) {
    onParticipantTrackCallback = callbacks.onParticipantTrack;
  }
  
  await initSocket(sessionId);
  
  // Return cleanup function
  return () => {
    endWebRTC(sessionId);
  };
};

// Start screen sharing
export const startScreenShare = async (): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
      },
      audio: false,
    });
    
    localStream = stream;
    return stream;
  } catch (e) {
    console.error("Error starting screen share:", e);
    throw e;
  }
};

// Stop screen sharing
export const stopScreenShare = (): void => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
};

/**
 * Close a specific peer connection
 */
export const closePeerConnection = (participantId: string): void => {
  try {
    if (activePeerConnections[participantId]) {
      activePeerConnections[participantId].close();
      delete activePeerConnections[participantId];
      logger.info(`Closed peer connection for ${participantId}`);
    }
    
    delete activeParticipants[participantId];
  } catch (e) {
    logger.error(`Error closing peer connection for ${participantId}:`, e);
  }
};

/**
 * Ends the WebRTC session
 */
export const endWebRTC = (sessionId: string): void => {
  console.log(`Ending WebRTC session: ${sessionId}`);

  if (signalingSessions[sessionId]) {
    Object.keys(activePeerConnections).forEach(participantId => {
      closePeerConnection(participantId);
    });

    if (!fallbackModeEnabled && socket) {
      socket.emit('leaveSession', sessionId);
    }
    
    // Also notify through broadcast channel if in fallback mode
    if (fallbackModeEnabled) {
      try {
        const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
        channel.postMessage({ type: 'host-leave', sessionId });
        setTimeout(() => channel.close(), 1000);
      } catch (e) {
        console.error("Error sending leave message via broadcast channel:", e);
      }
    }
    
    delete signalingSessions[sessionId];
  }
};

/**
 * Cleanup all WebRTC connections
 */
export const cleanupWebRTC = (): void => {
  try {
    Object.keys(activePeerConnections).forEach(participantId => {
      try {
        activePeerConnections[participantId].close();
      } catch (e) {
        logger.error(`Error closing connection for ${participantId}:`, e);
      }
    });
    
    activePeerConnections = {};
    activeParticipants = {};
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      localStream = null;
    }
    
    if (socket) {
      socket.emit('disconnect');
      socket = null;
    }
    
    currentSessionId = null;
    onParticipantTrackCallback = null;
    
    logger.info(`WebRTC connections cleaned up`);
  } catch (e) {
    logger.error(`Error cleaning up WebRTC:`, e);
  }
};

// Set callback for participant track event
export const setOnParticipantTrack = (callback: (participantId: string, track: MediaStreamTrack) => void): void => {
  onParticipantTrackCallback = callback;
};

// Export activeParticipants for external use
export { activeParticipants, mediaStreamEstablished };
