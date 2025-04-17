
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
  
  // Reset state when participant changes
  useEffect(() => {
    console.log(`WebRTCVideo: New participant ${participantId}`);
    setConnectionStatus('connecting');
    setVideoActive(false);
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
    
    return () => {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
    };
  }, [participantId]);
  
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log(`Setting video stream for participant ${participantId}`);
      
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
      
      videoRef.current.srcObject = stream;
      
      // Monitor track status
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        console.log(`Video track state for ${participantId}:`, videoTrack.readyState, 'enabled:', videoTrack.enabled);
        
        // Set initial state based on track
        const isActive = videoTrack.enabled && videoTrack.readyState === 'live';
        setVideoActive(isActive);
        setConnectionStatus(isActive ? 'connected' : 'connecting');
        lastUpdateTimeRef.current = Date.now();
        reconnectAttemptRef.current = 0;
        
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
          
          videoTrack.removeEventListener('ended', onEnded);
          videoTrack.removeEventListener('mute', onMute);
          videoTrack.removeEventListener('unmute', onUnmute);
        };
      }
    } else {
      setConnectionStatus('connecting');
      setVideoActive(false);
      
      // If we lost the stream but still have a video element with content
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    }
    
    return () => {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
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
        if (connectingTime > 20000) { // 20 seconds in connecting state
          console.log(`Participant ${participantId} failed to connect after 20 seconds`);
          setConnectionStatus('disconnected');
        }
      }
    }, 2000); // Check more frequently
    
    return () => clearInterval(stabilityCheck);
  }, [connectionStatus, videoActive, participantId]);

  // Video event handlers
  const handleVideoLoadedData = () => {
    console.log(`Video loaded for participant ${participantId}`);
    setVideoActive(true);
    setConnectionStatus('connected');
    lastUpdateTimeRef.current = Date.now();
    reconnectAttemptRef.current = 0;
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`Video error for participant ${participantId}:`, e);
    setConnectionStatus('disconnected');
  };

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
        }
      };
      
      playVideo();
    }
  }, [stream, participantId]);

  // Only render if we have a stream or are still connecting
  if (connectionStatus === 'disconnected' && !stream) {
    return null; // Don't render disconnected participants
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
      
      {/* Connection status indicator */}
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
      
      {/* Placeholder when no stream */}
      {!videoActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <svg className="h-8 w-8 text-white/30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      )}
    </div>
  );
};

export default WebRTCVideo;
