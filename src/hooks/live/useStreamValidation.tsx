
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
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Received inactive stream or stream without video tracks');
      return false;
    }
    
    return true;
  }, []);

  return { validateStream };
};
