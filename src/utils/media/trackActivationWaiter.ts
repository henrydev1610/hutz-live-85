// FASE 3: Track Activation Waiter - Garante que tracks estão produzindo dados
import { streamLogger } from '../debug/StreamLogger';

export interface TrackActivationResult {
  isActive: boolean;
  trackCount: number;
  activeTrackCount: number;
  trackStates: Array<{
    kind: string;
    enabled: boolean;
    readyState: string;
    muted: boolean;
  }>;
  waitTime: number;
}

export const waitForTrackActivation = async (
  stream: MediaStream, 
  participantId: string = 'unknown',
  timeout: number = 5000
): Promise<TrackActivationResult> => {
  const start = Date.now();
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  console.log(`🎯 [TRACK-ACTIVATION] Aguardando ativação de tracks para ${participantId}:`, {
    streamId: stream.id,
    initialTracks: stream.getTracks().length,
    videoTracks: stream.getVideoTracks().length,
    timeout
  });

  return new Promise((resolve) => {
    const checkActivation = () => {
      const tracks = stream.getTracks();
      const videoTracks = stream.getVideoTracks();
      const activeTracks = tracks.filter(track => 
        track.enabled && track.readyState === 'live' && !track.muted
      );
      const activeVideoTracks = videoTracks.filter(track => 
        track.enabled && track.readyState === 'live' && !track.muted
      );
      
      const elapsed = Date.now() - start;
      const isActive = activeVideoTracks.length > 0;
      
      const trackStates = tracks.map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
      }));
      
      console.log(`🔍 [TRACK-ACTIVATION] Check para ${participantId}:`, {
        totalTracks: tracks.length,
        activeTracks: activeTracks.length,
        activeVideoTracks: activeVideoTracks.length,
        isActive,
        elapsed,
        trackStates
      });

      const result: TrackActivationResult = {
        isActive,
        trackCount: tracks.length,
        activeTrackCount: activeTracks.length,
        trackStates,
        waitTime: elapsed
      };

      if (isActive) {
        console.log(`✅ [TRACK-ACTIVATION] Tracks ativas confirmadas para ${participantId}:`, {
          activeVideoTracks: activeVideoTracks.length,
          waitTime: elapsed
        });
        
        streamLogger.logValidation(participantId, isMobile, isMobile ? 'mobile' : 'desktop', true, {
          reason: 'tracks_became_active',
          waitTime: elapsed,
          activeTracksCount: activeTracks.length
        });
        
        resolve(result);
        return;
      }
      
      if (elapsed > timeout) {
        console.warn(`⚠️ [TRACK-ACTIVATION] TIMEOUT para ${participantId}:`, {
          elapsed,
          trackStates,
          timeoutReached: true
        });
        
        streamLogger.logValidation(participantId, isMobile, isMobile ? 'mobile' : 'desktop', false, {
          reason: 'track_activation_timeout',
          waitTime: elapsed,
          trackCount: tracks.length,
          activeCount: activeTracks.length
        });
        
        resolve(result);
        return;
      }

      // Continua verificando
      setTimeout(checkActivation, 200);
    };

    checkActivation();
  });
};

export const validateTrackProduction = async (
  videoElement: HTMLVideoElement,
  participantId: string = 'unknown',
  timeout: number = 3000
): Promise<boolean> => {
  console.log(`📹 [TRACK-PRODUCTION] Validando produção de dados para ${participantId}`);
  
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = timeout / 100;
    
    const checkProduction = () => {
      attempts++;
      
      const hasData = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
      const isPlaying = !videoElement.paused && !videoElement.ended && videoElement.readyState > 2;
      
      console.log(`🔍 [TRACK-PRODUCTION] Check ${attempts} para ${participantId}:`, {
        hasData,
        isPlaying,
        dimensions: `${videoElement.videoWidth}x${videoElement.videoHeight}`,
        readyState: videoElement.readyState,
        paused: videoElement.paused
      });
      
      if (hasData && isPlaying) {
        console.log(`✅ [TRACK-PRODUCTION] Produção confirmada para ${participantId}`);
        resolve(true);
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.warn(`⚠️ [TRACK-PRODUCTION] Timeout para ${participantId} após ${attempts} tentativas`);
        resolve(false);
        return;
      }
      
      setTimeout(checkProduction, 100);
    };
    
    checkProduction();
  });
};

export interface VideoDataValidationResult {
  isValid: boolean;
  stream: MediaStream | null;
  hasVideoData: boolean;
  activationResult?: TrackActivationResult;
}

export const validateStreamWithVideoData = async (
  stream: MediaStream,
  participantId: string = 'unknown',
  timeout: number = 5000
): Promise<VideoDataValidationResult> => {
  console.log(`🎯 [STREAM-VIDEO-VALIDATION] Iniciando validação completa para ${participantId}`);
  
  if (!stream || !stream.active) {
    console.error(`❌ [STREAM-VIDEO-VALIDATION] Stream inválido ou inativo para ${participantId}`);
    return {
      isValid: false,
      stream: null,
      hasVideoData: false
    };
  }

  // Primeiro aguarda tracks ficarem ativas
  const activationResult = await waitForTrackActivation(stream, participantId, timeout);
  
  if (!activationResult.isActive) {
    console.error(`❌ [STREAM-VIDEO-VALIDATION] Tracks não ativaram para ${participantId}`);
    return {
      isValid: false,
      stream: null,
      hasVideoData: false,
      activationResult
    };
  }

  // Cria video temporário para testar dados
  const tempVideo = document.createElement('video');
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.autoplay = true;
  tempVideo.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 1px; height: 1px;';
  
  try {
    document.body.appendChild(tempVideo);
    tempVideo.srcObject = stream;
    
    console.log(`📹 [STREAM-VIDEO-VALIDATION] Testando dados de vídeo para ${participantId}...`);
    
    // Aguarda dados de vídeo aparecerem
    const hasVideoData = await new Promise<boolean>((resolve) => {
      let attempts = 0;
      const maxAttempts = timeout / 200;
      
      const checkVideoData = () => {
        attempts++;
        
        const hasData = tempVideo.videoWidth > 0 && tempVideo.videoHeight > 0;
        const hasMetadata = tempVideo.readyState >= 1;
        
        console.log(`🔍 [STREAM-VIDEO-VALIDATION] Check ${attempts} para ${participantId}:`, {
          hasData,
          hasMetadata,
          dimensions: `${tempVideo.videoWidth}x${tempVideo.videoHeight}`,
          readyState: tempVideo.readyState
        });
        
        if (hasData && hasMetadata) {
          console.log(`✅ [STREAM-VIDEO-VALIDATION] Dados de vídeo confirmados para ${participantId}`);
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.warn(`⚠️ [STREAM-VIDEO-VALIDATION] Timeout aguardando dados para ${participantId}`);
          resolve(false);
          return;
        }
        
        setTimeout(checkVideoData, 200);
      };
      
      // Listeners para acelerar detecção
      tempVideo.addEventListener('loadedmetadata', () => {
        console.log(`📊 [STREAM-VIDEO-VALIDATION] Metadata carregada para ${participantId}`);
        setTimeout(checkVideoData, 100);
      }, { once: true });
      
      tempVideo.addEventListener('canplay', () => {
        console.log(`▶️ [STREAM-VIDEO-VALIDATION] CanPlay ativado para ${participantId}`);
        setTimeout(checkVideoData, 100);
      }, { once: true });
      
      checkVideoData();
    });
    
    const result: VideoDataValidationResult = {
      isValid: hasVideoData,
      stream: hasVideoData ? stream : null,
      hasVideoData,
      activationResult
    };
    
    console.log(`🎯 [STREAM-VIDEO-VALIDATION] Resultado final para ${participantId}:`, result);
    
    return result;
    
  } finally {
    // Cleanup do video temporário
    try {
      tempVideo.srcObject = null;
      if (tempVideo.parentNode) {
        tempVideo.parentNode.removeChild(tempVideo);
      }
    } catch (error) {
      console.warn('⚠️ [STREAM-VIDEO-VALIDATION] Erro no cleanup:', error);
    }
  }
};