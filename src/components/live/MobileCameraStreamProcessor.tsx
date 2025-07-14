import React, { useEffect, useRef, useState } from 'react';

interface MobileCameraStreamProcessorProps {
  participantId: string;
  stream: MediaStream;
  onStreamReady?: (participantId: string, videoElement: HTMLVideoElement) => void;
}

const MobileCameraStreamProcessor: React.FC<MobileCameraStreamProcessorProps> = ({
  participantId,
  stream,
  onStreamReady
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) return;

    console.log(`📱 MOBILE-PROCESSOR: Processing stream for ${participantId}`);

    const setupMobileVideo = async () => {
      try {
        // Reset any previous state
        videoElement.srcObject = null;
        setError(null);
        setIsPlaying(false);

        // Configure video element for mobile optimization
        videoElement.playsInline = true;
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.controls = false;

        // Set mobile-optimized attributes
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.setAttribute('playsinline', 'true');

        // Assign stream
        videoElement.srcObject = stream;

        // Setup event listeners first
        videoElement.onloadedmetadata = () => {
          console.log(`📱 MOBILE-READY: Metadata loaded for ${participantId}`);
        };

        videoElement.onerror = (e) => {
          console.error(`📱 MOBILE-ERROR: Video error for ${participantId}:`, e);
        };

        // Setup comprehensive event listeners with retry logic
        let isReady = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        const attemptPlayback = async () => {
          try {
            console.log(`📱 MOBILE-ATTEMPT: Playback attempt ${retryCount + 1} for ${participantId}`);
            
            videoElement.onloadedmetadata = () => {
              console.log(`📱 MOBILE-READY: Metadata loaded for ${participantId}`);
              isReady = true;
            };

            videoElement.onerror = (e) => {
              console.error(`📱 MOBILE-ERROR: Video error for ${participantId}:`, e);
            };
            
            videoElement.oncanplay = () => {
              console.log(`📱 MOBILE-CANPLAY: Video ready to play for ${participantId}`);
            };

            // Wait for the video to be ready
            if (!isReady) {
              await new Promise((resolve) => {
                const checkReady = () => {
                  if (videoElement.readyState >= 2 || isReady) {
                    resolve(undefined);
                  } else {
                    setTimeout(checkReady, 100);
                  }
                };
                checkReady();
              });
            }

            // Attempt to play
            await videoElement.play();
            setIsPlaying(true);
            console.log(`▶️ MOBILE-PLAYING: Video started for ${participantId}`);
            
            // Notify parent component
            if (onStreamReady) {
              onStreamReady(participantId, videoElement);
            }
            return true;
            
          } catch (playError) {
            console.warn(`📱 MOBILE-PLAYBACK-ERROR: Attempt ${retryCount + 1} failed for ${participantId}:`, playError);
            
            // Try muted playback
            if (!videoElement.muted) {
              videoElement.muted = true;
              try {
                await videoElement.play();
                setIsPlaying(true);
                console.log(`🔇 MOBILE-MUTED-SUCCESS: Video playing muted for ${participantId}`);
                if (onStreamReady) {
                  onStreamReady(participantId, videoElement);
                }
                return true;
              } catch (mutedError) {
                console.error(`❌ MOBILE-MUTED-FAILED: Muted playback failed for ${participantId}:`, mutedError);
              }
            }
            
            // Retry logic
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`🔄 MOBILE-RETRY: Retrying in 1s for ${participantId} (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return attemptPlayback();
            }
            
            throw playError;
          }
        };

        await attemptPlayback();

      } catch (error) {
        console.error(`❌ MOBILE-ERROR: Failed to setup video for ${participantId}:`, error);
        setError(error.message);
      }
    };

    setupMobileVideo();

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [participantId, stream, onStreamReady]);

  return (
    <div className="mobile-camera-processor relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover rounded"
        playsInline
        autoPlay
        muted
      />
      
      {/* Mobile-specific indicators */}
      <div className="absolute top-2 left-2 flex gap-1">
        <div className="flex items-center gap-1 bg-black/50 rounded px-1 py-0.5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-white">📱</span>
        </div>
        
        {isPlaying && (
          <div className="bg-green-500/80 rounded px-1 py-0.5">
            <span className="text-xs text-white">LIVE</span>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
          <div className="text-center text-white">
            <div className="text-xs">❌ Mobile Error</div>
            <div className="text-xs opacity-75">{error}</div>
          </div>
        </div>
      )}

      {!isPlaying && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
          <div className="text-center text-white">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div className="text-xs">📱 Conectando móvel...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileCameraStreamProcessor;