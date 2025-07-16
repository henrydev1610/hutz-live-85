import { useEffect, useRef } from 'react';

interface UseStreamRecoveryProps {
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  participantStreams: {[id: string]: MediaStream};
  sessionId: string | null;
}

export const useStreamRecovery = ({
  transmissionWindowRef,
  participantStreams,
  sessionId
}: UseStreamRecoveryProps) => {
  const recoveryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId || !transmissionWindowRef.current) return;

    const startRecoverySystem = () => {
      console.log('🔄 RECOVERY: Starting automatic stream recovery system');
      
      recoveryTimerRef.current = setInterval(() => {
        if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) return;

        // Check for empty quadrants in transmission window
        transmissionWindowRef.current.postMessage({
          type: 'check-empty-quadrants',
          timestamp: Date.now()
        }, '*');

        // Try to recover streams for available participants
        Object.entries(participantStreams).forEach(([participantId, stream]) => {
          if (stream && stream.getTracks().length > 0) {
            const videoTracks = stream.getVideoTracks();
            const activeVideoTracks = videoTracks.filter(track => track.readyState === 'live');
            
            if (activeVideoTracks.length > 0) {
              console.log(`🔄 RECOVERY: Attempting to recover stream for ${participantId}`);
              
              // Send recovery notification
              transmissionWindowRef.current.postMessage({
                type: 'stream-recovery',
                participantId: participantId,
                streamId: stream.id,
                trackCount: activeVideoTracks.length,
                timestamp: Date.now()
              }, '*');
            }
          }
        });

      }, 5000); // Check every 5 seconds
    };

    startRecoverySystem();

    return () => {
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [transmissionWindowRef, participantStreams, sessionId]);

  return {};
};