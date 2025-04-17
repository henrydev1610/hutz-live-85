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
