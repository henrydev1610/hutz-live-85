import { useCallback } from 'react';

interface VideoContext {
  isLocal: boolean;
  participantId: string;
  shouldMute: boolean;
}

export const useVideoContextManager = () => {
  
  const determineVideoContext = useCallback((participantId: string, isLocalPreview = false): VideoContext => {
    return {
      isLocal: isLocalPreview,
      participantId,
      shouldMute: isLocalPreview // Local sempre muted, remoto não muted
    };
  }, []);

  const configureVideoElement = useCallback((
    video: HTMLVideoElement,
    context: VideoContext,
    operationId: string
  ) => {
    console.log(`🎬 CONTEXT: Configurando vídeo para ${context.participantId}`, {
      isLocal: context.isLocal,
      shouldMute: context.shouldMute,
      operationId
    });

    video.playsInline = true;
    video.autoplay = true;
    video.muted = context.shouldMute;

    if (context.isLocal) {
      console.log(`🎬 CONTEXT: Vídeo LOCAL configurado - muted = true (evitar feedback)`);
    } else {
      console.log(`🎬 CONTEXT: Vídeo REMOTO configurado - muted = false (áudio habilitado)`);
    }
  }, []);

  return {
    determineVideoContext,
    configureVideoElement
  };
};