// Aguarda que tracks de uma stream fiquem 'live' antes de processar
import { streamLogger } from '../debug/StreamLogger';

export const waitUntilTracksReady = (
  stream: MediaStream, 
  participantId: string = 'unknown',
  timeout: number = 3000
): Promise<boolean> => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  return new Promise((resolve) => {
    const start = Date.now();
    
    console.log(`🚨 CRÍTICO [TRACK-READY-WAITER] Aguardando tracks 'live' para ${participantId}:`, {
      streamId: stream.id,
      initialTracksCount: stream.getTracks().length,
      timeout
    });

    const checkTracks = () => {
      const tracks = stream.getVideoTracks();
      const ready = tracks.length > 0 && tracks[0].readyState === 'live';
      const elapsed = Date.now() - start;
      const expired = elapsed > timeout;
      
      console.log(`🔍 [TRACK-READY-WAITER] Verificação para ${participantId}:`, {
        videoTracksCount: tracks.length,
        trackReadyState: tracks[0]?.readyState,
        isReady: ready,
        elapsed,
        expired
      });

      if (ready) {
        console.log(`✅ [TRACK-READY-WAITER] Tracks 'live' confirmadas para ${participantId}:`, {
          videoTracksCount: tracks.length,
          trackReadyState: tracks[0].readyState,
          elapsed
        });
        
        streamLogger.logValidation(participantId, isMobile, deviceType, true, {
          reason: 'tracks_became_live',
          waitTime: elapsed,
          tracksCount: tracks.length
        });
        
        resolve(true);
        return;
      }
      
      if (expired) {
        console.warn(`⚠️ [TRACK-READY-WAITER] TIMEOUT para ${participantId}:`, {
          videoTracksCount: tracks.length,
          trackReadyState: tracks[0]?.readyState,
          elapsed,
          timeoutReached: true
        });
        
        streamLogger.logValidation(participantId, isMobile, deviceType, false, {
          reason: 'tracks_live_timeout',
          waitTime: elapsed,
          tracksCount: tracks.length,
          trackState: tracks[0]?.readyState
        });
        
        resolve(false);
        return;
      }

      // Continua verificando
      setTimeout(checkTracks, 100);
    };

    // Inicia verificação
    checkTracks();
  });
};