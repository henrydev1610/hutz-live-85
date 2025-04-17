
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
    
    // Set up a more aggressive timeout to consider the participant disconnected if nothing happens
    inactivityTimeoutRef.current = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        console.log(`Participant ${participantId} connection timed out`);
        setConnectionStatus('disconnected');
      }
    }, 15000);
    
    return () => {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    };
  }, [participantId]);
  
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
      
      // Set srcObject to trigger video loading
      videoRef.current.srcObject = stream;
      
      // Monitor track status more aggressively
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
          
          // Auto-play the video element
          videoRef.current.play().catch(err => {
            console.warn(`Auto-play failed: ${err}, will try again`);
            
            // Try once more with user interaction simulation
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play().catch(e => 
                  console.error(`Second play attempt failed: ${e}`)
                );
              }
            }, 1000);
          });
        }
        
        // Listen for track events with better handling
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
          if (videoTimeoutRef.current) {
            clearTimeout(videoTimeoutRef.current);
            videoTimeoutRef.current = null;
          }
          
          if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
            inactivityTimeoutRef.current = null;
          }
          
          videoTrack.removeEventListener('ended', onEnded);
          videoTrack.removeEventListener('mute', onMute);
          videoTrack.removeEventListener('unmute', onUnmute);
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
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, participantId, connectionStatus, videoActive]);

  // Stabilization effect to prevent flickering and detect stale connections
  useEffect(() => {
    // More aggressive connection monitoring
    const stabilityCheck = setInterval(() => {
      // Check for stale connections
      if (connectionStatus === 'connected' && videoActive) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > 10000) { // 10 seconds with no updates
          console.log(`No updates from participant ${participantId} for 10 seconds`);
          
          // Try to recover the connection by refreshing the video element
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            console.log(`Attempting to recover connection (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
            
            if (videoRef.current && videoRef.current.srcObject) {
              const currentStream = videoRef.current.srcObject as MediaStream;
              videoRef.current.srcObject = null;
              
              // Short delay before reconnecting
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.srcObject = currentStream;
                  
                  // Force play
                  videoRef.current.play().catch(err => {
                    console.warn(`Failed to play after recovery: ${err}`);
                    setConnectionStatus('disconnected');
                  });
                }
              }, 500);
              
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
        if (connectingTime > 15000) { // 15 seconds in connecting state
          console.log(`Participant ${participantId} failed to connect after 15 seconds`);
          setConnectionStatus('disconnected');
        }
      }
    }, 2000); // Check more frequently
    
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
    setConnectionStatus('disconnected');
  };

  // Periodically update the last update time while video is playing
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
      }, 2000);
      
      return () => clearInterval(updateTimer);
    }
  }, [videoActive, connectionStatus]);

  // Force play if autoplay doesn't work (mobile browsers often block autoplay)
  useEffect(() => {
    if (videoRef.current && stream) {
      const playVideo = async () => {
        try {
          if (videoRef.current) {
            await videoRef.current.play();
            console.log(`Forced play for participant ${participantId}`);
            setVideoActive(true);
            setConnectionStatus('connected');
            lastUpdateTimeRef.current = Date.now();
          }
        } catch (error) {
          console.warn(`Could not force play for ${participantId}:`, error);
          
          // Set a timeout to try again one more time
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => {
                  setVideoActive(true);
                  setConnectionStatus('connected');
                  lastUpdateTimeRef.current = Date.now();
                })
                .catch(err => console.warn(`Retry play failed: ${err}`));
            }
          }, 2000);
        }
      };
      
      playVideo();
    }
  }, [stream, participantId]);

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
