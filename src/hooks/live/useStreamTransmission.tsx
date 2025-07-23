
import { useCallback } from 'react';

export const useStreamTransmission = () => {
  const sendStreamToTransmission = useCallback((
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef: React.MutableRefObject<Window | null>
  ) => {
    console.log('📡 CRITICAL: Sending stream to transmission for:', participantId);
    
    try {
      // Send via postMessage to transmission window
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'participant-stream-ready',
          participantId: participantId,
          streamInfo: {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            hasVideo: stream.getVideoTracks().length > 0
          },
          timestamp: Date.now()
        }, '*');
        
        console.log('✅ Stream info sent to transmission window via postMessage');
      } else {
        console.log('ℹ️ Transmission window not available (normal for preview mode)');
      }
      
      // Also send via BroadcastChannel for redundancy
      const sessionId = window.sessionStorage.getItem('currentSessionId');
      if (sessionId) {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'video-stream',
          participantId: participantId,
          hasStream: true,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          videoTrackCount: stream.getVideoTracks().length,
          timestamp: Date.now()
        });
        
        console.log('✅ Stream info sent via BroadcastChannel');
        
        // Close channel after sending
        setTimeout(() => channel.close(), 1000);
      }
      
    } catch (error) {
      console.error('❌ Failed to send stream to transmission:', error);
    }
  }, []);

  return { sendStreamToTransmission };
};
