import { useEffect, useRef } from 'react';

interface HostDebugVideoProps {
  stream?: MediaStream | null;
  participantId?: string;
}

export const HostDebugVideo = ({ stream, participantId }: HostDebugVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log(`🎬 DEBUG VIDEO: Setting up debug video for ${participantId}`, {
        streamId: stream.id,
        tracks: stream.getTracks().length
      });
      
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(error => {
        console.error('❌ DEBUG VIDEO: Failed to play:', error);
      });
    }
  }, [stream, participantId]);

  if (!stream) {
    return (
      <div className="hidden" id="host-debug-container">
        <p>No debug stream available</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card/90 p-2 rounded-lg border shadow-lg">
      <div className="text-xs text-muted-foreground mb-1">
        Debug: {participantId || 'Unknown'}
      </div>
      <video
        ref={videoRef}
        id="host-debug-video"
        className="w-32 h-24 rounded border"
        autoPlay
        playsInline
        muted
      />
      <div className="text-xs text-muted-foreground mt-1">
        Stream ID: {stream.id.slice(0, 8)}...
      </div>
    </div>
  );
};