// Utilitário crítico para validação de tracks ativas em MediaStreams
import { streamLogger } from '../debug/StreamLogger';

export interface TrackValidationResult {
  hasActiveTracks: boolean;
  trackCount: number;
  videoTracks: number;
  audioTracks: number;
  activeVideoTracks: number;
  activeAudioTracks: number;
}

export const validateMediaStreamTracks = (
  stream: MediaStream, 
  participantId: string = 'unknown'
): TrackValidationResult => {
  const tracks = stream.getTracks();
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  const activeVideoTracks = videoTracks.filter(track => track.readyState === 'live');
  const activeAudioTracks = audioTracks.filter(track => track.readyState === 'live');
  
  const hasActiveTracks = activeVideoTracks.length > 0 || activeAudioTracks.length > 0;
  
  console.log(`🔍 [TRACK-VALIDATION] Resultado para ${participantId}:`, {
    streamId: stream.id,
    hasActiveTracks,
    trackCount: tracks.length,
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    activeVideoTracks: activeVideoTracks.length,
    activeAudioTracks: activeAudioTracks.length,
    readyStates: tracks.map(t => ({ kind: t.kind, readyState: t.readyState }))
  });

  return {
    hasActiveTracks,
    trackCount: tracks.length,
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    activeVideoTracks: activeVideoTracks.length,
    activeAudioTracks: activeAudioTracks.length
  };
};

export const waitForActiveTracks = (
  stream: MediaStream,
  participantId: string = 'unknown',
  timeout: number = 5000
): Promise<TrackValidationResult> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    console.log(`⏳ [TRACK-VALIDATION] Aguardando tracks ativas para ${participantId}`, {
      streamId: stream.id,
      initialTracksCount: stream.getTracks().length,
      timeout
    });

    const checkTracks = () => {
      const validation = validateMediaStreamTracks(stream, participantId);
      const elapsed = Date.now() - startTime;
      const expired = elapsed > timeout;
      
      if (validation.hasActiveTracks) {
        console.log(`✅ [TRACK-VALIDATION] Tracks ativas confirmadas para ${participantId}:`, {
          ...validation,
          waitTime: elapsed
        });
        
        resolve(validation);
        return;
      }
      
      if (expired) {
        console.warn(`⚠️ [TRACK-VALIDATION] TIMEOUT para ${participantId}:`, {
          ...validation,
          waitTime: elapsed,
          timeoutReached: true
        });
        
        resolve(validation);
        return;
      }

      // Continua verificando a cada 100ms
      setTimeout(checkTracks, 100);
    };

    checkTracks();
  });
};

export const shouldProcessStream = (stream: MediaStream, participantId: string): boolean => {
  const validation = validateMediaStreamTracks(stream, participantId);
  
  // Só processa se tiver pelo menos uma track de vídeo ativa
  const shouldProcess = validation.activeVideoTracks > 0;
  
  console.log(`🚦 [TRACK-VALIDATION] Decisão de processamento para ${participantId}:`, {
    shouldProcess,
    reason: shouldProcess ? 'tem_tracks_video_ativas' : 'sem_tracks_video_ativas',
    ...validation
  });
  
  return shouldProcess;
};