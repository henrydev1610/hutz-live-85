
let localStream: MediaStream | null = null;
let participantTrackCallbacks: Record<string, (participantId: string, event: RTCTrackEvent) => void> = {};

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

// NEW EXPORTS TO FIX THE MISSING FUNCTIONS

// Set the callback for handling participant tracks
export const setOnParticipantTrackCallback = (callback: (participantId: string, event: RTCTrackEvent) => void) => {
  participantTrackCallbacks['global'] = callback;
};

// Get a specific participant connection
export const getParticipantConnection = (participantId: string): RTCPeerConnection | null => {
  if ((window as any)._peerConnections) {
    const connections = (window as any)._peerConnections;
    return Object.values(connections).find((pc: any) => 
      pc && (pc._participantId === participantId || pc.participantId === participantId)
    ) as RTCPeerConnection || null;
  }
  return null;
};

// Initialize WebRTC for host
export const initHostWebRTC = (sessionId: string) => {
  console.log(`Initializing host WebRTC for session: ${sessionId}`);
  
  // Listen for offers from participants
  try {
    const offerChannel = new BroadcastChannel(`telao-offer-${sessionId}`);
    offerChannel.onmessage = async (event) => {
      const data = event.data;
      if (data && data.type === 'offer' && data.participantId && data.offer) {
        handleParticipantOffer(sessionId, data.participantId, data.offer);
      }
    };
    
    // Also check localStorage periodically for offers
    const checkLocalStorageForOffers = () => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`telao-offer-${sessionId}`)) {
            try {
              const offerData = localStorage.getItem(key);
              if (offerData) {
                const data = JSON.parse(offerData);
                if (data && data.type === 'offer' && data.participantId && data.offer) {
                  handleParticipantOffer(sessionId, data.participantId, data.offer);
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {
              console.warn("Error processing offer from localStorage:", e);
            }
          }
        }
      } catch (e) {
        console.warn("Error checking localStorage for offers:", e);
      }
    };
    
    const offerCheckInterval = setInterval(checkLocalStorageForOffers, 2000);
    
    // Clean up after 1 hour - should be called manually earlier
    setTimeout(() => {
      clearInterval(offerCheckInterval);
      try { offerChannel.close(); } catch (e) {}
    }, 3600000);
    
    // Listen for ICE candidates from participants
    const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}`);
    candidateChannel.onmessage = async (event) => {
      const data = event.data;
      if (data && data.type === 'ice-candidate' && data.participantId && data.candidate) {
        handleParticipantICECandidate(sessionId, data.participantId, data.candidate);
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
  console.log(`Handling offer from participant ${participantId}`);
  
  try {
    // Check if we already have a connection for this participant
    let peerConnection = (window as any)._peerConnections?.[participantId];
    
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        rtcpMuxPolicy: 'require',
        bundlePolicy: 'max-bundle'
      });
      
      // Store the participant ID with the connection
      peerConnection._participantId = participantId;
      peerConnection.participantId = participantId;
      
      // Set up track handling
      peerConnection.ontrack = (event) => {
        console.log(`Received track from participant ${participantId}:`, event.track.kind);
        
        // Notify via the global callback
        if (participantTrackCallbacks['global']) {
          participantTrackCallbacks['global'](participantId, event);
        }
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`Host generated ICE candidate for ${participantId}`);
          
          // Send to participant via BroadcastChannel
          try {
            const candidateChannel = new BroadcastChannel(`telao-candidate-${sessionId}-${participantId}`);
            candidateChannel.postMessage({
              type: 'ice-candidate',
              candidate: event.candidate,
              timestamp: Date.now()
            });
            setTimeout(() => candidateChannel.close(), 500);
          } catch (e) {
            console.warn("Error sending ICE candidate via BroadcastChannel:", e);
          }
          
          // Also use localStorage as fallback
          try {
            const candidateKey = `telao-ice-${sessionId}-${participantId}-host-${Date.now()}`;
            localStorage.setItem(candidateKey, JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
              timestamp: Date.now()
            }));
            
            // Clean up after 30 seconds
            setTimeout(() => {
              try { localStorage.removeItem(candidateKey); } catch (e) {}
            }, 30000);
          } catch (e) {
            console.warn("Error sending ICE candidate via localStorage:", e);
          }
        }
      };
      
      // Set up connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state for ${participantId}: ${peerConnection.connectionState}`);
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${participantId}: ${peerConnection.iceConnectionState}`);
        
        if (peerConnection.iceConnectionState === 'failed') {
          console.log(`Attempting to restart ICE for ${participantId}`);
          peerConnection.restartIce();
        }
      };
      
      // Store the connection
      (window as any)._peerConnections = (window as any)._peerConnections || {};
      (window as any)._peerConnections[participantId] = peerConnection;
    }
    
    // Set the remote description (the offer)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer to participant via BroadcastChannel
    try {
      const answerChannel = new BroadcastChannel(`telao-answer-${sessionId}-${participantId}`);
      answerChannel.postMessage({
        type: 'answer',
        answer: peerConnection.localDescription,
        timestamp: Date.now()
      });
      setTimeout(() => answerChannel.close(), 500);
    } catch (e) {
      console.warn("Error sending answer via BroadcastChannel:", e);
    }
    
    // Also use localStorage as fallback
    try {
      const answerKey = `telao-answer-${sessionId}-${participantId}`;
      localStorage.setItem(answerKey, JSON.stringify({
        type: 'answer',
        answer: peerConnection.localDescription,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn("Error sending answer via localStorage:", e);
    }
    
    console.log(`Successfully processed offer from participant ${participantId}`);
  } catch (error) {
    console.error(`Error handling offer from participant ${participantId}:`, error);
  }
};

// Handle an ICE candidate from a participant
const handleParticipantICECandidate = async (sessionId: string, participantId: string, candidate: RTCIceCandidateInit) => {
  try {
    // Get the peer connection for this participant
    const peerConnection = (window as any)._peerConnections?.[participantId];
    
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`Added ICE candidate from participant ${participantId}`);
    } else {
      console.warn(`No peer connection found for participant ${participantId}`);
    }
  } catch (error) {
    console.error(`Error handling ICE candidate from participant ${participantId}:`, error);
  }
};

// Clean up WebRTC connections
export const cleanupWebRTC = (participantId?: string) => {
  try {
    if (participantId) {
      // Clean up a specific participant connection
      const peerConnection = (window as any)._peerConnections?.[participantId];
      if (peerConnection) {
        try {
          peerConnection.close();
          delete (window as any)._peerConnections[participantId];
          console.log(`Cleaned up WebRTC connection for participant ${participantId}`);
        } catch (e) {
          console.warn(`Error cleaning up connection for ${participantId}:`, e);
        }
      }
    } else {
      // Clean up all connections
      if ((window as any)._peerConnections) {
        Object.keys((window as any)._peerConnections).forEach(id => {
          try {
            const pc = (window as any)._peerConnections[id];
            if (pc && typeof pc.close === 'function') {
              pc.close();
            }
          } catch (e) {
            console.warn(`Error closing peer connection ${id}:`, e);
          }
        });
        (window as any)._peerConnections = {};
        console.log("Cleaned up all WebRTC connections");
      }
    }
    return true;
  } catch (e) {
    console.error("Error in cleanupWebRTC:", e);
    return false;
  }
};
