import React, { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all'
};

interface WebRTCVideoProps {
  stream?: MediaStream;
  participantId: string;
  className?: string;
}

const WebRTCVideo: React.FC<WebRTCVideoProps> = ({ 
  stream, 
  participantId,
  className = "" 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [videoActive, setVideoActive] = useState(false);
  const [codecInfo, setCodecInfo] = useState<{video: string[], audio: string[]}>({ video: [], audio: [] });
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamCheckRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectListenerRef = useRef<((event: StorageEvent) => void) | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const connectionStatusChannelRef = useRef<BroadcastChannel | null>(null);
  const signalingChannelRef = useRef<BroadcastChannel | null>(null);
  const playAttemptedRef = useRef<boolean>(false);
  const videoStartedRef = useRef<boolean>(false);
  const hasSetSrcObjectRef = useRef<boolean>(false);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const updateConnectionStatus = useCallback((status: 'connecting' | 'connected' | 'disconnected') => {
    setConnectionStatus(status);
    
    try {
      if (!connectionStatusChannelRef.current) {
        connectionStatusChannelRef.current = new BroadcastChannel(`telao-connection-status`);
      }
      
      connectionStatusChannelRef.current.postMessage({
        type: 'connection-status',
        participantId,
        status
      });

      if (signalingChannelRef.current) {
        signalingChannelRef.current.postMessage({
          type: 'connection-status',
          participantId,
          status,
          timestamp: Date.now()
        });
      }
      
      try {
        localStorage.setItem(`telao-connection-status-${participantId}`, status);
      } catch (err) {
        console.warn('Error storing connection status in localStorage:', err);
      }
    } catch (err) {
      console.warn('Error broadcasting connection status:', err);
    }
  }, [participantId]);

  const detectSupportedCodecs = useCallback(async () => {
    try {
      const supportedVideoCodecs: string[] = [];
      const supportedAudioCodecs: string[] = [];
      
      const videoCodecs = ['video/H264', 'video/VP8', 'video/VP9', 'video/AV1'];
      for (const codec of videoCodecs) {
        try {
          if (MediaRecorder.isTypeSupported(codec)) {
            supportedVideoCodecs.push(codec);
          }
        } catch (e) {
          console.warn(`Error checking video codec ${codec}:`, e);
        }
      }
      
      const audioCodecs = ['audio/opus', 'audio/PCMU', 'audio/PCMA'];
      for (const codec of audioCodecs) {
        try {
          if (MediaRecorder.isTypeSupported(codec)) {
            supportedAudioCodecs.push(codec);
          }
        } catch (e) {
          console.warn(`Error checking audio codec ${codec}:`, e);
        }
      }
      
      console.log('Supported video codecs:', supportedVideoCodecs);
      console.log('Supported audio codecs:', supportedAudioCodecs);
      
      setCodecInfo({
        video: supportedVideoCodecs,
        audio: supportedAudioCodecs
      });
      
      return { video: supportedVideoCodecs, audio: supportedAudioCodecs };
    } catch (e) {
      console.warn('Error detecting supported codecs:', e);
      return { video: [], audio: [] };
    }
  }, []);

  const tryPlayVideo = useCallback(() => {
    if (!videoRef.current || playAttemptedRef.current || videoStartedRef.current) return;
    
    playAttemptedRef.current = true;
    
    if (videoRef.current.paused) {
      console.log(`Attempting to play video for participant ${participantId}`);
      videoRef.current.play()
        .then(() => {
          console.log(`Successfully started playback for ${participantId}`);
          setVideoActive(true);
          updateConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
          videoStartedRef.current = true;
          
          if (signalingChannelRef.current) {
            signalingChannelRef.current.postMessage({
              type: 'video-playback-started',
              participantId,
              timestamp: Date.now()
            });
          }
        })
        .catch(err => {
          console.warn(`Auto-play failed: ${err}, will retry once`);
          
          if (videoRef.current) {
            try {
              videoRef.current.playsInline = true;
              if ('latencyHint' in (videoRef.current as any)) {
                (videoRef.current as any).latencyHint = 'interactive';
              }
              if ('disablePictureInPicture' in (videoRef.current as any)) {
                (videoRef.current as any).disablePictureInPicture = true;
              }
              if ('disableRemotePlayback' in (videoRef.current as any)) {
                (videoRef.current as any).disableRemotePlayback = true;
              }
            } catch (e) {
              console.warn('Error setting video properties:', e);
            }
          }
          
          setTimeout(() => {
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play()
                .then(() => {
                  console.log(`Successfully started playback on retry for ${participantId}`);
                  setVideoActive(true);
                  updateConnectionStatus('connected');
                  lastUpdateTimeRef.current = Date.now();
                  videoStartedRef.current = true;
                  
                  if (signalingChannelRef.current) {
                    signalingChannelRef.current.postMessage({
                      type: 'video-playback-started',
                      participantId,
                      timestamp: Date.now()
                    });
                  }
                })
                .catch(retryErr => {
                  console.warn(`Retry auto-play failed: ${retryErr}`);
                  
                  if (signalingChannelRef.current) {
                    signalingChannelRef.current.postMessage({
                      type: 'video-playback-failed',
                      participantId,
                      error: retryErr.message || 'Unknown error',
                      timestamp: Date.now()
                    });
                  }
                });
            }
          }, 2000);
        });
    }
  }, [participantId, updateConnectionStatus]);

  const monitorRTCStats = useCallback(() => {
    if (!stream) return;
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    statsIntervalRef.current = setInterval(() => {
      if (!stream) {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
        return;
      }
      
      try {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        const videoActive = videoTracks.length > 0 && videoTracks[0].enabled && videoTracks[0].readyState === 'live';
        const audioActive = audioTracks.length > 0 && audioTracks[0].enabled && audioTracks[0].readyState === 'live';
        
        if (videoActive !== videoStartedRef.current || audioTracks.length > 0) {
          console.log(`Stats for participant ${participantId}:`, {
            videoTracks: videoTracks.length,
            audioTracks: audioTracks.length,
            videoActive,
            audioActive
          });
        }
        
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          console.log(`Video settings for ${participantId}:`, settings);
          
          if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
            peerConnectionRef.current.getStats().then(stats => {
              let inboundVideoStats: any = null;
              let connectionStats: any = null;
              
              stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                  inboundVideoStats = report;
                } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  connectionStats = report;
                }
              });
              
              if (inboundVideoStats) {
                console.log(`WebRTC video stats for ${participantId}:`, {
                  framesReceived: inboundVideoStats.framesReceived,
                  framesDecoded: inboundVideoStats.framesDecoded,
                  framesDropped: inboundVideoStats.framesDropped,
                  packetLoss: inboundVideoStats.packetsLost,
                  jitter: inboundVideoStats.jitter
                });
              }
              
              if (connectionStats) {
                console.log(`WebRTC connection stats for ${participantId}:`, {
                  roundTripTime: connectionStats.currentRoundTripTime,
                  availableOutgoingBitrate: connectionStats.availableOutgoingBitrate,
                  availableIncomingBitrate: connectionStats.availableIncomingBitrate
                });
              }
            }).catch(err => {
              console.warn(`Error getting WebRTC stats for ${participantId}:`, err);
            });
          }
        }
        
        if (signalingChannelRef.current && (videoActive || audioActive)) {
          signalingChannelRef.current.postMessage({
            type: 'media-stats',
            participantId,
            stats: {
              videoTracks: videoTracks.length,
              audioTracks: audioTracks.length,
              videoActive,
              audioActive,
              timestamp: Date.now()
            }
          });
        }
      } catch (err) {
        console.warn(`Error monitoring stats for ${participantId}:`, err);
      }
    }, 10000);
    
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [stream, participantId]);

  const getOrCreatePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }
    
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = event => {
        if (event.candidate) {
          console.log(`ICE candidate for ${participantId}:`, event.candidate.candidate);
          
          if (signalingChannelRef.current) {
            signalingChannelRef.current.postMessage({
              type: 'ice-candidate',
              participantId,
              candidate: event.candidate,
              timestamp: Date.now()
            });
          }
        } else {
          console.log(`ICE gathering complete for ${participantId}`);
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${participantId}:`, pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          console.log(`ICE connection failed for ${participantId}, attempting to recover...`);
          
          if (pc.restartIce) {
            pc.restartIce();
          }
          
          if (signalingChannelRef.current) {
            signalingChannelRef.current.postMessage({
              type: 'ice-restart-request',
              participantId,
              timestamp: Date.now()
            });
          }
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          updateConnectionStatus('connected');
        }
      };
      
      pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${participantId}:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          updateConnectionStatus('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          updateConnectionStatus('disconnected');
        }
      };
      
      pc.onsignalingstatechange = () => {
        console.log(`Signaling state for ${participantId}:`, pc.signalingState);
      };
      
      peerConnectionRef.current = pc;
      return pc;
    } catch (err) {
      console.error(`Error creating peer connection for ${participantId}:`, err);
      return null;
    }
  }, [participantId, updateConnectionStatus]);

  const initializeWebRTC = useCallback(() => {
    if (!window.RTCPeerConnection) {
      console.error('WebRTC is not supported in this browser');
      updateConnectionStatus('disconnected');
      return;
    }
    
    try {
      signalingChannelRef.current = new BroadcastChannel(`webrtc-signaling-${participantId}`);
      
      signalingChannelRef.current.onmessage = event => {
        const { type, participantId: senderId, timestamp } = event.data;
        
        if (timestamp && Date.now() - timestamp > 30000) {
          return;
        }
        
        if (senderId && senderId !== participantId) {
          return;
        }
        
        switch (type) {
          case 'ice-candidate':
            if (event.data.candidate && peerConnectionRef.current) {
              try {
                peerConnectionRef.current.addIceCandidate(event.data.candidate)
                  .catch(err => console.warn('Error adding ICE candidate:', err));
              } catch (err) {
                console.warn('Error processing ICE candidate:', err);
              }
            }
            break;
            
          case 'offer':
            if (event.data.offer && peerConnectionRef.current) {
              peerConnectionRef.current.setRemoteDescription(event.data.offer)
                .then(() => peerConnectionRef.current!.createAnswer())
                .then(answer => peerConnectionRef.current!.setLocalDescription(answer))
                .then(() => {
                  signalingChannelRef.current!.postMessage({
                    type: 'answer',
                    participantId,
                    answer: peerConnectionRef.current!.localDescription,
                    timestamp: Date.now()
                  });
                })
                .catch(err => console.warn('Error handling offer:', err));
            }
            break;
            
          case 'answer':
            if (event.data.answer && peerConnectionRef.current) {
              peerConnectionRef.current.setRemoteDescription(event.data.answer)
                .catch(err => console.warn('Error setting remote description:', err));
            }
            break;
            
          case 'ice-restart-request':
            if (peerConnectionRef.current) {
              peerConnectionRef.current.createOffer({ iceRestart: true })
                .then(offer => peerConnectionRef.current!.setLocalDescription(offer))
                .then(() => {
                  signalingChannelRef.current!.postMessage({
                    type: 'offer',
                    participantId,
                    offer: peerConnectionRef.current!.localDescription,
                    timestamp: Date.now()
                  });
                })
                .catch(err => console.warn('Error creating ice restart offer:', err));
            }
            break;
            
          case 'connection-status':
            if (event.data.status) {
              lastUpdateTimeRef.current = Date.now();
              
              if (connectionStatus !== 'connected' || event.data.status === 'disconnected') {
                updateConnectionStatus(event.data.status);
              }
            }
            break;
            
          case 'heartbeat':
            lastUpdateTimeRef.current = Date.now();
            
            signalingChannelRef.current!.postMessage({
              type: 'heartbeat-ack',
              participantId,
              timestamp: Date.now()
            });
            break;
        }
      };
      
      getOrCreatePeerConnection();
      
      signalingChannelRef.current.postMessage({
        type: 'heartbeat',
        participantId,
        timestamp: Date.now()
      });
      
      const heartbeatInterval = setInterval(() => {
        if (signalingChannelRef.current) {
          signalingChannelRef.current.postMessage({
            type: 'heartbeat',
            participantId,
            timestamp: Date.now()
          });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 15000);
      
      return () => {
        clearInterval(heartbeatInterval);
        if (signalingChannelRef.current) {
          signalingChannelRef.current.close();
          signalingChannelRef.current = null;
        }
        
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      };
    } catch (err) {
      console.warn('Error initializing WebRTC:', err);
    }
  }, [participantId, connectionStatus, getOrCreatePeerConnection, updateConnectionStatus]);

  useEffect(() => {
    console.log(`WebRTCVideo: New participant ${participantId}`);
    updateConnectionStatus('connecting');
    setVideoActive(false);
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    playAttemptedRef.current = false;
    videoStartedRef.current = false;
    hasSetSrcObjectRef.current = false;
    
    if (videoTimeoutRef.current) {
      clearTimeout(videoTimeoutRef.current);
      videoTimeoutRef.current = null;
    }
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    
    if (streamCheckRef.current) {
      clearInterval(streamCheckRef.current);
      streamCheckRef.current = null;
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    setupDisconnectDetection();
    initializeWebRTC();
    detectSupportedCodecs();
    
    inactivityTimeoutRef.current = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        console.log(`Participant ${participantId} connection timed out`);
        updateConnectionStatus('disconnected');
      }
    }, 15000);
    
    try {
      connectionStatusChannelRef.current = new BroadcastChannel(`telao-connection-status`);
    } catch (err) {
      console.warn('Error creating connection status channel:', err);
    }
    
    return () => {
      cleanupAllListeners();
    };
  }, [participantId, updateConnectionStatus, connectionStatus, setupDisconnectDetection, initializeWebRTC, detectSupportedCodecs]);
  
  const setupDisconnectDetection = useCallback(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && 
         (event.key.startsWith('telao-leave-') && event.key.includes(participantId)) ||
         (event.key === `telao-leave-*-${participantId}`)) {
        console.log(`Participant ${participantId} disconnected (via localStorage)`);
        updateConnectionStatus('disconnected');
        setVideoActive(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    disconnectListenerRef.current = handleStorageChange;
    
    try {
      const channel = new BroadcastChannel(`telao-session-${participantId}`);
      broadcastChannelRef.current = channel;
      
      channel.postMessage({
        type: 'ping',
        id: participantId,
        timestamp: Date.now()
      });
      
      channel.onmessage = (event) => {
        if (event.data.type === 'participant-leave' && event.data.id === participantId) {
          console.log(`Participant ${participantId} disconnected (via BroadcastChannel)`);
          updateConnectionStatus('disconnected');
          setVideoActive(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
        
        if (event.data.type === 'pong') {
          console.log(`Received pong from ${participantId}`);
          lastUpdateTimeRef.current = Date.now();
          updateConnectionStatus('connected');
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel not supported for disconnect detection:', err);
    }
    
    const checkDisconnect = setInterval(() => {
      try {
        const keys = Object.keys(localStorage).filter(key => 
          (key.startsWith(`telao-leave-`) && key.includes(participantId)) ||
          key === `telao-leave-*-${participantId}`
        );
        
        if (keys.length > 0) {
          console.log(`Participant ${participantId} disconnected via localStorage marker`);
          updateConnectionStatus('disconnected');
          setVideoActive(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          clearInterval(checkDisconnect);
        }
      } catch (e) {
        // Ignore storage errors
      }
    }, 2000);
    
    return () => clearInterval(checkDisconnect);
  }, [participantId, updateConnectionStatus]);
  
  const cleanupAllListeners = useCallback(() => {
    if (videoTimeoutRef.current) {
      clearTimeout(videoTimeoutRef.current);
      videoTimeoutRef.current = null;
    }
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    
    if (streamCheckRef.current) {
      clearInterval(streamCheckRef.current);
      streamCheckRef.current = null;
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    if (disconnectListenerRef.current) {
      window.removeEventListener('storage', disconnectListenerRef.current);
      disconnectListenerRef.current = null;
    }
    
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      } catch (err) {
        console.warn('Error closing BroadcastChannel:', err);
      }
    }
    
    if (connectionStatusChannelRef.current) {
      try {
        connectionStatusChannelRef.current.close();
        connectionStatusChannelRef.current = null;
      } catch (err) {
        console.warn('Error closing connection status channel:', err);
      }
    }
    
    if (signalingChannelRef.current) {
      try {
        signalingChannelRef.current.close();
        signalingChannelRef.current = null;
      } catch (err) {
        console.warn('Error closing signaling channel:', err);
      }
    }
    
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      } catch (err) {
        console.warn('Error closing peer connection:', err);
      }
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);
  
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log(`Setting video stream for participant ${participantId}`);
      
      monitorRTCStats();
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
      
      try {
        videoRef.current.playsInline = true;
        
        if ('latencyHint' in (videoRef.current as any)) {
          (videoRef.current as any).latencyHint = 'interactive';
        }
        
        if ('disablePictureInPicture' in (videoRef.current as any)) {
          (videoRef.current as any).disablePictureInPicture = true;
        }
        
        if ('disableRemotePlayback' in (videoRef.current as any)) {
          (videoRef.current as any).disableRemotePlayback = true;
        }
      } catch (e) {
        console.warn('Error applying video optimizations:', e);
      }
      
      if (!hasSetSrcObjectRef.current || (videoRef.current.srcObject !== stream)) {
        console.log(`Setting new srcObject for ${participantId}`);
        videoRef.current.srcObject = stream;
        hasSetSrcObjectRef.current = true;
        
        if (signalingChannelRef.current) {
          signalingChannelRef.current.postMessage({
            type: 'stream-assigned',
            participantId,
            hasStream: true,
            tracks: {
              video: stream.getVideoTracks().length,
              audio: stream.getAudioTracks().length
            },
            timestamp: Date.now()
          });
        }
        
        if (!videoStartedRef.current && !playAttemptedRef.current) {
          setTimeout(() => {
            tryPlayVideo();
          }, 500);
        }
      }
      
      if (!streamCheckRef.current) {
        streamCheckRef.current = setInterval(() => {
          if (stream && videoRef.current) {
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
              const videoTrack = videoTracks[0];
              
              const isTrackActive = videoTrack.enabled && videoTrack.readyState === 'live';
              
              if (isTrackActive && !videoActive) {
                console.log(`Track is active but video isn't - updating state for ${participantId}`);
                setVideoActive(true);
                updateConnectionStatus('connected');
                
                if (videoRef.current.paused && !videoStartedRef.current && !playAttemptedRef.current) {
                  tryPlayVideo();
                }
              } else if (!isTrackActive && videoActive) {
                console.log(`Deactivating stale video for ${participantId}`);
                setVideoActive(false);
              }
            }
          }
        }, 10000);
      }
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log(`Video track state for ${participantId}:`, videoTrack.readyState, 'enabled:', videoTrack.enabled);
        
        const isActive = videoTrack.enabled && videoTrack.readyState === 'live';
        setVideoActive(isActive);
        
        if (isActive) {
          updateConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
          reconnectAttemptRef.current = 0;
        }
        
        const onEnded = () => {
          console.log(`Video track ended for participant ${participantId}`);
          updateConnectionStatus('disconnected');
          setVideoActive(false);
        };
        
        const onMute = () => {
          console.log(`Video track muted for participant ${participantId}`);
          setVideoActive(false);
        };
        
        const onUnmute = () => {
          console.log(`Video track unmuted for participant ${participantId}`);
          setVideoActive(true);
          updateConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
        };
        
        videoTrack.addEventListener('ended', onEnded);
        videoTrack.addEventListener('mute', onMute);
        videoTrack.addEventListener('unmute', onUnmute);
        
        return () => {
          videoTrack.removeEventListener('ended', onEnded);
          videoTrack.removeEventListener('mute', onMute);
          videoTrack.removeEventListener('unmute', onUnmute);
          cleanupAllListeners();
        };
      }
    } else {
      if (connectionStatus !== 'disconnected') {
        updateConnectionStatus('connecting');
      }
      setVideoActive(false);
      
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
        hasSetSrcObjectRef.current = false;
      }
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      
      inactivityTimeoutRef.current = setTimeout(() => {
        if (!stream && connectionStatus === 'connecting') {
          console.log(`No stream received for participant ${participantId} after timeout`);
          updateConnectionStatus('disconnected');
        }
      }, 10000);
    }
    
    return () => {
      cleanupAllListeners();
    };
  }, [stream, participantId, connectionStatus, videoActive, tryPlayVideo, cleanupAllListeners, updateConnectionStatus, monitorRTCStats]);

  useEffect(() => {
    const stabilityCheck = setInterval(() => {
      if (connectionStatus === 'connected' && videoActive) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        
        try {
          const heartbeatKey = `telao-heartbeat-${participantId}`;
          const heartbeat = window.localStorage.getItem(heartbeatKey);
          if (heartbeat) {
            const heartbeatTime = parseInt(heartbeat, 10);
            if (Date.now() - heartbeatTime < 30000) {
              lastUpdateTimeRef.current = Date.now();
            }
          }
        } catch (e) {
          // Ignore storage errors
        }
        
        if (timeSinceLastUpdate > 30000) {
          console.log(`No updates from participant ${participantId} for 30 seconds`);
          
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            console.log(`Attempting to recover connection (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
            
            if (peerConnectionRef.current) {
              try {
                if (peerConnectionRef.current.restartIce) {
                  peerConnectionRef.current.restartIce();
                  
                  peerConnectionRef.current.createOffer({ iceRestart: true })
                    .then(offer => peerConnectionRef.current!.setLocalDescription(offer))
                    .then(() => {
                      if (signalingChannelRef.current) {
                        signalingChannelRef.current.postMessage({
                          type: 'offer',
                          participantId,
                          offer: peerConnectionRef.current!.localDescription,
                          timestamp: Date.now()
                        });
                      }
                    })
                    .catch(err => console.warn('Error creating ICE restart offer:', err));
                }
              } catch (e) {
                console.warn('Error attempting WebRTC recovery:', e);
              }
            }
            
            if (videoRef.current && videoRef.current.srcObject) {
              videoRef.current.play().catch(err => {
                console.warn(`Recovery play failed: ${err}`);
              });
              lastUpdateTimeRef.current = Date.now();
            }
          } else {
            console.log(`Max reconnection attempts reached for ${participantId}`);
            updateConnectionStatus('disconnected');
            setVideoActive(false);
          }
        }
      } else if (connectionStatus === 'connecting' && !videoActive) {
        const connectingTime = Date.now() - lastUpdateTimeRef.current;
        if (connectingTime > 30000) {
          console.log(`Participant ${participantId} failed to connect after 30 seconds`);
          updateConnectionStatus('disconnected');
        }
      }
    }, 10000);
    
    return () => clearInterval(stabilityCheck);
  }, [connectionStatus, videoActive, participantId, updateConnectionStatus]);

  const handleVideoLoadedData = () => {
    console.log(`Video loaded for participant ${participantId}`);
    setVideoActive(true);
    updateConnectionStatus('connected');
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    videoStartedRef.current = true;
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    
    if (signalingChannelRef.current) {
      signalingChannelRef.current.postMessage({
        type: 'video-loaded',
        participantId,
        timestamp: Date.now()
      });
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for participant ${participantId}:`, e);
    
    if (signalingChannelRef.current) {
      signalingChannelRef.current.postMessage({
        type: 'video-error',
        participantId,
        error: 'Video element error',
        timestamp: Date.now()
      });
    }
    
    if (videoRef.current && videoRef.current.srcObject && reconnectAttemptRef.current < maxReconnectAttempts && !videoStartedRef.current) {
      reconnectAttemptRef.current++;
      console.log(`Video error occurred, trying to recover once (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (videoRef.current && !videoStartedRef.current) {
          videoRef.current.play().catch(() => {
            if (reconnectAttemptRef.current >= maxReconnectAttempts) {
              updateConnectionStatus('disconnected');
            }
          });
        }
      }, 1000);
    } else {
      updateConnectionStatus('disconnected');
    }
  };

  useEffect(() => {
    if (videoActive && connectionStatus === 'connected') {
      const updateTimer = setInterval(() => {
        if (videoRef.current) {
          const currentTime = videoRef.current.currentTime;
          if (currentTime > 0) {
            lastUpdateTimeRef.current = Date.now();
          }
        }
      }, 10000);
      
      return () => clearInterval(updateTimer);
    }
  }, [videoActive, connectionStatus]);

  if (connectionStatus === 'disconnected' && !stream) {
    return null;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onLoadedData={handleVideoLoadedData}
        onError={handleVideoError}
        style={{ 
          objectFit: 'cover',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transition: 'none'
        }}
      />
      
      {connectionStatus === 'connecting' && (
        <div className="absolute top-2 left-2 flex items-center">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-1"></div>
          <span className="text-xs text-white bg-black/50 px-1 rounded">Conectando...</span>
        </div>
      )}
      
      {connectionStatus === 'disconnected' && (
        <div className="absolute top-2 left-2 flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
          <span className="text-xs text-white bg-black/50 px-1 rounded">Desconectado</span>
        </div>
      )}
      
      {connectionStatus === 'connected' && !videoActive && (
        <div className="absolute top-2 left-2 flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
          <span className="text-xs text-white bg-black/50 px-1 rounded">Conectado (vídeo pausado)</span>
        </div>
      )}
      
      {connectionStatus === 'connected' && videoActive && (
        <div className="absolute top-2 left-2 flex items-center opacity-50 hover:opacity-100 transition-opacity">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
          <span className="text-xs text-white bg-black/50 px-1 rounded">AO VIVO</span>
        </div>
      )}
      
      {!videoActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <svg className="h-10 w-10 text-white/30 mb-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span className="text-xs text-white/50">
            {connectionStatus === 'connecting' ? 'Conectando participante...' : 
             connectionStatus === 'disconnected' ? 'Participante desconectado' : 
             'Aguardando vídeo...'}
          </span>
          {codecInfo.video.length > 0 && (
            <span className="text-xs text-white/30 mt-1">
              Codecs: {codecInfo.video.map(c => c.split('/')[1]).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default WebRTCVideo;
