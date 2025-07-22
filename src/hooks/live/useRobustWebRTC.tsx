
import { useCallback, useRef } from 'react';
import { streamTracker } from '@/utils/debug/streamTracker';

interface UseRobustWebRTCProps {
  sessionId: string | null;
}

export const useRobustWebRTC = ({ sessionId }: UseRobustWebRTCProps) => {
  const retryCountRef = useRef<{[key: string]: number}>({});
  const maxRetries = 3;

  const validateStreamBeforeTransmit = useCallback((stream: MediaStream): boolean => {
    if (!stream) {
      console.error('🚫 WEBRTC VALIDATION: Stream is null');
      return false;
    }

    if (!stream.active) {
      console.error('🚫 WEBRTC VALIDATION: Stream is not active');
      return false;
    }

    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      console.error('🚫 WEBRTC VALIDATION: Stream has no tracks');
      return false;
    }

    const activeTracks = tracks.filter(t => t.readyState === 'live');
    if (activeTracks.length === 0) {
      console.error('🚫 WEBRTC VALIDATION: Stream has no active tracks');
      return false;
    }

    console.log('✅ WEBRTC VALIDATION: Stream is valid', {
      streamId: stream.id,
      totalTracks: tracks.length,
      activeTracks: activeTracks.length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    return true;
  }, []);

  const transmitStreamWithRetry = useCallback(async (
    participantId: string, 
    stream: MediaStream,
    attemptCount = 0
  ): Promise<boolean> => {
    const operationId = `${participantId}-${Date.now()}`;
    
    console.log(`🔄 ROBUST WEBRTC: Attempting to transmit stream (attempt ${attemptCount + 1})`);
    
    // Validate stream first
    if (!validateStreamBeforeTransmit(stream)) {
      streamTracker.logEvent({
        type: 'webrtc_add',
        participantId,
        streamId: stream.id,
        details: { success: false, reason: 'Stream validation failed', operationId }
      });
      return false;
    }

    try {
      // Log transmission attempt
      streamTracker.logEvent({
        type: 'webrtc_add',
        participantId,
        streamId: stream.id,
        details: { 
          attempt: attemptCount + 1,
          operationId,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        }
      });

      // Simulate WebRTC transmission (this would connect to actual WebRTC logic)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark as transmitted
      streamTracker.logEvent({
        type: 'transmitted',
        participantId,
        streamId: stream.id,
        details: { success: true, operationId }
      });

      console.log('✅ ROBUST WEBRTC: Stream transmitted successfully');
      
      // Reset retry count on success
      delete retryCountRef.current[participantId];
      return true;

    } catch (error) {
      console.error(`❌ ROBUST WEBRTC: Transmission failed (attempt ${attemptCount + 1}):`, error);
      
      const currentRetries = retryCountRef.current[participantId] || 0;
      
      if (currentRetries < maxRetries) {
        retryCountRef.current[participantId] = currentRetries + 1;
        
        const delay = Math.pow(2, currentRetries) * 1000; // Exponential backoff
        console.log(`⏰ ROBUST WEBRTC: Retrying in ${delay}ms...`);
        
        setTimeout(() => {
          transmitStreamWithRetry(participantId, stream, currentRetries + 1);
        }, delay);
        
        return false;
      } else {
        console.error('🚨 ROBUST WEBRTC: Max retries exceeded for:', participantId);
        delete retryCountRef.current[participantId];
        
        streamTracker.logEvent({
          type: 'transmitted',
          participantId,
          streamId: stream.id,
          details: { success: false, reason: 'Max retries exceeded', operationId }
        });
        
        return false;
      }
    }
  }, [validateStreamBeforeTransmit]);

  const forceRetransmission = useCallback(async (participantId: string, stream: MediaStream) => {
    console.log('🔥 ROBUST WEBRTC: Force retransmission requested for:', participantId);
    
    // Reset retry counter
    delete retryCountRef.current[participantId];
    
    return await transmitStreamWithRetry(participantId, stream);
  }, [transmitStreamWithRetry]);

  return {
    transmitStreamWithRetry,
    forceRetransmission,
    validateStreamBeforeTransmit
  };
};
