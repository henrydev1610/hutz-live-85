
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
  
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log(`Setting video stream for participant ${participantId}`);
      videoRef.current.srcObject = stream;
      
      // Monitor track status
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log(`Video track state for ${participantId}:`, videoTrack.readyState, 'enabled:', videoTrack.enabled);
        setVideoActive(videoTrack.enabled && videoTrack.readyState === 'live');
        setConnectionStatus('connected');
        lastUpdateTimeRef.current = Date.now();
        reconnectAttemptRef.current = 0;
        
        // Listen for track ended event
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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, participantId]);

  // Stabilization effect to prevent flickering
  useEffect(() => {
    const stabilityCheck = setInterval(() => {
      if (connectionStatus === 'connected' && videoActive) {
        // Consider disconnected if no updates for a while
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > 10000) { // 10 seconds
          console.log(`No updates from participant ${participantId} for 10 seconds`);
          setConnectionStatus('disconnected');
          
          // Attempt to recover the connection if possible
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++;
            console.log(`Attempting to recover connection (${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
            
            // Force a refresh of the video element
            if (videoRef.current && videoRef.current.srcObject) {
              const currentStream = videoRef.current.srcObject as MediaStream;
              videoRef.current.srcObject = null;
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.srcObject = currentStream;
                }
              }, 500);
            }
          }
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(stabilityCheck);
  }, [connectionStatus, videoActive, participantId]);

  // Handle video loading state
  const handleVideoLoadedData = () => {
    console.log(`Video loaded for participant ${participantId}`);
    setVideoActive(true);
    setConnectionStatus('connected');
    lastUpdateTimeRef.current = Date.now();
  };

  // Handle video error
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
          }
        } catch (error) {
          console.warn(`Could not force play for ${participantId}:`, error);
        }
      };
      
      playVideo();
    }
  }, [stream, participantId]);

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
