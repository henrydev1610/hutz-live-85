
import { useCallback, useRef } from 'react';

interface VideoPlayState {
  isPlaying: boolean;
  playPromise: Promise<void> | null;
  retryCount: number;
  lastStreamId: string | null;
  element: HTMLVideoElement | null;
}

export const useVideoCreation = () => {
  const videoStatesRef = useRef(new Map<HTMLElement, VideoPlayState>());

  const createVideoElement = useCallback(async (container: HTMLElement, stream: MediaStream) => {
    const containerId = container.id || container.className;
    const operationId = `${containerId}-${Date.now()}`;
    console.log(`🎬 SAFE: Creating video element in container: ${containerId} (${operationId})`);
    
    // Obter ou criar estado para este container
    let videoState = videoStatesRef.current.get(container);
    if (!videoState) {
      videoState = {
        isPlaying: false,
        playPromise: null,
        retryCount: 0,
        lastStreamId: null,
        element: null
      };
      videoStatesRef.current.set(container, videoState);
    }

    // Verificar se já existe um vídeo com o mesmo stream
    const existingVideo = container.querySelector('video') as HTMLVideoElement;
    
    if (existingVideo && 
        videoState.lastStreamId === stream.id && 
        existingVideo.srcObject === stream &&
        videoState.element === existingVideo) {
      console.log(`📹 REUSE: Video already exists with same stream for ${containerId} (${operationId})`);
      
      // Verificar se precisa tentar reproduzir
      if (existingVideo.paused && !videoState.isPlaying && !videoState.playPromise) {
        await attemptPlaySafely(existingVideo, container, videoState, stream.id, operationId);
      }
      return existingVideo;
    }

    // Aguardar conclusão de qualquer play() pendente antes de modificar o container
    if (videoState.playPromise) {
      console.log(`⏳ WAIT: Waiting for previous play to complete for ${containerId} (${operationId})`);
      try {
        await videoState.playPromise;
      } catch (error) {
        console.log(`⚠️ Previous play interrupted for ${containerId}:`, error);
      }
    }

    // Limpar container apenas se necessário
    if (existingVideo && videoState.lastStreamId !== stream.id) {
      console.log(`🧹 CLEAN: Removing old video for new stream in ${containerId} (${operationId})`);
      await cleanupVideoElement(existingVideo, videoState);
      container.innerHTML = '';
    } else if (!existingVideo) {
      container.innerHTML = '';
    }

    // Criar novo elemento de vídeo
    const videoElement = document.createElement('video');
    
    // Configurações essenciais
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.preload = 'metadata';
    
    // Atributos para compatibilidade
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    
    // Estilos
    videoElement.className = 'w-full h-full object-cover';
    videoElement.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      background-color: transparent;
    `;
    
    // Atualizar estado
    videoState.lastStreamId = stream.id;
    videoState.element = videoElement;
    videoState.retryCount = 0;
    
    // Configurar eventos antes de adicionar stream
    setupVideoEventListeners(videoElement, container, videoState, stream.id, operationId);
    
    // Adicionar ao DOM
    container.appendChild(videoElement);
    
    // Definir stream APENAS UMA VEZ
    videoElement.srcObject = stream;
    
    // Aguardar um frame para o DOM atualizar
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Tentar reprodução inicial
    await attemptPlaySafely(videoElement, container, videoState, stream.id, operationId);
    
    console.log(`✅ SAFE: Video element created successfully for ${containerId} (${operationId})`);
    return videoElement;

    async function cleanupVideoElement(video: HTMLVideoElement, state: VideoPlayState) {
      console.log(`🧹 CLEANUP: Cleaning up video element (${operationId})`);
      
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
      state.isPlaying = false;
      state.playPromise = null;
      state.retryCount = 0;
      state.lastStreamId = null;
      state.element = null;
    }

    function setupVideoEventListeners(
      video: HTMLVideoElement, 
      container: HTMLElement, 
      state: VideoPlayState,
      streamId: string,
      opId: string
    ) {
      const containerId = container.id || container.className;

      video.onloadedmetadata = () => {
        console.log(`📊 META: Video metadata loaded for ${containerId} (${opId})`);
      };

      video.oncanplay = () => {
        console.log(`🎯 READY: Video can play for ${containerId} (${opId})`);
        // NÃO chamar attemptPlay aqui para evitar múltiplas tentativas
      };

      video.onplay = () => {
        console.log(`▶️ PLAY: Video started playing for ${containerId} (${opId})`);
        state.isPlaying = true;
        state.retryCount = 0;
        
        container.style.background = 'transparent';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
      };

      video.onpause = () => {
        console.log(`⏸️ PAUSE: Video paused for ${containerId} (${opId})`);
        state.isPlaying = false;
      };

      video.onerror = (event) => {
        console.error(`❌ ERROR: Video error in ${containerId} (${opId}):`, {
          error: video.error,
          code: video.error?.code,
          message: video.error?.message
        });
        
        state.isPlaying = false;
        state.playPromise = null;
      };

      video.onended = () => {
        console.log(`🔚 END: Video ended for ${containerId} (${opId})`);
        state.isPlaying = false;
      };
    }

    async function attemptPlaySafely(
      video: HTMLVideoElement, 
      container: HTMLElement, 
      state: VideoPlayState,
      streamId: string,
      opId: string
    ) {
      const containerId = container.id || container.className;
      
      // Verificar se já está reproduzindo ou tentando reproduzir
      if (state.isPlaying || state.playPromise) {
        console.log(`⏭️ SKIP: Play already in progress for ${containerId} (${opId})`);
        return;
      }

      // Verificar se o stream ainda está ativo
      if (!stream.active || stream.getTracks().length === 0) {
        console.warn(`⚠️ INACTIVE: Stream is not active for ${containerId} (${opId})`);
        return;
      }

      console.log(`🎮 PLAY: Attempting to play video in ${containerId} (${opId})`);

      try {
        // Aguardar dados suficientes se necessário
        if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          console.log(`⏳ WAIT: Waiting for video data in ${containerId} (${opId})`);
          
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
        state.playPromise = video.play();
        await state.playPromise;
        
        console.log(`✅ PLAY: Video playing successfully in ${containerId} (${opId})`);
        state.playPromise = null;
        
      } catch (error: any) {
        state.playPromise = null;
        
        if (error.name === 'AbortError') {
          console.warn(`⚠️ ABORT: Play was aborted for ${containerId} (${opId}):`, error.message);
        } else if (error.name === 'NotAllowedError') {
          console.error(`🚫 BLOCKED: Autoplay not allowed for ${containerId} (${opId}):`, error.message);
        } else {
          console.error(`❌ FAIL: Play failed for ${containerId} (${opId}):`, error.message);
        }
        
        // Não fazer retry automático - deixar para o sistema controlado
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('🧹 CLEANUP: Cleaning up all video states');
    videoStatesRef.current.clear();
  }, []);

  return { createVideoElement, cleanup };
};
