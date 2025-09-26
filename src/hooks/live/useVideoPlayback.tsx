
import { useCallback } from 'react';

interface VideoPlayState {
  isPlaying: boolean;
  playPromise: Promise<void> | null;
  retryCount: number;
  lastStreamId: string | null;
  element: HTMLVideoElement | null;
}

interface UseVideoPlaybackProps {
  getVideoState: (container: HTMLElement) => VideoPlayState;
  updateVideoState: (container: HTMLElement, updates: Partial<VideoPlayState>) => void;
}

export const useVideoPlayback = ({ getVideoState, updateVideoState }: UseVideoPlaybackProps) => {
  
  const attemptPlaySafely = useCallback(async (
    video: HTMLVideoElement, 
    container: HTMLElement, 
    stream: MediaStream,
    operationId: string
  ) => {
    const containerId = container.id || container.className;
    const state = getVideoState(container);
    
    // Verificar se já está reproduzindo ou tentando reproduzir
    if (state.isPlaying || state.playPromise) {
      console.log(`⏭️ SKIP: Play already in progress for ${containerId} (${operationId})`);
      return;
    }

    // Verificar se o stream ainda está ativo
    if (!stream.active || stream.getTracks().length === 0) {
      console.warn(`⚠️ INACTIVE: Stream is not active for ${containerId} (${operationId})`);
      return;
    }

    console.log(`🎮 PLAY: Attempting to play video in ${containerId} (${operationId})`);

    try {
      // Aguardar dados suficientes se necessário
      if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        console.log(`⏳ WAIT: Waiting for video data in ${containerId} (${operationId})`);
        
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for video data')), 3000);
            const checkReady = () => {
              if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                clearTimeout(timeout);
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          }),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('Video data timeout')), 3000);
          })
        ]);
      }

      // Criar promise de play controlada
      const playPromise = video.play();
      updateVideoState(container, { playPromise });
      
      await playPromise;
      
      console.log(`✅ PLAY: Video playing successfully in ${containerId} (${operationId})`);
      updateVideoState(container, { playPromise: null });
      
    } catch (error: any) {
      updateVideoState(container, { playPromise: null });
      
      if (error.name === 'AbortError') {
        console.warn(`⚠️ ABORT: Play was aborted for ${containerId} (${operationId}):`, error.message);
      } else if (error.name === 'NotAllowedError') {
        console.error(`🚫 BLOCKED: Autoplay not allowed for ${containerId} (${operationId}):`, error.message);
      } else {
        console.error(`❌ FAIL: Play failed for ${containerId} (${operationId}):`, error.message);
      }
      
      // Não fazer retry automático - deixar para o sistema controlado
    }
  }, [getVideoState, updateVideoState]);

  const cleanupVideoElement = useCallback(async (
    video: HTMLVideoElement, 
    container: HTMLElement,
    operationId: string
  ) => {
    console.log(`🧹 CLEANUP: Cleaning up video element (${operationId})`);
    const state = getVideoState(container);
    
    // Aguardar conclusão de play pendente
    if (state.playPromise) {
      try {
        await state.playPromise;
      } catch (error) {
        console.log(`⚠️ Play promise rejected during cleanup:`, error);
      }
    }
    
    // Pausar e limpar
    if (!video.paused) {
      video.pause();
    }
    
    video.srcObject = null;
    video.removeAttribute('src');
    video.remove();
    
    // Resetar estado
    updateVideoState(container, {
      isPlaying: false,
      playPromise: null,
      retryCount: 0,
      lastStreamId: null,
      element: null
    });
  }, [getVideoState, updateVideoState]);

  return {
    attemptPlaySafely,
    cleanupVideoElement
  };
};
