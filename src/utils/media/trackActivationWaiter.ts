// Aguarda que tracks de uma stream fiquem ativas antes de processar
import { streamLogger } from '../debug/StreamLogger';

export const waitForStreamTracks = async (
  stream: MediaStream, 
  participantId: string = 'unknown',
  maxWaitTime: number = 5000
): Promise<{ hasActiveTracks: boolean; stream: MediaStream }> => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  console.log(`🚨 CRÍTICO [TRACK-WAITER] Aguardando tracks ativas para ${participantId}:`, {
    streamId: stream.id,
    initialTracksCount: stream.getTracks().length,
    active: stream.active,
    maxWaitTime
  });

  // Se já tem tracks ativas, retorna imediatamente
  const initialTracks = stream.getTracks();
  const activeTracks = initialTracks.filter(track => track.readyState === 'live');
  
  if (activeTracks.length > 0) {
    console.log(`✅ [TRACK-WAITER] Tracks já ativas para ${participantId}:`, {
      totalTracks: initialTracks.length,
      activeTracks: activeTracks.length
    });
    
    streamLogger.logValidation(participantId, isMobile, deviceType, true, {
      reason: 'tracks_already_active',
      tracksCount: activeTracks.length,
      waitTime: 0
    });
    
    return { hasActiveTracks: true, stream };
  }

  // Aguarda tracks ficarem ativas
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = Math.floor(maxWaitTime / 100); // Check every 100ms

  return new Promise((resolve) => {
    const checkTracks = () => {
      attempts++;
      const currentTracks = stream.getTracks();
      const currentActiveTracks = currentTracks.filter(track => track.readyState === 'live');
      const waitTime = Date.now() - startTime;
      
      console.log(`🔍 [TRACK-WAITER] Tentativa ${attempts}/${maxAttempts} para ${participantId}:`, {
        totalTracks: currentTracks.length,
        activeTracks: currentActiveTracks.length,
        waitTime,
        streamActive: stream.active
      });

      // Sucesso: encontrou tracks ativas
      if (currentActiveTracks.length > 0) {
        console.log(`✅ [TRACK-WAITER] SUCESSO! Tracks ativas encontradas para ${participantId}:`, {
          totalTracks: currentTracks.length,
          activeTracks: currentActiveTracks.length,
          waitTime,
          attempts
        });
        
        streamLogger.logValidation(participantId, isMobile, deviceType, true, {
          reason: 'tracks_became_active',
          tracksCount: currentActiveTracks.length,
          waitTime,
          attempts
        });
        
        resolve({ hasActiveTracks: true, stream });
        return;
      }

      // Timeout ou máximo de tentativas
      if (attempts >= maxAttempts || waitTime >= maxWaitTime) {
        console.error(`❌ [TRACK-WAITER] TIMEOUT! Tracks não ficaram ativas para ${participantId}:`, {
          totalTracks: currentTracks.length,
          activeTracks: currentActiveTracks.length,
          waitTime,
          attempts,
          streamActive: stream.active
        });
        
        streamLogger.logValidation(participantId, isMobile, deviceType, false, {
          reason: 'tracks_activation_timeout',
          tracksCount: currentTracks.length,
          activeTracks: currentActiveTracks.length,
          waitTime,
          attempts
        });
        
        resolve({ hasActiveTracks: false, stream });
        return;
      }

      // Continua tentando
      setTimeout(checkTracks, 100);
    };

    // Inicia verificação
    checkTracks();
  });
};

export const validateStreamWithTrackWait = async (
  stream: MediaStream | null, 
  participantId: string = 'unknown',
  maxWaitTime: number = 5000
): Promise<{ isValid: boolean; stream: MediaStream | null }> => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  // Validações básicas primeiro
  if (!stream) {
    console.error(`❌ [STREAM-VALIDATOR] Stream é null para ${participantId}`);
    streamLogger.logStreamError(participantId, isMobile, deviceType, new Error('Stream é null'), 0);
    return { isValid: false, stream: null };
  }
  
  if (!stream.getTracks || typeof stream.getTracks !== 'function') {
    console.error(`❌ [STREAM-VALIDATOR] Stream não possui método getTracks para ${participantId}`);
    streamLogger.logStreamError(participantId, isMobile, deviceType, new Error('Stream sem getTracks'), 0);
    return { isValid: false, stream: null };
  }

  // Aguarda tracks ficarem ativas
  const trackResult = await waitForStreamTracks(stream, participantId, maxWaitTime);
  
  if (!trackResult.hasActiveTracks) {
    console.error(`❌ [STREAM-VALIDATOR] Stream sem tracks ativas para ${participantId}`);
    return { isValid: false, stream };
  }

  console.log(`✅ [STREAM-VALIDATOR] Stream validada com sucesso para ${participantId}`);
  streamLogger.logValidation(participantId, isMobile, deviceType, true, {
    reason: 'stream_validated_with_active_tracks',
    tracksCount: stream.getTracks().length,
    activeTracks: stream.getTracks().filter(t => t.readyState === 'live').length
  });
  
  return { isValid: true, stream };
};