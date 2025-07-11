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

        // Wait for metadata and play
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Mobile video metadata timeout'));
          }, 5000);

          videoElement.onloadedmetadata = () => {
            clearTimeout(timeout);
            console.log(`📱 MOBILE-READY: Metadata loaded for ${participantId}`);
            resolve();
          };

          videoElement.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Mobile video metadata error'));
          };
        });

        // Attempt to play with mobile-specific handling
        try {
          await videoElement.play();
          setIsPlaying(true);
          console.log(`▶️ MOBILE-PLAYING: Video started for ${participantId}`);
          
          // Notify parent component
          if (onStreamReady) {
            onStreamReady(participantId, videoElement);
          }
        } catch (playError) {
          console.log(`🔇 MOBILE-MUTED: Trying muted playback for ${participantId}`);
          videoElement.muted = true;
          await videoElement.play();
          setIsPlaying(true);
          
          if (onStreamReady) {
            onStreamReady(participantId, videoElement);
          }
        }

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