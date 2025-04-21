import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamCheckRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectListenerRef = useRef<((event: StorageEvent) => void) | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const playAttemptedRef = useRef<boolean>(false);
  const videoStartedRef = useRef<boolean>(false);
  const hasSetSrcObjectRef = useRef<boolean>(false);
  
  const tryPlayVideo = useCallback(() => {
    if (!videoRef.current || playAttemptedRef.current || videoStartedRef.current) return;
    
    playAttemptedRef.current = true;
    
    if (videoRef.current.paused) {
      console.log(`Attempting to play video for participant ${participantId}`);
      videoRef.current.play()
        .then(() => {
          console.log(`Successfully started playback for ${participantId}`);
          setVideoActive(true);
          setConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
          videoStartedRef.current = true;
        })
        .catch(err => {
          console.warn(`Auto-play failed: ${err}, will not retry automatically`);
        });
    }
  }, [participantId]);
  
  useEffect(() => {
    console.log(`WebRTCVideo: New participant ${participantId}`);
    setConnectionStatus('connecting');
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
    
    setupDisconnectDetection();
    
    inactivityTimeoutRef.current = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        console.log(`Participant ${participantId} connection timed out`);
        setConnectionStatus('disconnected');
      }
    }, 15000);
    
    return () => {
      cleanupAllListeners();
    };
  }, [participantId]);
  
  const setupDisconnectDetection = () => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && 
         (event.key.startsWith('telao-leave-') && event.key.includes(participantId)) ||
         (event.key === `telao-leave-*-${participantId}`)) {
        console.log(`Participant ${participantId} disconnected (via localStorage)`);
        setConnectionStatus('disconnected');
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
          setConnectionStatus('disconnected');
          setVideoActive(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
        
        if (event.data.type === 'pong') {
          console.log(`Received pong from ${participantId}`);
          lastUpdateTimeRef.current = Date.now();
          setConnectionStatus('connected');
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
          setConnectionStatus('disconnected');
          setVideoActive(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          clearInterval(checkDisconnect);
        }
      } catch (e) {
      }
    }, 2000);
    
    return () => clearInterval(checkDisconnect);
  };
  
  const cleanupAllListeners = () => {
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
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log(`Setting video stream for participant ${participantId}`);
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
      
      // Only set srcObject if it's not already set to the same stream to prevent flickering
      if (!hasSetSrcObjectRef.current || (videoRef.current.srcObject !== stream)) {
        console.log(`Setting new srcObject for ${participantId}`);
        videoRef.current.srcObject = stream;
        hasSetSrcObjectRef.current = true;
        
        // Only attempt to play if the video hasn't started yet
        if (!videoStartedRef.current && !playAttemptedRef.current) {
          // Short timeout to try playing after srcObject is set
          setTimeout(() => {
            tryPlayVideo();
          }, 500);
        }
      }
      
      // Less frequent stream checks to reduce console logs and processing
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
                setConnectionStatus('connected');
                
                if (videoRef.current.paused && !videoStartedRef.current && !playAttemptedRef.current) {
                  tryPlayVideo();
                }
              } else if (!isTrackActive && videoActive) {
                console.log(`Deactivating stale video for ${participantId}`);
                setVideoActive(false);
              }
            }
          }
        }, 10000); // Less frequent checks (every 10 seconds instead of 5)
      }
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log(`Video track state for ${participantId}:`, videoTrack.readyState, 'enabled:', videoTrack.enabled);
        
        const isActive = videoTrack.enabled && videoTrack.readyState === 'live';
        setVideoActive(isActive);
        
        if (isActive) {
          setConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
          reconnectAttemptRef.current = 0;
        }
        
        const onEnded = () => {
          console.log(`Video track ended for participant ${participantId}`);
          setConnectionStatus('disconnected');
          setVideoActive(false);
        };
        
        const onMute = () => {
          console.log(`Video track muted for participant ${participantId}`);
          setVideoActive(false);
        };
        
        const onUnmute = () => {
          console.log(`Video track unmuted for participant ${participantId}`);
          setVideoActive(true);
          setConnectionStatus('connected');
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
        setConnectionStatus('connecting');
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
          setConnectionStatus('disconnected');
        }
      }, 10000);
    }
    
    return () => {
      cleanupAllListeners();
    };
  }, [stream, participantId, connectionStatus, videoActive, tryPlayVideo]);

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
        }
        
        if (timeSinceLastUpdate > 30000) {
          console.log(`No updates from participant ${participantId} for 30 seconds`);
          
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            console.log(`Attempting to recover connection (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
            
            if (videoRef.current && videoRef.current.srcObject) {
              videoRef.current.play().catch(err => {
                console.warn(`Recovery play failed: ${err}`);
              });
              lastUpdateTimeRef.current = Date.now();
            }
          } else {
            console.log(`Max reconnection attempts reached for ${participantId}`);
            setConnectionStatus('disconnected');
            setVideoActive(false);
          }
        }
      } else if (connectionStatus === 'connecting' && !videoActive) {
        const connectingTime = Date.now() - lastUpdateTimeRef.current;
        if (connectingTime > 30000) {
          console.log(`Participant ${participantId} failed to connect after 30 seconds`);
          setConnectionStatus('disconnected');
        }
      }
    }, 10000);
    
    return () => clearInterval(stabilityCheck);
  }, [connectionStatus, videoActive, participantId]);

  const handleVideoLoadedData = () => {
    console.log(`Video loaded for participant ${participantId}`);
    setVideoActive(true);
    setConnectionStatus('connected');
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    videoStartedRef.current = true;
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for participant ${participantId}:`, e);
    
    if (videoRef.current && videoRef.current.srcObject && reconnectAttemptRef.current < maxReconnectAttempts && !videoStartedRef.current) {
      reconnectAttemptRef.current++;
      console.log(`Video error occurred, trying to recover once (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (videoRef.current && !videoStartedRef.current) {
          videoRef.current.play().catch(() => {
            if (reconnectAttemptRef.current >= maxReconnectAttempts) {
              setConnectionStatus('disconnected');
            }
          });
        }
      }, 1000);
    } else {
      setConnectionStatus('disconnected');
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
        </div>
      )}
    </div>
  );
};

export default WebRTCVideo;
