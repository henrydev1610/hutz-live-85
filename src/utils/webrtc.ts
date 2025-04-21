import { addParticipantToSession, updateParticipantStatus } from './sessionUtils';

// Define SocketType interface
interface SocketType {
  id: string;
  connected: boolean;
  on: (event: string, callback: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
}

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

let io: any;
import('socket.io-client').then(module => {
  io = module.io;
}).catch(err => {
  console.error("Error loading socket.io-client:", err);
});

let socket: SocketType | null = null;
let activePeerConnections: { [participantId: string]: RTCPeerConnection } = {};
let activeParticipants: { [participantId: string]: boolean } = {};
let signalingSessions: { [sessionId: string]: boolean } = {};
let currentSessionId: string | null = null;
let localStream: MediaStream | null = null;
let fallbackModeEnabled = false;

// Define the enableFallbackMode function that was missing
const enableFallbackMode = (): void => {
  console.log("Enabling fallback mode for signaling");
  fallbackModeEnabled = true;
  
  // Close socket if it exists
  if (socket) {
    try {
      socket.emit('disconnect');
    } catch (e) {
      console.error("Error disconnecting socket:", e);
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
        }
      }
    } catch (e) {
      console.warn('Error setting codec preferences:', e);
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
      console.warn("Socket.io client not loaded, switching to fallback mode");
      enableFallbackMode();
      resolve();
      return;
    }

    // Skip if we already have a socket for this session
    if (socket && socket.connected && currentSessionId === sessionId) {
      console.log('Socket already initialized for this session.');
      resolve();
      return;
    }

    // Try to connect to the signaling server
    try {
      // Fix for "process is not defined" error - use import.meta.env instead
      const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'https://signaling.hutz.co';
      console.log(`Connecting to signaling server at ${serverUrl}...`);
      
      socket = io(serverUrl);

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.warn("Socket connection timeout, switching to fallback mode");
        enableFallbackMode();
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        console.log('Socket connected:', socket?.id);
        currentSessionId = sessionId;
        socket?.emit('joinSession', sessionId);
        resolve();
      });

      socket.on('connect_error', (error: any) => {
        clearTimeout(connectionTimeout);
        console.error('Socket connection error, switching to fallback mode:', error);
        enableFallbackMode();
        resolve();
      });

      socket.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          console.warn("Permanent disconnection, switching to fallback mode");
          enableFallbackMode();
        }
      });
    } catch (error) {
      console.error("Error initializing socket:", error);
      enableFallbackMode();
      resolve();
    }
  });
};

/**
 * Initializes the WebRTC connection for the host
 */
export const initHostWebRTC = async (
  sessionId: string,
  onTrack: (participantId: string, track: MediaStreamTrack) => void
): Promise<void> => {
  onParticipantTrackCallback = onTrack;

  // Don't initialize localStream - we'll do that separately when needed
  // This ensures camera doesn't turn on just for generating QR code

  await initSocket(sessionId);

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
          createPeerConnection(data.participantId, true);
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
              description: activePeerConnections[data.senderId].localDescription
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
      
      // Keep the channel open
      setInterval(() => {
        channel.postMessage({ type: 'host-heartbeat', timestamp: Date.now() });
      }, 10000);
      
      // Clean up on window unload
      window.addEventListener('beforeunload', () => {
        channel.postMessage({ type: 'host-leave', sessionId });
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
              candidate: event.candidate
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
        updateParticipantStatus(sessionId, participantId, { active: true, lastActive: Date.now() });
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
        }
        
        if (activePeerConnections[participantId].iceConnectionState === 'disconnected') {
          // Give some time for reconnection before closing
          setTimeout(() => {
            if (activePeerConnections[participantId]?.iceConnectionState === 'disconnected') {
              closePeerConnection(participantId);
            }
          }, 5000);
        } else if (activePeerConnections[participantId].iceConnectionState === 'closed') {
          closePeerConnection(participantId);
        }
      }
    };

    activePeerConnections[participantId].ontrack = (event: RTCTrackEvent) => {
      console.log(`Received track for participant ${participantId}`);
      if (onParticipantTrackCallback) {
        onParticipantTrackCallback(participantId, event.track);
      }
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
              description: activePeerConnections[participantId].localDescription
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

let onParticipantTrackCallback: ((participantId: string, track: MediaStreamTrack) => void) | null = null;
let mediaStreamEstablished = false;

/**
 * Initializes the WebRTC connection for a participant
 */
export const initParticipantWebRTC = async (
  sessionId: string,
  participantId: string,
  stream: MediaStream
): Promise<void> => {
  localStream = stream;
  console.log(`Initializing participant WebRTC with stream:`, stream);
  console.log(`Stream has ${stream.getTracks().length} tracks:`, stream.getTracks().map(t => t.kind));

  // Make sure the stream is active and has tracks
  if (!stream.active || stream.getTracks().length === 0) {
    console.warn("Stream provided to initParticipantWebRTC is not active or has no tracks");
    // Try to recover by refreshing the stream
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      localStream = newStream;
      stream = newStream;
      console.log("Created new stream with", stream.getTracks().length, "tracks");
    } catch (e) {
      console.error("Failed to create recovery stream:", e);
    }
  }

  await initSocket(sessionId);

  // Set up broadcast channel fallback for signaling
  if (fallbackModeEnabled) {
    console.log("Participant using broadcast channel for signaling");
    try {
      const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
      
      // Announce our joining
      channel.postMessage({
        type: 'participant-join',
        participantId: participantId
      });
      
      // Send stream information
      channel.postMessage({
        type: 'stream-info',
        senderId: participantId,
        hasStream: true,
        trackCount: stream.getTracks().length
      });
      
      // Listen for messages
      channel.onmessage = async (event) => {
        const { data } = event;
        
        if (data.type === 'offer' && data.targetId === participantId) {
          console.log(`Received offer from host via broadcast channel`);
          try {
            if (!activePeerConnections['host']) {
              createHostPeerConnection(sessionId, participantId);
            }
            await activePeerConnections['host'].setRemoteDescription(new RTCSessionDescription(data.description));
            const answer = await activePeerConnections['host'].createAnswer();
            await activePeerConnections['host'].setLocalDescription(answer);
            
            // Send answer back via broadcast channel
            channel.postMessage({
              type: 'answer',
              senderId: participantId,
              targetId: 'host',
              description: activePeerConnections['host'].localDescription
            });
          } catch (e) {
            console.error('Error handling offer via broadcast channel:', e);
          }
        }
        else if (data.type === 'answer' && data.targetId === participantId) {
          console.log(`Received answer from host via broadcast channel`);
          try {
            await activePeerConnections['host'].setRemoteDescription(new RTCSessionDescription(data.description));
          } catch (e) {
            console.error('Error handling answer via broadcast channel:', e);
          }
        }
        else if (data.type === 'candidate' && data.targetId === participantId) {
          console.log(`Received ICE candidate from host via broadcast channel`);
          try {
            if (data.candidate) {
              await activePeerConnections['host'].addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } catch (e) {
            console.error('Error handling ICE candidate via broadcast channel:', e);
          }
        }
        else if (data.type === 'host-leave') {
          console.log(`Host left via broadcast channel`);
          closePeerConnection('host');
        }
      };
      
      // Create the peer connection
      createHostPeerConnection(sessionId, participantId);
      
      // Keep sending stream info in case host missed it
      const infoInterval = setInterval(() => {
        channel.postMessage({
          type: 'stream-info',
          senderId: participantId,
          hasStream: true,
          trackCount: stream.getTracks().length
        });
      }, 5000);
      
      // Clean up on window unload
      window.addEventListener('beforeunload', () => {
        clearInterval(infoInterval);
        channel.postMessage({ type: 'participant-leave', participantId });
        channel.close();
      });
    } catch (e) {
      console.error("Error setting up broadcast channel for signaling:", e);
    }
  }

  // Handle socket events if not in fallback mode
  if (!fallbackModeEnabled && socket) {
    socket.on('answer', async (hostId: string, description: RTCSessionDescription) => {
      console.log(`Received answer from host: ${hostId}`);
      try {
        await activePeerConnections[hostId].setRemoteDescription(description);
      } catch (e) {
        console.error('Error handling answer:', e);
      }
    });

    socket.on('candidate', async (hostId: string, candidate: RTCIceCandidate) => {
      console.log(`Received candidate from host: ${hostId}`);
      try {
        if (candidate) {
          await activePeerConnections[hostId].addIceCandidate(candidate);
        }
      } catch (e) {
        console.error('Error handling candidate:', e);
      }
    });

    // Send stream info via socket
    socket.emit('stream-info', participantId, {
      hasStream: true,
      trackCount: stream.getTracks().length
    });

    createHostPeerConnection(sessionId, participantId);
  }
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

// Sets the local stream with additional checks
export const setLocalStream = (stream: MediaStream): void => {
  console.log(`Setting local stream with ${stream.getTracks().length} tracks`);
  
  // Check if stream is active
  if (!stream.active) {
    console.warn("Stream is not active when setting as local stream");
  }
  
  // Log track details
  stream.getTracks().forEach(track => {
    console.log(`Track: ${track.kind}, ID: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
  });
  
  localStream = stream;
  
  // Update existing peer connections with the new stream
  Object.keys(activePeerConnections).forEach(peerId => {
    const pc = activePeerConnections[peerId];
    
    // Remove any existing tracks
    const senders = pc.getSenders();
    senders.forEach(sender => {
      if (sender.track) {
        pc.removeTrack(sender);
      }
    });
    
    // Add the new tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
  });
};

// Create host peer connection with enhanced debugging
const createHostPeerConnection = async (sessionId: string, participantId: string) => {
  console.log(`Creating participant->host peer connection`);
  
  activePeerConnections['host'] = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

  activePeerConnections['host'].onicecandidate = (event) => {
    if (event.candidate) {
      if (fallbackModeEnabled) {
        try {
          const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
          channel.postMessage({
            type: 'candidate',
            senderId: participantId,
            targetId: 'host',
            candidate: event.candidate
          });
        } catch (e) {
          console.error("Error sending ICE candidate via broadcast channel:", e);
        }
      } else if (socket) {
        socket.emit('candidate', sessionId, event.candidate);
      }
    }
  };

  activePeerConnections['host'].oniceconnectionstatechange = () => {
    console.log(`ICE Connection State Change for Host:`, activePeerConnections['host'].iceConnectionState);
    
    // Verify media is flowing when connected
    if (activePeerConnections['host'].iceConnectionState === 'connected' || 
        activePeerConnections['host'].iceConnectionState === 'completed') {
      mediaStreamEstablished = true;
      console.log("WebRTC peer connection successfully established");
    }
    
    // Attempt to restart ICE if the connection fails
    if (activePeerConnections['host'].iceConnectionState === 'failed') {
      console.log("ICE connection failed, attempting to restart");
      try {
        activePeerConnections['host'].restartIce();
      } catch (e) {
        console.error("Error restarting ICE:", e);
      }
      
      // Try recreating the peer connection if restart doesn't work
      setTimeout(() => {
        if (activePeerConnections['host']?.iceConnectionState === 'failed') {
          console.log("ICE restart didn't help, recreating connection");
          closePeerConnection('host');
          createHostPeerConnection(sessionId, participantId);
        }
      }, 5000);
    }
    // Close the connection if it's been disconnected for too long
    else if (activePeerConnections['host'].iceConnectionState === 'disconnected') {
      setTimeout(() => {
        if (activePeerConnections['host']?.iceConnectionState === 'disconnected') {
          closePeerConnection('host');
        }
      }, 5000);
    }
    else if (activePeerConnections['host'].iceConnectionState === 'closed') {
      closePeerConnection('host');
    }
  };
  
  // Add logging for connection state changes
  activePeerConnections['host'].onconnectionstatechange = () => {
    console.log(`Connection State Change for Host:`, activePeerConnections['host'].connectionState);
  };

  // Log when negotiation is needed
  activePeerConnections['host'].onnegotiationneeded = () => {
    console.log("Negotiation needed for host connection");
  };

  if (localStream) {
    console.log(`Adding ${localStream.getTracks().length} tracks to peer connection:`, 
      localStream.getTracks().map(t => `${t.kind} (${t.id}) - enabled: ${t.enabled}, readyState: ${t.readyState}`));
    
    try {
      localStream.getTracks().forEach(track => {
        console.log(`Adding track to peer connection: ${track.kind} (${track.id}), enabled: ${track.enabled}, readyState: ${track.readyState}`);
        activePeerConnections['host'].addTrack(track, localStream!);
      });
    } catch (e) {
      console.error("Error adding tracks to peer connection:", e);
    }
  } else {
    console.warn("No local stream available when creating peer connection");
  }

  try {
    const offer = await activePeerConnections['host'].createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: true
    });
    
    // Set H.264 codec if available
    setH264CodecPreference(activePeerConnections['host']);
    
    await activePeerConnections['host'].setLocalDescription(offer);
    
    if (fallbackModeEnabled) {
      try {
        const channel = new BroadcastChannel(`webrtc-signaling-${sessionId}`);
        channel.postMessage({
          type: 'offer',
          senderId: participantId,
          targetId: 'host',
          description: activePeerConnections['host'].localDescription
        });
      } catch (e) {
        console.error("Error sending offer via broadcast channel:", e);
      }
    } else if (socket) {
      socket.emit('offer', sessionId, activePeerConnections['host'].localDescription);
    }
  } catch (e) {
    console.error('Error creating offer:', e);
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
 * Cleans up WebRTC connections for a specific participant or all participants
 * @param participantId Optional participant ID to clean up only that connection
 */
export const cleanupWebRTC = (participantId?: string): void => {
  // If participantId is provided, only clean up that specific connection
  if (participantId && activePeerConnections[participantId]) {
    console.log(`Cleaning up WebRTC connection for participant ${participantId}`);
    
    try {
      // Close the specific peer connection
      activePeerConnections[participantId].close();
      delete activePeerConnections[participantId];
      
      // Remove the participant from active participants
      if (activeParticipants[participantId]) {
        delete activeParticipants[participantId];
      }
    } catch (error) {
      console.error(`Error cleaning up WebRTC connection for ${participantId}:`, error);
    }
  } 
  // If no participantId is provided, clean up all connections
  else if (!participantId) {
    console.log('Cleaning up all WebRTC connections');
    
    // Close all peer connections
    Object.keys(activePeerConnections).forEach(id => {
      try {
        activePeerConnections[id].close();
      } catch (error) {
        console.error(`Error closing peer connection for ${id}:`, error);
      }
    });
    
    // Reset all state variables
    activePeerConnections = {};
    activeParticipants = {};
    signalingSessions = {};
    currentSessionId = null;
    localStream = null;
    onParticipantTrackCallback = null;
    fallbackModeEnabled = false;
  }
};

// Close a specific peer connection
const closePeerConnection = (participantId: string) => {
  console.log(`Closing peer connection for ${participantId}`);
  if (activePeerConnections[participantId]) {
    activePeerConnections[participantId].close();
    delete activePeerConnections[participantId];
  }
  delete activeParticipants[participantId];
};

// Set callback for participant track event
export const setOnParticipantTrack = (callback: (participantId: string, track: MediaStreamTrack) => void): void => {
  onParticipantTrackCallback = callback;
};

// Export activeParticipants for external use
export { activeParticipants, mediaStreamEstablished };
