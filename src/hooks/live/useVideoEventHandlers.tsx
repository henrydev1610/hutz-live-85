
import { useCallback } from 'react';

interface VideoPlayState {
  isPlaying: boolean;
  playPromise: Promise<void> | null;
  retryCount: number;
  lastStreamId: string | null;
  element: HTMLVideoElement | null;
}

interface UseVideoEventHandlersProps {
  updateVideoState: (container: HTMLElement, updates: Partial<VideoPlayState>) => void;
}

export const useVideoEventHandlers = ({ updateVideoState }: UseVideoEventHandlersProps) => {
  
  const setupVideoEventListeners = useCallback((
    video: HTMLVideoElement, 
    container: HTMLElement, 
    streamId: string,
    operationId: string
  ) => {
    const containerId = container.id || container.className;

    video.onloadedmetadata = () => {
      console.log(`📊 META: Video metadata loaded for ${containerId} (${operationId})`);
    };

    video.oncanplay = () => {
      console.log(`🎯 READY: Video can play for ${containerId} (${operationId})`);
      // NÃO chamar attemptPlay aqui para evitar múltiplas tentativas
    };

    video.onplay = () => {
      console.log(`▶️ PLAY: Video started playing for ${containerId} (${operationId})`);
      updateVideoState(container, {
        isPlaying: true,
        retryCount: 0
      });
      
      container.style.background = 'transparent';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
    };

    video.onpause = () => {
      console.log(`⏸️ PAUSE: Video paused for ${containerId} (${operationId})`);
      updateVideoState(container, { isPlaying: false });
    };

    video.onerror = (event) => {
      console.error(`❌ ERROR: Video error in ${containerId} (${operationId}):`, {
        error: video.error,
        code: video.error?.code,
        message: video.error?.message
      });
      
      updateVideoState(container, {
        isPlaying: false,
        playPromise: null
      });
    };

    video.onended = () => {
      console.log(`🔚 END: Video ended for ${containerId} (${operationId})`);
      updateVideoState(container, { isPlaying: false });
    };
  }, [updateVideoState]);

  return { setupVideoEventListeners };
};
