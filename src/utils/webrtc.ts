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

const peerConnections: Record<string, PeerConnection> = {};

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

const peerConnectionConfig = {
  ...iceServers,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
  dtlsTransportPolicy: 'all',
};

const disconnectionEventHandlers: Record<string, () => void> = {};

const signalingStats = {
  sent: 0,
  received: 0,
  failed: 0,
  lastSentTimestamp: 0,
  lastReceivedTimestamp: 0,
  messageTypes: {} as Record<string, number>
};

export const initParticipantWebRTC = async (
  sessionId: string, 
  participantId: string,
  localStream: MediaStream
): Promise<void> => {
  console.log(`Initializing WebRTC for participant ${participantId} in session ${sessionId}`);
  
  Object.assign(signalingStats, {
    sent: 0,
    received: 0,
    failed: 0,
    lastSentTimestamp: 0,
    lastReceivedTimestamp: 0,
    messageTypes: {}
  });
  
  setupSignalingChannel(sessionId, participantId, 'participant');
  
  const sendReadyMessage = () => {
    console.log("Sending ready-to-connect message");
    sendSignalingMessage({
      type: 'offer',
      sender: participantId,
      payload: { type: 'ready-to-connect' },
      sessionId,
      timestamp: Date.now(),
    });
    
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
  
  sendReadyMessage();
  
  setTimeout(sendReadyMessage, 1000);
  setTimeout(sendReadyMessage, 3000);
  setTimeout(sendReadyMessage, 7000);
  
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

  setupDisconnectHandling(sessionId, participantId);
  
  setTimeout(() => {
    if (signalingStats.sent > 0 && signalingStats.received === 0) {
      console.warn("Signaling appears to be one-way only - messages sent but none received");
      console.log("Attempting signaling via alternative methods");
      sendReadyMessage();
    }
  }, 10000);
};

const setupDisconnectHandling = (sessionId: string, participantId: string) => {
  if (disconnectionEventHandlers[participantId]) {
    window.removeEventListener('beforeunload', disconnectionEventHandlers[participantId]);
  }
  
  const disconnectHandler = () => {
    console.log(`Participant ${participantId} disconnecting from session ${sessionId}`);
    
    sendSignalingMessage({
      type: 'offer',
      sender: participantId,
      payload: { type: 'participant-leave' },
      sessionId,
      timestamp: Date.now(),
    });
    
    try {
      window.localStorage.setItem(`telao-leave-${sessionId}-${participantId}`, JSON.stringify({
        type: 'participant-leave',
        id: participantId,
        timestamp: Date.now()
      }));
      
    } catch (e) {
      console.warn("Could not store disconnect info in localStorage:", e);
    }
    
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
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
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

export const initHostWebRTC = (
  sessionId: string,
  hostId: string = 'host'
): void => {
  console.log(`Initializing WebRTC for host in session ${sessionId}`);
  
  Object.assign(signalingStats, {
    sent: 0,
    received: 0,
    failed: 0,
    lastSentTimestamp: 0,
    lastReceivedTimestamp: 0,
    messageTypes: {}
  });
  
  setupSignalingChannel(sessionId, hostId, 'host');
  
  checkLocalStorageForParticipants(sessionId);
  
  const signalingHealthCheck = setInterval(() => {
    const now = Date.now();
    const timeSinceLastReceived = signalingStats.lastReceivedTimestamp > 0 ? 
      now - signalingStats.lastReceivedTimestamp : Infinity;
    
    console.log(`Signaling health: sent=${signalingStats.sent}, received=${signalingStats.received}, failed=${signalingStats.failed}`);
    console.log(`Message types:`, signalingStats.messageTypes);
    
    if (signalingStats.sent > 10 && signalingStats.received === 0) {
      console.warn("Potential signaling issue: Many messages sent but none received");
    }
    
    if (timeSinceLastReceived > 60000 && signalingStats.lastReceivedTimestamp > 0) {
      console.warn("No signaling messages received in over a minute");
    }
  }, 30000);
  
  return () => {
    clearInterval(signalingHealthCheck);
  };
};

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

export const createPeerConnection = async (
  remoteId: string,
  localStream?: MediaStream,
  onTrack?: (event: RTCTrackEvent) => void
): Promise<RTCPeerConnection> => {
  console.log(`Creating peer connection with ${remoteId}`);
  
  if (peerConnections[remoteId]) {
    const oldConnection = peerConnections[remoteId].connection;
    console.log(`Closing existing connection for ${remoteId}`);
    oldConnection.close();
    delete peerConnections[remoteId];
  }
  
  const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
  
  try {
    const transceiver = pc.addTransceiver('video', {
      direction: 'sendrecv',
      streams: localStream ? [localStream] : undefined,
    });
    
    const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
    if (codecs && transceiver.setCodecPreferences) {
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
      
      if (h264Codecs.length > 0) {
        transceiver.setCodecPreferences([...h264Codecs, ...vp8Codecs, ...otherCodecs]);
        console.log("Successfully prioritized H.264 codec for better mobile compatibility");
      } else if (vp8Codecs.length > 0) {
        transceiver.setCodecPreferences([...vp8Codecs, ...otherCodecs]);
        console.log("H.264 not available, using VP8 instead");
      }
    }
  } catch (error) {
    console.warn("Could not set codec preferences:", error);
  }
  
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
  
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE candidate generated for ${remoteId}:`, 
        event.candidate.protocol, 
        event.candidate.type, 
        event.candidate.address);
      
      if (!pc.localDescription) {
        console.warn(`ICE candidate generated before setting local description for ${remoteId}`);
      }
      
      sendSignalingMessage({
        type: 'ice-candidate',
        sender: 'host',
        receiver: remoteId,
        payload: event.candidate,
        sessionId: '',
        timestamp: Date.now(),
      });
      
      if (event.candidate.type === 'relay') {
        try {
          const key = `telao-ice-host-${remoteId}-${Date.now()}`;
          window.localStorage.setItem(key, JSON.stringify({
            type: 'ice-candidate',
            sender: 'host',
            receiver: remoteId,
            payload: event.candidate,
            timestamp: Date.now(),
          }));
          
          setTimeout(() => {
            try {
              window.localStorage.removeItem(key);
            } catch (e) {
              // Ignore errors
            }
          }, 30000);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    } else {
      console.log(`ICE candidate gathering complete for ${remoteId}`);
    }
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log(`ICE Connection state with ${remoteId}: ${pc.iceConnectionState}`);
    
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
  
  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${remoteId}: ${pc.connectionState}`);
    
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log(`Connection ${pc.connectionState}, attempting reconnection`);
      attemptReconnection(remoteId, localStream, onTrack);
    }
  };
  
  if (onTrack) {
    pc.ontrack = (event) => {
      console.log(`Received ${event.track.kind} track from ${remoteId}, readyState: ${event.track.readyState}`);
      
      onTrack(event);
      
      const monitorTrack = setInterval(() => {
        if (event.track.readyState !== 'live') {
          console.log(`Track ${event.track.kind} from ${remoteId} is no longer live (${event.track.readyState})`);
          
          if (peerConnections[remoteId] && pc.connectionState === 'connected') {
            console.log(`Attempting to recover dead track for ${remoteId}`);
            
            sendSignalingMessage({
              type: 'offer',
              sender: 'host',
              receiver: remoteId,
              payload: { type: 'request-new-track' },
              sessionId: '',
              timestamp: Date.now(),
            });
          }
          
          clearInterval(monitorTrack);
        }
      }, 2000);
      
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
  
  peerConnections[remoteId] = { 
    connection: pc,
    stream: localStream
  };
  
  return pc;
};

let onParticipantConnectRequest: ((participantId: string) => void) | null = null;

export const setOnParticipantConnectRequestCallback = (callback: (participantId: string) => void) => {
  onParticipantConnectRequest = callback;
};

const attemptReconnection = (
  remoteId: string,
  localStream?: MediaStream,
  onTrack?: (event: RTCTrackEvent) => void
) => {
  console.log(`Attempting to reconnect with ${remoteId}`);
  
  if (peerConnections[remoteId]) {
    const oldConnection = peerConnections[remoteId].connection;
    oldConnection.close();
    delete peerConnections[remoteId];
  }
  
  setTimeout(async () => {
    try {
      console.log(`Creating new connection for ${remoteId}`);
      await createPeerConnection(remoteId, localStream, onTrack);
      
      if (onTrack) {
        const pc = peerConnections[remoteId]?.connection;
        if (pc) {
          const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            iceRestart: true
          });
          
          if (offer.sdp) {
            offer.sdp = setSdpBitrateAndParams(offer.sdp, 800, true);
          }
          
          await pc.setLocalDescription(offer);
          
          sendSignalingMessage({
            type: 'offer',
            sender: 'host',
            receiver: remoteId,
            payload: pc.localDescription,
            sessionId: '',
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error(`Reconnection attempt with ${remoteId} failed:`, error);
    }
  }, 1000);
};

const setupSignalingChannel = (
  sessionId: string, 
  peerId: string,
  role: 'host' | 'participant'
) => {
  console.log(`Setting up signaling channels for ${role} with ID ${peerId} in session ${sessionId}`);
  const channels: { type: string, close?: () => void }[] = [];
  
  try {
    const channel = new BroadcastChannel(`telao-webrtc-${sessionId}`);
    
    channel.onmessage = async (event) => {
      const message: WebRTCMessage = event.data;
      
      signalingStats.received++;
      signalingStats.lastReceivedTimestamp = Date.now();
      signalingStats.messageTypes[message.type] = (signalingStats.messageTypes[message.type] || 0) + 1;
      
      console.log(`[BroadcastChannel] Received ${message.type} message from ${message.sender}`);
      await handleSignalingMessage(message, role, peerId, sessionId);
    };
    
    channels.push({ type: 'BroadcastChannel', close: () => channel.close() });
    console.log("BroadcastChannel signaling established");
  } catch (error) {
    console.warn('BroadcastChannel not supported, falling back to alternatives:', error);
  }
  
  try {
    const supabaseChannel = supabase.channel(`webrtc-${sessionId}`)
      .on('broadcast', { event: 'message' }, async (payload) => {
        const message: WebRTCMessage = payload.payload;
        
        signalingStats.received++;
        signalingStats.lastReceivedTimestamp = Date.now();
        signalingStats.messageTypes[message.type] = (signalingStats.messageTypes[message.type] || 0) + 1;
        
        console.log(`[Supabase] Received ${message.type} message from ${message.sender}`);
        await handleSignalingMessage(message, role, peerId, sessionId);
      })
      .subscribe((status) => {
        console.log(`Supabase channel status for ${sessionId}:`, status);
      });
    
    channels.push({ 
      type: 'Supabase', 
      close: () => supabaseChannel.unsubscribe() 
    });
    console.log("Supabase Realtime signaling established");
  } catch (error) {
    console.warn('Supabase Realtime setup failed:', error);
    signalingStats.failed++;
  }
  
  const localStorageCheckInterval = setInterval(() => {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(`telao-ice-`) && 
        (role === 'host' ? key.includes(peerId) : key.includes('host'))
      );
      
      let processed = 0;
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.type === 'ice-candidate') {
            signalingStats.received++;
            signalingStats.lastReceivedTimestamp = Date.now();
            signalingStats.messageTypes[data.type] = (signalingStats.messageTypes[data.type] || 0) + 1;
            
            handleSignalingMessage(data, role, peerId, sessionId);
            localStorage.removeItem(key);
            processed++;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (processed > 0) {
        console.log(`[LocalStorage] Processed ${processed} messages from localStorage`);
      }
      
      if (role === 'host') {
        checkLocalStorageForParticipants(sessionId);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, 1000);
  
  channels.push({ 
    type: 'LocalStorage', 
    close: () => clearInterval(localStorageCheckInterval) 
  });
  
  console.log(`Established ${channels.length} signaling channels for ${role} ${peerId}:`, 
    channels.map(c => c.type).join(', '));
  
  return () => {
    console.log(`Cleaning up signaling channels for ${role} ${peerId}`);
    channels.forEach(channel => {
      if (channel.close) {
        try {
          channel.close();
        } catch (e) {
          console.warn(`Error closing ${channel.type} channel:`, e);
        }
      }
    });
  };
};

const handleSignalingMessage = async (
  message: WebRTCMessage, 
  role: 'host' | 'participant',
  peerId: string,
  sessionId: string
) => {
  const { type, sender, receiver, payload } = message;
  
  if (receiver && receiver !== peerId && receiver !== '*') {
    return;
  }
  
  console.log(`Processing ${type} from ${sender} for ${receiver || 'broadcast'}`);
  
  const processingStart = performance.now();
  
  try {
    if (role === 'host') {
      if (type === 'offer' && payload?.type === 'ready-to-connect') {
        console.log(`Creating connection for participant ${sender}`);
        
        if (peerConnections[sender]?.connection && peerConnections[sender].connection.connectionState === 'connected') {
          console.log(`Already have a connected peer for ${sender}, ignoring duplicate ready message`);
          return;
        }
        
        if (onParticipantConnectRequest) {
          onParticipantConnectRequest(sender);
        }
        
        const pc = await createPeerConnection(sender, undefined, (event) => {
          console.log('Received track from participant:', event.track.kind);
          if (onParticipantTrack) {
            onParticipantTrack(sender, event);
          }
        });
        
        try {
          const offerOptions = {
            offerToReceiveAudio: false,
            offerToReceiveVideo: true,
            iceRestart: true,
            voiceActivityDetection: false
          };
          
          const offer = await pc.createOffer(offerOptions);
          
          if (offer.sdp) {
            offer.sdp = setSdpBitrateAndParams(offer.sdp, 800, true);
          }
          
          await pc.setLocalDescription(offer);
          
          sendSignalingMessage({
            type: 'offer',
            sender: peerId,
            receiver: sender,
            payload: pc.localDescription,
            sessionId,
            timestamp: Date.now(),
          });
          
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
        console.log(`Participant ${sender} has left, cleaning up their connection`);
        if (peerConnections[sender]) {
          peerConnections[sender].connection.close();
          delete peerConnections[sender];
        }
        
        if (onParticipantDisconnected) {
          onParticipantDisconnected(sender);
        }
        
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
        const pc = peerConnections[sender]?.connection;
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            console.log(`Successfully set remote description for ${sender}`);
            
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
          } catch (error) {
            console.error(`Error setting remote description for ${sender}:`, error);
          }
        }
      }
      else if (type === 'ice-candidate') {
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
      if (type === 'offer' && payload?.type !== 'ready-to-connect') {
        if (payload?.type === 'request-track-renewal' || payload?.type === 'request-new-track') {
          console.log("Host requested track renewal");
          
          if (peerConnections['host'] && localStream) {
            const pc = peerConnections['host'].connection;
            try {
              const senders = pc.getSenders();
              const videoSender = senders.find(s => s.track && s.track.kind === 'video');
              
              if (videoSender) {
                if (localStream.getVideoTracks().length > 0) {
                  const videoTrack = localStream.getVideoTracks()[0];
                  if (videoTrack.readyState === 'live') {
                    console.log("Replacing video track with fresh one");
                    await videoSender.replaceTrack(videoTrack);
                  } else {
                    console.log("Video track not live, requesting new stream");
                    cleanupWebRTC();
                    
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
                  }
                }
              } else {
                console.log("No video sender found, adding track");
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
        
        console.log("Received full offer from host");
        try {
          cleanupWebRTC();
          
          const pc = new RTCPeerConnection(peerConnectionConfig as RTCConfiguration);
          
          try {
            const transceiver = pc.addTransceiver('video', {
              direction: 'sendrecv'
            });
            
            const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs;
            if (codecs && transceiver.setCodecPreferences) {
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
              
              if (event.candidate.type === 'relay') {
                try {
                  const key = `telao-ice-${peerId}-${sender}-${Date.now()}`;
                  window.localStorage.setItem(key, JSON.stringify({
                    type: 'ice-candidate',
                    sender: peerId,
                    receiver: sender,
                    payload: event.candidate,
                    sessionId,
                    timestamp: Date.now(),
                  }));
                  
                  setTimeout(() => {
                    try {
                      window.localStorage.removeItem(key);
                    } catch (e) {
                      // Ignore errors
                    }
                  }, 30000);
                } catch (e) {
                  // Ignore localStorage errors
                }
              }
            } else {
              console.log(`ICE candidate gathering complete for ${remoteId}`);
            }
          };
          
          pc.oniceconnectionstatechange = () => {
            console.log(`Participant ICE state: ${pc.iceConnectionState}`);
            
            if (pc.iceConnectionState === 'failed') {
              console.error("Participant ICE connection failed, attempting recovery");
              
              if (pc.restartIce) {
                pc.restartIce();
              }
              
              setTimeout(() => {
                if (pc.iceConnectionState === 'failed') {
                  console.log("ICE still failed after restart attempt, signaling reconnect");
                  
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
          
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          
          const answer = await pc.createAnswer();
          
          if (answer.sdp) {
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
          
          peerConnections[sender] = { 
            connection: pc,
            stream: localStream
          };
          
          console.log("Successfully created and sent answer");
          
          const connectionMonitor = setInterval(() => {
            if (pc.connectionState === 'connected' && localStream) {
              const videoTracks = localStream.getVideoTracks();
              if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0];
                if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
                  console.log("Video track is not active, requesting camera restart");
                  
                  const event = new CustomEvent('video-track-inactive', { 
                    detail: { participantId: peerId } 
                  });
                  window.dispatchEvent(event);
                }
              }
            }
            
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              clearInterval(connectionMonitor);
            }
          }, 2000);
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      }
      else if (type === 'ice-candidate') {
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
    
    const processingTime = performance.now() - processingStart;
    if (processingTime > 100) {
      console.warn(`Signaling message processing took ${processingTime.toFixed(2)}ms, which is slow`);
    }
  } catch (error) {
    console.error(`Error processing signaling message (${type} from ${sender}):`, error);
  }
};

const setSdpBitrateAndParams = (sdp: string, bitrate: number, preferH264: boolean): string => {
  let modifiedSdp = sdp;
  
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
      
      lines.splice(insertPos, 0, `b=AS:${bitrate}`);
      lines.splice(insertPos + 1, 0, `b=TIAS:${bitrate * 1000}`);
      
      if (preferH264) {
        const mLineParts = videoMLine.split(' ');
        if (mLineParts.length > 3) {
          const payloadTypes = mLineParts.slice(3);
          let h264PayloadTypes: string[] = [];
          
          for (const pt of payloadTypes) {
            const rtpmapLine = lines.find(line => line.match(new RegExp(`a=rtpmap:${pt}\\s+H264`)));
            if (rtpmapLine) {
              h264PayloadTypes.push(pt);
            }
          }
          
          if (h264PayloadTypes.length > 0) {
            const newPayloadTypes = [...h264PayloadTypes, ...payloadTypes.filter(pt => !h264PayloadTypes.includes(pt))];
            lines[videoLineIndex] = mLineParts.join(' ');
          }
        }
      }
      
      const fmtpLineIndex = lines.findIndex(line => line.includes('a=fmtp:') && line.includes('profile-level-id'));
      if (fmtpLineIndex >= 0) {
        const currentLine = lines[fmtpLineIndex];
        if (!currentLine.includes('packetization-mode')) {
          lines[fmtpLineIndex] = `${currentLine};packetization-mode=1`;
        }
        
        if (!currentLine.includes('level-asymmetry-allowed')) {
          lines[fmtpLineIndex] = `${lines[fmtpLineIndex]};level-asymmetry-allowed=1`;
        }
      }
      
      modifiedSdp = lines.join('\r\n');
    }
  }
  
  return modifiedSdp;
};

export const sendSignalingMessage = (message: WebRTCMessage) => {
  console.log(`Sending ${message.type} message to ${message.receiver || 'broadcast'}`);
  
  signalingStats.sent++;
  signalingStats.lastSentTimestamp = Date.now();
  signalingStats.messageTypes[message.type] = (signalingStats.messageTypes[message.type] || 0) + 1;
  
  let broadcastSuccess = false;
  let supabaseSuccess = false;
  let localStorageSuccess = false;
  
  try {
    const channel = new BroadcastChannel(`telao-webrtc-${message.sessionId}`);
    channel.postMessage(message);
    setTimeout(() => channel.close(), 100);
    broadcastSuccess = true;
    console.log(`Sent ${message.type} via BroadcastChannel`);
  } catch (error) {
    console.warn('Error sending via BroadcastChannel:', error);
  }
  
  try {
    supabase.channel(`webrtc-${message.sessionId}`).send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });
    supabaseSuccess = true;
    console.log(`Sent ${message.type} via Supabase Realtime`);
  } catch (error) {
    console.warn('Error sending via Supabase:', error);
    signalingStats.failed++;
  }
  
  if ((!broadcastSuccess && !supabaseSuccess) || message.receiver) {
    try {
      const key = `telao-webrtc-${message.sessionId}-${message.receiver || 'broadcast'}-${Date.now()}`;
      window.localStorage.setItem(key, JSON.stringify(message));
      localStorageSuccess = true;
      console.log(`Sent ${message.type} via localStorage (key: ${key})`);
      
      setTimeout(() => {
        try {
          window.localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      }, 30000);
    } catch (error) {
      console.error('All signaling methods failed:', error);
      signalingStats.failed++;
    }
  }
  
  console.log(`Message delivery status [${message.type}]: BroadcastChannel=${broadcastSuccess}, Supabase=${supabaseSuccess}, localStorage=${localStorageSuccess}`);
  
  return { broadcastSuccess, supabaseSuccess, localStorageSuccess };
};

export const getSignalingStats = () => {
  return { ...signalingStats };
};

let onParticipantTrack: ((participantId: string, event: RTCTrackEvent) => void) | null = null;

export const setOnParticipantTrackCallback = (callback: (participantId: string, event: RTCTrackEvent) => void) => {
  onParticipantTrack = callback;
};

let onParticipantDisconnected: ((participantId: string) => void) | null = null;

export const setOnParticipantDisconnectedCallback = (callback: (participantId: string) => void) => {
  onParticipantDisconnected = callback;
};

export const getParticipantConnection = (participantId: string): PeerConnection | undefined => {
  return peerConnections[participantId];
};

export const cleanupWebRTC = (participantId?: string) => {
  if (participantId && peerConnections[participantId]) {
    console.log(`Cleaning up connection for participant ${participantId}`);
    const connection = peerConnections[participantId].connection;
    
    try {
      connection.getTransceivers().forEach(transceiver => {
        try {
          transceiver.stop();
        } catch (e) {
          console.warn("Error stopping transceiver:", e);
        }
      });
      
      connection.close();
    } catch (e) {
      console.warn("Error during connection cleanup:", e);
    }
    
    delete peerConnections[participantId];
    
    if (disconnectionEventHandlers[participantId]) {
      window.removeEventListener('beforeunload', disconnectionEventHandlers[participantId]);
      delete disconnectionEventHandlers[participantId];
    }
  } else if (!participantId) {
    console.log(`Cleaning up all WebRTC connections`);
    
    Object.keys(peerConnections).forEach(id => {
      try {
        const connection = peerConnections[id].connection;
        
        connection.getTransceivers().forEach(transceiver => {
          try {
            transceiver.stop();
          } catch (e) {
            console.warn(`Error stopping transceiver for ${id}:`, e);
          }
        });
        
        connection.close();
      } catch (e) {
        console.warn(`Error during connection cleanup for ${id}:`, e);
      }
    });
    
    Object.keys(peerConnections).forEach(id => {
      delete peerConnections[id];
    });
    
    Object.keys(disconnectionEventHandlers).forEach(id => {
      window.removeEventListener('beforeunload', disconnectionEventHandlers[id]);
      delete disconnectionEventHandlers[id];
    });
  }
};

let localStream: MediaStream | undefined;

export const setLocalStream = (stream: MediaStream) => {
  localStream = stream;
};

export const isParticipantConnected = (participantId: string): boolean => {
  const connection = peerConnections[participantId]?.connection;
  if (!connection) return false;
  
  return (
    connection.connectionState === 'connected' || 
    connection.iceConnectionState === 'connected' ||
    connection.iceConnectionState === 'completed'
  );
};

export const getConnectedParticipants = (): string[] => {
  return Object.keys(peerConnections).filter(id => isParticipantConnected(id));
};
