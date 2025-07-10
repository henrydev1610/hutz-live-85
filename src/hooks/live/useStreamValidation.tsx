
import { useCallback } from 'react';

export const useStreamValidation = () => {
  const validateStream = useCallback((stream: MediaStream, participantId: string): boolean => {
    console.log('🎥 CRITICAL: Validating stream for:', participantId);
    console.log('🎥 Stream details:', {
      streamId: stream.id,
      active: stream.active,
      tracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    // Accept all streams - let video elements handle display logic
    if (!stream || stream.getTracks().length === 0) {
      console.warn('⚠️ Received empty stream');
      return false;
    }
    
    // Accept inactive streams and streams without video - they might become active later
    console.log('✅ Stream accepted for processing');
    return true;
  }, []);

  return { validateStream };
};
