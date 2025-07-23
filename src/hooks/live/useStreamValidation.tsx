
import { useCallback } from 'react';
import { streamLogger } from '@/utils/debug/StreamLogger';

export const useStreamValidation = () => {
  const validateStream = useCallback((stream: MediaStream, participantId: string): boolean => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    console.log('🎥 CRITICAL: Validating stream for:', participantId);
    console.log('🎥 Stream details:', {
      streamId: stream.id,
      active: stream.active,
      tracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    // Log validação via StreamLogger
    streamLogger.logValidation(participantId, isMobile, deviceType, true, {
      streamId: stream.id,
      active: stream.active,
      tracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      phase: 'STREAM_VALIDATION'
    });
    
    // Accept all streams - let video elements handle display logic
    if (!stream || stream.getTracks().length === 0) {
      console.warn('⚠️ Received empty stream');
      
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: 'empty_stream',
        streamId: stream?.id,
        tracks: stream?.getTracks().length || 0
      });
      
      return false;
    }
    
    // Accept inactive streams and streams without video - they might become active later
    console.log('✅ Stream accepted for processing');
    
    streamLogger.logValidation(participantId, isMobile, deviceType, true, {
      reason: 'stream_accepted',
      streamId: stream.id,
      tracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    return true;
  }, []);

  return { validateStream };
};
