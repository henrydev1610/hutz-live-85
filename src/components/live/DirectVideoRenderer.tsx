
import React, { useRef, useEffect, useState } from 'react';

interface DirectVideoRendererProps {
  streamURL: string;
  participantId: string;
  fallbackStream?: MediaStream | null;
  className?: string;
}

const DirectVideoRenderer: React.FC<DirectVideoRendererProps> = ({
  streamURL,
  participantId,
  fallbackStream,
  className = "w-full h-full object-cover"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebRTC, setUseWebRTC] = useState(!!fallbackStream);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const setupDirectStream = async () => {
      try {
        setError(null);
        
        if (useWebRTC && fallbackStream) {
          console.log(`📺 DIRECT: Using WebRTC for ${participantId}`);
          video.srcObject = fallbackStream;
        } else {
          console.log(`📺 DIRECT: Using HTTP stream for ${participantId}: ${streamURL}`);
          video.src = streamURL;
        }

        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.controls = false;

        await video.play();
        setIsPlaying(true);
        console.log(`✅ DIRECT: Video playing for ${participantId}`);

      } catch (err) {
        console.error(`❌ DIRECT: Failed to play ${participantId}:`, err);
        setError(err instanceof Error ? err.message : 'Playback failed');
        setIsPlaying(false);

        // Try WebRTC fallback if HTTP stream failed
        if (!useWebRTC && fallbackStream) {
          console.log(`🔄 DIRECT: Falling back to WebRTC for ${participantId}`);
          setUseWebRTC(true);
        }
      }
    };

    setupDirectStream();

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
      video.src = '';
    };
  }, [streamURL, participantId, fallbackStream, useWebRTC]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className={className}
        playsInline
        autoPlay
        muted
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
          <div className="text-center text-white text-xs">
            <div>❌ Stream Error</div>
            <div className="opacity-75">{error}</div>
            <button
              onClick={() => {
                setError(null);
                setUseWebRTC(!useWebRTC);
              }}
              className="mt-1 px-2 py-1 bg-red-600 rounded text-xs"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {!isPlaying && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
          <div className="text-center text-white text-xs">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div>Carregando stream...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectVideoRenderer;
