import React, { useEffect, useRef, useState } from 'react';

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
  
  // Reset state when participant changes
  useEffect(() => {
    console.log(`WebRTCVideo: New participant ${participantId}`);
    setConnectionStatus('connecting');
    setVideoActive(false);
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    
    // Clear any pending timeouts
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
    
    // Setup multiple disconnect detection mechanisms
    setupDisconnectDetection();
    
    // Set up a timeout to consider the participant disconnected if nothing happens
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
  
  // Setup disconnect detection using multiple methods for reliability
  const setupDisconnectDetection = () => {
    // 1. LocalStorage event listener
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
    
    // 2. BroadcastChannel for same-origin communication
    try {
      const channel = new BroadcastChannel(`telao-session-${participantId}`);
      broadcastChannelRef.current = channel;
      
      // Send an initial ping to check if the connection is active
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
        
        // If we get a pong, update last update time
        if (event.data.type === 'pong') {
          console.log(`Received pong from ${participantId}`);
          lastUpdateTimeRef.current = Date.now();
          setConnectionStatus('connected');
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel not supported for disconnect detection:', err);
    }
    
    // 3. Check for disconnect flags in localStorage directly
    const checkDisconnect = setInterval(() => {
      try {
        // Use a combination of pattern matching approaches
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
        // Ignore localStorage errors
      }
    }, 2000);
    
    // Clean up this interval when component unmounts
    return () => clearInterval(checkDisconnect);
  };
  
  // Cleanup all listeners and references
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
    
    // Ensure video is cleared
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log(`Setting video stream for participant ${participantId}`);
      
      // Reset timeouts when we get a new stream
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      
      // Force timeout if video doesn't play within a reasonable time
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
      
      videoTimeoutRef.current = setTimeout(() => {
        if (!videoActive && connectionStatus === 'connecting') {
          console.log(`Video timeout for participant ${participantId}, forcing play`);
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              videoRef.current.play()
                .then(() => {
                  setVideoActive(true);
                  setConnectionStatus('connected');
                  lastUpdateTimeRef.current = Date.now();
                })
                .catch(err => console.error(`Could not force play: ${err}`));
            } catch (err) {
              console.error(`Error forcing play: ${err}`);
            }
          }
        }
      }, 2000);
      
      // Anti-flicker: Don't keep changing the video source
      // Only set it if it's a different stream or no stream is set
      if (!videoRef.current.srcObject || videoRef.current.srcObject !== stream) {
        // Set the new stream directly to avoid flickering
        videoRef.current.srcObject = stream;
        
        // Immediately try to play with aggressive retry
        const tryPlay = () => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play()
              .then(() => {
                console.log(`Successfully started playback for ${participantId}`);
                setVideoActive(true);
                setConnectionStatus('connected');
                lastUpdateTimeRef.current = Date.now();
              })
              .catch(err => {
                console.warn(`Auto-play failed: ${err}, retrying...`);
                // Try again with user interaction simulation
                setTimeout(tryPlay, 500);
              });
          }
        };
        
        // Try to play immediately
        tryPlay();
      }
      
      // Set up stable stream checking with much less frequent updates to prevent flickering
      if (!streamCheckRef.current) {
        streamCheckRef.current = setInterval(() => {
          if (stream && videoRef.current) {
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
              const videoTrack = videoTracks[0];
              
              // Only update state if there's a significant change to reduce renders
              const isTrackActive = videoTrack.enabled && videoTrack.readyState === 'live';
              
              if (isTrackActive && !videoActive) {
                console.log(`Re-activating video for ${participantId}`);
                setVideoActive(true);
                setConnectionStatus('connected');
                
                if (videoRef.current.paused) {
                  videoRef.current.play().catch(err => 
                    console.warn(`Play failed during check: ${err}`)
                  );
                }
              } else if (!isTrackActive && videoActive) {
                console.log(`Deactivating stale video for ${participantId}`);
                setVideoActive(false);
              }
            }
          }
        }, 5000); // Much less frequent checks to reduce flickering
      }
      
      // Monitor track status
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log(`Video track state for ${participantId}:`, videoTrack.readyState, 'enabled:', videoTrack.enabled);
        
        // Set initial state based on track
        const isActive = videoTrack.enabled && videoTrack.readyState === 'live';
        setVideoActive(isActive);
        
        // If we get an active track, immediately set as connected
        if (isActive) {
          setConnectionStatus('connected');
          lastUpdateTimeRef.current = Date.now();
          reconnectAttemptRef.current = 0;
        }
        
        // Listen for track events
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
      // No stream provided, maintain connecting state for a limited time
      if (connectionStatus !== 'disconnected') {
        setConnectionStatus('connecting');
      }
      setVideoActive(false);
      
      // If we lost the stream but still have a video element with content
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
      
      // Set a timeout to consider disconnected if no stream arrives
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
  }, [stream, participantId, connectionStatus, videoActive]);

  // Enhanced connection stability - much less frequent checks to reduce render thrashing
  useEffect(() => {
    // Very infrequent connection monitoring to prevent flickering
    const stabilityCheck = setInterval(() => {
      // Only check for stale connections periodically
      if (connectionStatus === 'connected' && videoActive) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        
        // Check for heartbeat as a backup mechanism
        try {
          const heartbeatKey = `telao-heartbeat-${participantId}`;
          const heartbeat = window.localStorage.getItem(heartbeatKey);
          if (heartbeat) {
            const heartbeatTime = parseInt(heartbeat, 10);
            if (Date.now() - heartbeatTime < 30000) { // Extended timeout
              // Heartbeat is fresh, reset the timer
              lastUpdateTimeRef.current = Date.now();
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        
        // If it's been too long since last update, try to recover
        if (timeSinceLastUpdate > 30000) { // Extended to 30 seconds to reduce flickering
          console.log(`No updates from participant ${participantId} for 30 seconds`);
          
          // Only try to recover after a long period
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            console.log(`Attempting to recover connection (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
            
            if (videoRef.current && videoRef.current.srcObject) {
              // Don't remove the stream to prevent flickering
              // Just try to restart playback
              videoRef.current.play().catch(err => {
                console.warn(`Recovery play failed: ${err}`);
              });
              
              lastUpdateTimeRef.current = Date.now(); // Reset timer
            }
          } else {
            console.log(`Max reconnection attempts reached for ${participantId}`);
            setConnectionStatus('disconnected');
            setVideoActive(false);
          }
        }
      } else if (connectionStatus === 'connecting' && !videoActive) {
        // If still connecting after a while, consider disconnected
        const connectingTime = Date.now() - lastUpdateTimeRef.current;
        if (connectingTime > 30000) { // Extended to 30 seconds for initial connection
          console.log(`Participant ${participantId} failed to connect after 30 seconds`);
          setConnectionStatus('disconnected');
        }
      }
    }, 10000); // Minimal frequency to 10 seconds to prevent flickering
    
    return () => clearInterval(stabilityCheck);
  }, [connectionStatus, videoActive, participantId]);

  // Video event handlers with improved detection
  const handleVideoLoadedData = () => {
    console.log(`Video loaded for participant ${participantId}`);
    setVideoActive(true);
    setConnectionStatus('connected');
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    
    // Clear any pending inactivity timeouts
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for participant ${participantId}:`, e);
    
    // Don't immediately disconnect - try to recover first
    if (videoRef.current && videoRef.current.srcObject && reconnectAttemptRef.current < maxReconnectAttempts) {
      reconnectAttemptRef.current++;
      console.log(`Video error occurred, trying to recover (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
      
      // Don't remove the stream to prevent flickering
      // Just try to restart playback after a short delay
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(err => {
            console.warn(`Recovery after error failed: ${err}`);
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

  // Periodically update the last update time while video is playing to prevent timing out
  // Less frequent updates to prevent state flickering
  useEffect(() => {
    if (videoActive && connectionStatus === 'connected') {
      const updateTimer = setInterval(() => {
        // This helps detect if video is actually playing
        if (videoRef.current) {
          const currentTime = videoRef.current.currentTime;
          if (currentTime > 0) { // If time is advancing, video is playing
            lastUpdateTimeRef.current = Date.now();
          }
        }
      }, 10000); // Much less frequent updates to prevent state thrashing
      
      return () => clearInterval(updateTimer);
    }
  }, [videoActive, connectionStatus]);

  // Check if we should render based on connection status
  if (connectionStatus === 'disconnected' && !stream) {
    return null; // Don't render disconnected participants without a stream
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
          webkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          webkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          transition: 'none'
        }}
      />
      
      {/* Enhanced connection status indicators */}
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
      
      {/* Enhanced placeholder when no stream or video is not active */}
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
