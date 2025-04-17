
let localStream: MediaStream | null = null;

export const setLocalStream = (stream: MediaStream) => {
  localStream = stream;
  
  // Log stream details for debugging
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length) {
    console.log('Using video device:', videoTracks[0].label);
    console.log('Video track settings:', videoTracks[0].getSettings());
    console.log('Video track constraints:', videoTracks[0].getConstraints());
  }
};

// Store peer connections for debugging and management
(window as any)._peerConnections = {};

// Configure WebRTC with proper STUN/TURN servers
const getIceServers = () => {
  return [
    { 
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ] 
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'public',
      credential: 'public'
    },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'public',
      credential: 'public'
    }
  ];
};

// Track participant connections
const participantConnections: Record<string, {
  peerConnection: RTCPeerConnection,
  sessionId: string,
  participantId: string
}> = {};

// Callback for when a new track is received from a participant
let onParticipantTrackCallback: ((participantId: string, stream: MediaStream) => void) | null = null;

export const setOnParticipantTrackCallback = (callback: (participantId: string, stream: MediaStream) => void) => {
  onParticipantTrackCallback = callback;
};

export const getParticipantConnection = (participantId: string) => {
  return participantConnections[participantId]?.peerConnection || null;
};

// Initialize WebRTC for host
export const initHostWebRTC = (sessionId: string, onTrack?: (participantId: string, stream: MediaStream) => void) => {
  console.log(`Initializing host WebRTC for session ${sessionId}`);
  
  if (onTrack) {
    onParticipantTrackCallback = onTrack;
  }
  
  // Listen for offers from participants
  try {
    const offerChannel = new BroadcastChannel(`telao-offer-${sessionId}`);
    offerChannel.onmessage = async (event) => {
      const data = event.data;
      if (data && data.type === 'offer' && data.offer && data.participantId) {
        console.log(`Received offer from participant ${data.participantId}`);
        await handleParticipantOffer(sessionId, data.participantId, data.offer);
      }
    };
    
    // Check localStorage for offers (fallback method)
    const checkLocalStorageForOffers = async () => {
      // Find all offer keys
      const offerKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`telao-offer-${sessionId}`)) {
          offerKeys.push(key);
        }
      }
      
      // Process offers
      for (const key of offerKeys) {
        const offerData = localStorage.getItem(key);
        if (offerData) {
          try {
            const data = JSON.parse(offerData);
            
            if (data && data.type === 'offer' && data.offer && data.participantId && 
                (!participantConnections[data.participantId] || 
                participantConnections[data.participantId].peerConnection.connectionState !== 'connected')) {
              console.log(`Found offer in localStorage from participant ${data.participantId}`);
              await handleParticipantOffer(sessionId, data.participantId, data.offer);
            }
          } catch (e) {
            console.warn("Error processing localStorage offer:", e);
          }
          localStorage.removeItem(key);
        }
      }
    };
    
    // Check immediately and then periodically
    checkLocalStorageForOffers();
    setInterval(checkLocalStorageForOffers, 2000);
    
    // Listen for ICE candidates from participants
    const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}`);
    candidateChannel.onmessage = async (event) => {
      const data = event.data;
      if (data && data.type === 'ice-candidate' && data.candidate && data.participantId) {
        await handleParticipantIceCandidate(data.participantId, data.candidate);
      }
    };
    
    console.log("Host WebRTC initialized successfully");
    return true;
  } catch (e) {
    console.error("Error initializing host WebRTC:", e);
    return false;
  }
};

// Handle an offer from a participant
const handleParticipantOffer = async (sessionId: string, participantId: string, offer: RTCSessionDescriptionInit) => {
  try {
    console.log(`Handling offer from participant ${participantId}`);
    
    let peerConnection: RTCPeerConnection;
    
    // Check if we already have a connection for this participant
    if (participantConnections[participantId]) {
      console.log(`Using existing peer connection for participant ${participantId}`);
      peerConnection = participantConnections[participantId].peerConnection;
      
      // If the connection is failing, restart it
      if (['failed', 'disconnected', 'closed'].includes(peerConnection.iceConnectionState)) {
        console.log(`Existing connection in bad state (${peerConnection.iceConnectionState}), creating new one`);
        peerConnection.close();
        peerConnection = createPeerConnection(sessionId, participantId);
        participantConnections[participantId].peerConnection = peerConnection;
      }
    } else {
      console.log(`Creating new peer connection for participant ${participantId}`);
      peerConnection = createPeerConnection(sessionId, participantId);
      participantConnections[participantId] = {
        peerConnection,
        sessionId,
        participantId
      };
    }
    
    // Set remote description from the participant's offer
    console.log(`Setting remote description from offer for participant ${participantId}`);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create and send answer
    console.log(`Creating answer for participant ${participantId}`);
    const answer = await peerConnection.createAnswer();
    
    // Set local description with the created answer
    console.log(`Setting local description with answer for participant ${participantId}`);
    await peerConnection.setLocalDescription(answer);
    
    // Send answer to the participant via broadcast channel
    try {
      console.log(`Sending answer to participant ${participantId} via broadcast channel`);
      const answerChannel = new BroadcastChannel(`telao-answer-${sessionId}-${participantId}`);
      answerChannel.postMessage({
        type: 'answer',
        sessionId,
        participantId,
        answer: peerConnection.localDescription,
        timestamp: Date.now()
      });
      setTimeout(() => answerChannel.close(), 500);
    } catch (e) {
      console.warn("BroadcastChannel not supported for answer, using localStorage", e);
    }
    
    // Also use localStorage as fallback for the answer
    try {
      console.log(`Sending answer to participant ${participantId} via localStorage`);
      const answerKey = `telao-answer-${sessionId}-${participantId}`;
      localStorage.setItem(answerKey, JSON.stringify({
        type: 'answer',
        sessionId,
        participantId,
        answer: peerConnection.localDescription,
        timestamp: Date.now()
      }));
      
      // Remove from localStorage after 30 seconds
      setTimeout(() => {
        try {
          localStorage.removeItem(answerKey);
        } catch (e) {
          // Ignore errors
        }
      }, 30000);
    } catch (e) {
      console.warn("localStorage not supported for answer", e);
    }
    
    console.log(`Offer handling completed for participant ${participantId}`);
    return true;
  } catch (error) {
    console.error(`Error handling offer from participant ${participantId}:`, error);
    return false;
  }
};

// Create a new peer connection for a participant
const createPeerConnection = (sessionId: string, participantId: string) => {
  console.log(`Creating peer connection for session ${sessionId}, participant ${participantId}`);
  
  // Configure peer connection with STUN/TURN servers
  const peerConnection = new RTCPeerConnection({
    iceServers: getIceServers(),
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10,
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle'
  });
  
  // Add participant ID for debugging
  (peerConnection as any).participantId = participantId;
  
  // Save to global for debugging
  (window as any)._peerConnections = (window as any)._peerConnections || {};
  (window as any)._peerConnections[participantId] = peerConnection;
  
  // Set up ICE candidate handling (from host to participant)
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log(`Generated ICE candidate for participant ${participantId}`);
      
      // Send candidate to the participant via broadcast channel
      try {
        const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}-${participantId}`);
        candidateChannel.postMessage({
          type: 'ice-candidate',
          sessionId,
          participantId,
          candidate: event.candidate,
          timestamp: Date.now()
        });
        setTimeout(() => candidateChannel.close(), 500);
      } catch (e) {
        console.warn("BroadcastChannel not supported for ICE candidates", e);
      }
      
      // Also use localStorage as fallback for ICE candidates
      try {
        const candidateKey = `telao-ice-${sessionId}-${participantId}-${Date.now()}`;
        localStorage.setItem(candidateKey, JSON.stringify({
          type: 'ice-candidate',
          sessionId,
          participantId,
          candidate: event.candidate,
          timestamp: Date.now()
        }));
        
        // Remove after 30 seconds to avoid cluttering localStorage
        setTimeout(() => {
          try {
            localStorage.removeItem(candidateKey);
          } catch (e) {
            // Ignore errors
          }
        }, 30000);
      } catch (e) {
        console.warn("localStorage not supported for ICE candidates", e);
      }
    }
  };
  
  // Set up track handling from participant
  peerConnection.ontrack = (event) => {
    console.log(`Received track from participant ${participantId}:`, event.track.kind);
    
    // Merge all tracks from this participant into a single stream
    const participantStream = new MediaStream();
    
    event.streams.forEach(stream => {
      stream.getTracks().forEach(track => {
        participantStream.addTrack(track);
      });
    });
    
    // If there's no stream from the participant, use the track directly
    if (event.streams.length === 0) {
      participantStream.addTrack(event.track);
    }
    
    // Notify via broadcast channel about the stream
    try {
      const streamChannel = new BroadcastChannel(`live-session-${sessionId}`);
      streamChannel.postMessage({
        type: 'video-stream-info',
        id: participantId,
        hasStream: true,
        trackKind: event.track.kind,
        timestamp: Date.now()
      });
      setTimeout(() => streamChannel.close(), 500);
    } catch (e) {
      console.warn("BroadcastChannel not supported for stream notification", e);
    }
    
    // Also use the backup channel
    try {
      const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
      backupChannel.postMessage({
        type: 'video-stream-info',
        id: participantId,
        hasStream: true,
        trackKind: event.track.kind,
        timestamp: Date.now()
      });
      setTimeout(() => backupChannel.close(), 500);
    } catch (e) {
      // Ignore errors
    }
    
    // Call the callback if it exists
    if (onParticipantTrackCallback) {
      console.log(`Calling onParticipantTrackCallback for participant ${participantId}`);
      onParticipantTrackCallback(participantId, participantStream);
    } else {
      console.warn(`No onParticipantTrackCallback registered for participant ${participantId}`);
    }
  };
  
  // Set up connection state monitoring
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state changed to ${peerConnection.connectionState} for participant ${participantId}`);
    
    // Attempt to restart ICE if connection fails
    if (peerConnection.connectionState === 'failed') {
      console.log(`Attempting to restart ICE for participant ${participantId}`);
      peerConnection.restartIce();
    }
    
    // Notify about connection state changes
    try {
      const stateChannel = new BroadcastChannel(`telao-state-${sessionId}`);
      stateChannel.postMessage({
        type: 'connection-state',
        participantId,
        state: peerConnection.connectionState,
        timestamp: Date.now()
      });
      setTimeout(() => stateChannel.close(), 500);
    } catch (e) {
      // Ignore errors
    }
    
    // Set heartbeat in localStorage for status checking
    if (peerConnection.connectionState === 'connected') {
      try {
        const heartbeatKey = `telao-heartbeat-${participantId}`;
        localStorage.setItem(heartbeatKey, Date.now().toString());
      } catch (e) {
        // Ignore errors
      }
    }
  };
  
  // Set up ICE connection state monitoring
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state changed to ${peerConnection.iceConnectionState} for participant ${participantId}`);
    
    // Update heartbeat on connected state
    if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
      try {
        const heartbeatKey = `telao-heartbeat-${participantId}`;
        localStorage.setItem(heartbeatKey, Date.now().toString());
      } catch (e) {
        // Ignore errors
      }
    }
  };
  
  return peerConnection;
};

// Handle an ICE candidate from a participant
const handleParticipantIceCandidate = async (participantId: string, candidate: RTCIceCandidateInit) => {
  try {
    const connection = participantConnections[participantId];
    if (connection && connection.peerConnection.remoteDescription) {
      console.log(`Adding ICE candidate from participant ${participantId}`);
      await connection.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } else {
      console.warn(`Cannot add ICE candidate: no connection for participant ${participantId} or remote description not set`);
      return false;
    }
  } catch (error) {
    console.error(`Error handling ICE candidate from participant ${participantId}:`, error);
    return false;
  }
};

// Initialize WebRTC for participant
export const initParticipantWebRTC = async (sessionId: string, participantId: string, stream: MediaStream) => {
  try {
    if (!stream) {
      console.error("No media stream provided to initParticipantWebRTC");
      return false;
    }
    
    // Configure peer connection with STUN/TURN servers and options for better NAT traversal
    const peerConnection = new RTCPeerConnection({
      iceServers: getIceServers(),
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10, // Increase candidate pool for better connectivity
      rtcpMuxPolicy: 'require',
      bundlePolicy: 'max-bundle'
    });
    
    // Save to global for debugging
    (window as any)._peerConnections = (window as any)._peerConnections || {};
    (window as any)._peerConnections[sessionId] = peerConnection;
    
    // Add all tracks from the stream
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.error("No video tracks in stream");
      return false;
    }
    
    // Log current resolution and frame rate
    console.log("Video track settings:", videoTracks[0].getSettings());
    
    // Add each track to the peer connection
    stream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection`);
      peerConnection.addTrack(track, stream);
    });
    
    // Set up ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`ICE candidate for session ${sessionId}:`, event.candidate.candidate);
        
        // Send candidate to the host via broadcast channel and localStorage
        try {
          const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}`);
          candidateChannel.postMessage({
            type: 'ice-candidate',
            sessionId,
            participantId,
            candidate: event.candidate,
            timestamp: Date.now()
          });
          setTimeout(() => candidateChannel.close(), 500);
        } catch (e) {
          console.warn("BroadcastChannel not supported for ICE candidates", e);
        }
        
        // Also use localStorage as fallback for ICE candidates
        try {
          const candidateKey = `telao-ice-${sessionId}-${participantId}-${Date.now()}`;
          localStorage.setItem(candidateKey, JSON.stringify({
            type: 'ice-candidate',
            sessionId,
            participantId,
            candidate: event.candidate,
            timestamp: Date.now()
          }));
          
          // Remove after 30 seconds to avoid cluttering localStorage
          setTimeout(() => {
            try {
              localStorage.removeItem(candidateKey);
            } catch (e) {
              // Ignore errors
            }
          }, 30000);
        } catch (e) {
          console.warn("localStorage not supported for ICE candidates", e);
        }
      } else {
        console.log("ICE candidate gathering complete");
      }
    };
    
    // Set up debugging events for connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state changed to: ${peerConnection.iceConnectionState}`);
      
      if (peerConnection.iceConnectionState === 'failed') {
        console.log("Attempting to restart ICE");
        peerConnection.restartIce();
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state changed to: ${peerConnection.connectionState}`);
      
      // Notify about connections for debugging
      try {
        const stateChannel = new BroadcastChannel(`telao-state-${sessionId}`);
        stateChannel.postMessage({
          type: 'connection-state',
          participantId,
          state: peerConnection.connectionState,
          timestamp: Date.now()
        });
        setTimeout(() => stateChannel.close(), 500);
      } catch (e) {
        // Ignore errors
      }
    };
    
    // Create and set local description with H.264 preference
    try {
      // Create offer with specific codec preferences
      const offerOptions = {
        offerToReceiveAudio: false,
        offerToReceiveVideo: true
      };
      
      const offer = await peerConnection.createOffer(offerOptions);
      
      // Prefer H.264 codec (if available) for better compatibility
      let sdpWithH264Preference = offer.sdp;
      if (sdpWithH264Preference && sdpWithH264Preference.includes('H264')) {
        // Modify SDP to prefer H.264 codec if available
        const lines = sdpWithH264Preference.split('\r\n');
        const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
        
        if (videoMLineIndex !== -1) {
          // Find the payload types
          const videoPayloadTypes = [];
          let rtpmapH264Index = -1;
          
          for (let i = videoMLineIndex + 1; i < lines.length; i++) {
            if (lines[i].startsWith('a=rtpmap:') && lines[i].includes('H264')) {
              rtpmapH264Index = i;
              const payloadType = lines[i].split(':')[1].split(' ')[0];
              videoPayloadTypes.unshift(payloadType); // Put H.264 at the start
            } else if (lines[i].startsWith('a=rtpmap:') && lines[i].includes('VP8')) {
              const payloadType = lines[i].split(':')[1].split(' ')[0];
              videoPayloadTypes.push(payloadType); // Put VP8 after H.264
            }
          }
          
          if (rtpmapH264Index !== -1 && videoPayloadTypes.length > 0) {
            // Rebuild the m=video line with H.264 as the preferred codec
            const videoMLine = lines[videoMLineIndex];
            const parts = videoMLine.split(' ');
            const newVideoMLine = `${parts[0]} ${parts[1]} ${parts[2]}`;
            
            // Add the payload types with H.264 first
            const rebuiltLine = `${newVideoMLine} ${videoPayloadTypes.join(' ')}`;
            lines[videoMLineIndex] = rebuiltLine;
            
            sdpWithH264Preference = lines.join('\r\n');
            console.log("Modified SDP to prefer H.264 codec");
          }
        }
      }
      
      // Use the potentially modified SDP
      offer.sdp = sdpWithH264Preference;
      
      console.log("Setting local description");
      await peerConnection.setLocalDescription(offer);
      console.log("Local description set successfully");
      
      // Send offer to the host via broadcast channel
      try {
        console.log("Sending offer via broadcast channel");
        const offerChannel = new BroadcastChannel(`telao-offer-${sessionId}`);
        offerChannel.postMessage({
          type: 'offer',
          sessionId,
          participantId,
          offer: peerConnection.localDescription,
          timestamp: Date.now()
        });
        setTimeout(() => offerChannel.close(), 500);
      } catch (e) {
        console.warn("BroadcastChannel not supported for offer", e);
      }
      
      // Also use localStorage as fallback for the offer
      try {
        console.log("Sending offer via localStorage");
        const offerKey = `telao-offer-${sessionId}-${participantId}`;
        localStorage.setItem(offerKey, JSON.stringify({
          type: 'offer',
          sessionId,
          participantId,
          offer: peerConnection.localDescription,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("localStorage not supported for offer", e);
      }
      
      // Listen for answer from the host
      console.log("Setting up answer listener");
      listenForAnswer(sessionId, participantId, peerConnection);
      
      // Also listen for ICE candidates from the host
      listenForICECandidates(sessionId, participantId, peerConnection);
      
      return true;
    } catch (error) {
      console.error("Error creating or setting local description:", error);
      return false;
    }
  } catch (error) {
    console.error("Error in initParticipantWebRTC:", error);
    return false;
  }
};

// Listen for the answer from the host
const listenForAnswer = (sessionId: string, participantId: string, peerConnection: RTCPeerConnection) => {
  try {
    // Via BroadcastChannel
    const answerChannel = new BroadcastChannel(`telao-answer-${sessionId}-${participantId}`);
    
    answerChannel.onmessage = async (event) => {
      console.log("Received answer via BroadcastChannel");
      const data = event.data;
      
      if (data && data.type === 'answer' && data.answer) {
        try {
          console.log("Setting remote description from answer");
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("Remote description set successfully");
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      }
    };
    
    // Check localStorage periodically for answer 
    const checkLocalStorageForAnswer = () => {
      try {
        const answerKey = `telao-answer-${sessionId}-${participantId}`;
        const answerData = localStorage.getItem(answerKey);
        
        if (answerData) {
          const data = JSON.parse(answerData);
          
          if (data && data.type === 'answer' && data.answer) {
            console.log("Found answer in localStorage");
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
              .then(() => {
                console.log("Remote description set from localStorage");
                localStorage.removeItem(answerKey);
              })
              .catch(error => {
                console.error("Error setting remote description from localStorage:", error);
              });
          }
        }
      } catch (e) {
        console.warn("Error checking localStorage for answer:", e);
      }
    };
    
    // Check immediately and then periodically
    checkLocalStorageForAnswer();
    const answerCheckInterval = setInterval(checkLocalStorageForAnswer, 2000);
    
    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(answerCheckInterval);
      answerChannel.close();
    }, 30000);
    
  } catch (e) {
    console.warn("Error setting up answer listener:", e);
    
    // Fallback to just localStorage if BroadcastChannel isn't supported
    const checkLocalStorageForAnswer = () => {
      try {
        const answerKey = `telao-answer-${sessionId}-${participantId}`;
        const answerData = localStorage.getItem(answerKey);
        
        if (answerData) {
          const data = JSON.parse(answerData);
          
          if (data && data.type === 'answer' && data.answer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
              .then(() => {
                console.log("Remote description set from localStorage (fallback)");
                localStorage.removeItem(answerKey);
              })
              .catch(error => {
                console.error("Error setting remote description from localStorage (fallback):", error);
              });
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };
    
    const answerCheckInterval = setInterval(checkLocalStorageForAnswer, 1000);
    
    setTimeout(() => {
      clearInterval(answerCheckInterval);
    }, 30000);
  }
};

// Listen for ICE candidates from the host
const listenForICECandidates = (sessionId: string, participantId: string, peerConnection: RTCPeerConnection) => {
  try {
    // Via BroadcastChannel
    const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}-${participantId}`);
    
    candidateChannel.onmessage = async (event) => {
      const data = event.data;
      
      if (data && data.type === 'ice-candidate' && data.candidate) {
        try {
          console.log("Adding ICE candidate from BroadcastChannel");
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };
    
    // Check localStorage periodically for ICE candidates
    const checkLocalStorageForCandidates = () => {
      try {
        // Find all ICE candidate keys
        const candidateKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`telao-ice-${sessionId}-${participantId}`)) {
            candidateKeys.push(key);
          }
        }
        
        // Process candidates
        for (const key of candidateKeys) {
          const candidateData = localStorage.getItem(key);
          if (candidateData) {
            try {
              const data = JSON.parse(candidateData);
              
              if (data && data.type === 'ice-candidate' && data.candidate) {
                console.log("Found ICE candidate in localStorage");
                peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                  .then(() => {
                    localStorage.removeItem(key);
                  })
                  .catch(error => {
                    console.warn("Error adding ICE candidate from localStorage:", error);
                  });
              }
            } catch (e) {
              // Ignore parsing errors
            }
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn("Error checking localStorage for ICE candidates:", e);
      }
    };
    
    // Check immediately and then periodically
    checkLocalStorageForCandidates();
    const candidateCheckInterval = setInterval(checkLocalStorageForCandidates, 1000);
    
    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(candidateCheckInterval);
      candidateChannel.close();
    }, 30000);
    
  } catch (e) {
    console.warn("Error setting up ICE candidate listener:", e);
    
    // Fallback to just localStorage if BroadcastChannel isn't supported
    const checkLocalStorageForCandidates = () => {
      try {
        // Find all ICE candidate keys
        const candidateKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`telao-ice-${sessionId}-${participantId}`)) {
            candidateKeys.push(key);
          }
        }
        
        // Process candidates
        for (const key of candidateKeys) {
          const candidateData = localStorage.getItem(key);
          if (candidateData) {
            try {
              const data = JSON.parse(candidateData);
              
              if (data && data.type === 'ice-candidate' && data.candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                  .catch(error => {
                    console.warn("Error adding ICE candidate from localStorage (fallback):", error);
                  });
              }
            } catch (e) {
              // Ignore parsing errors
            }
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };
    
    const candidateCheckInterval = setInterval(checkLocalStorageForCandidates, 1000);
    
    setTimeout(() => {
      clearInterval(candidateCheckInterval);
    }, 30000);
  }
};

// Clean up WebRTC connections
export const cleanupWebRTC = (sessionId?: string, participantId?: string) => {
  console.log(`Cleaning up WebRTC connections, sessionId: ${sessionId}, participantId: ${participantId}`);
  
  if (participantId) {
    // Clean up a specific participant connection
    const connection = participantConnections[participantId];
    if (connection) {
      console.log(`Closing connection for participant ${participantId}`);
      connection.peerConnection.close();
      delete participantConnections[participantId];
    }
  } else if (sessionId) {
    // Clean up all connections for a session
    Object.keys(participantConnections).forEach(pid => {
      const connection = participantConnections[pid];
      if (connection.sessionId === sessionId) {
        console.log(`Closing connection for participant ${pid} in session ${sessionId}`);
        connection.peerConnection.close();
        delete participantConnections[pid];
      }
    });
  } else {
    // Clean up all connections
    Object.keys(participantConnections).forEach(pid => {
      const connection = participantConnections[pid];
      console.log(`Closing connection for participant ${pid}`);
      connection.peerConnection.close();
    });
    
    // Reset connections object
    Object.keys(participantConnections).forEach(key => {
      delete participantConnections[key];
    });
  }
  
  // Clear the peer connections debug object
  if (participantId) {
    delete (window as any)._peerConnections[participantId];
  } else {
    (window as any)._peerConnections = {};
  }
  
  console.log("WebRTC connections cleaned up");
};
