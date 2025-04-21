
import { useEffect, useRef } from 'react';
import { optimizeVideoElement } from '@/utils/webrtc';

interface WebRTCVideoProps {
  stream: MediaStream;
  participantId: string;
  className?: string;
}

const WebRTCVideo = ({ stream, participantId, className = '' }: WebRTCVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) return;
    
    // Apply optimizations to reduce latency
    optimizeVideoElement(videoElement);
    
    // Set the stream as the source
    videoElement.srcObject = stream;
    
    // Attempt to play the video
    videoElement.play().catch(err => {
      console.error(`Error playing video for participant ${participantId}:`, err);
    });
    
    return () => {
      // Clean up
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    };
  }, [stream, participantId]);
  
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export default WebRTCVideo;
