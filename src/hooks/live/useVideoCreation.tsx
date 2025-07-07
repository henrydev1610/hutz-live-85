
import { useCallback, useRef } from 'react';

interface VideoPlayState {
  isPlaying: boolean;
  playPromise: Promise<void> | null;
  retryCount: number;
  lastStreamId: string | null;
}

export const useVideoCreation = () => {
  // Manter estado de reprodução por container para evitar conflitos
  const videoStatesRef = useRef(new Map<HTMLElement, VideoPlayState>());

  const createVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    const containerId = container.id || container.className;
    console.log('🎬 Creating video element in container:', containerId);
    
    // Obter ou criar estado para este container
    let videoState = videoStatesRef.current.get(container);
    if (!videoState) {
      videoState = {
        isPlaying: false,
        playPromise: null,
        retryCount: 0,
        lastStreamId: null
      };
      videoStatesRef.current.set(container, videoState);
    }

    // Verificar se já existe um vídeo com o mesmo stream para evitar recriação desnecessária
    const existingVideo = container.querySelector('video') as HTMLVideoElement;
    if (existingVideo && videoState.lastStreamId === stream.id && existingVideo.srcObject === stream) {
      console.log('📹 Video already exists with same stream, checking play state');
      
      // Se o vídeo existe mas não está reproduzindo, tentar reproduzir
      if (existingVideo.paused && !videoState.isPlaying) {
        attemptPlay(existingVideo, container, videoState, stream.id);
      }
      return existingVideo;
    }

    // Limpar container apenas se necessário (novo stream ou sem vídeo)
    if (existingVideo && videoState.lastStreamId !== stream.id) {
      console.log('🧹 Cleaning up old video element for new stream');
      await cleanupVideoElement(existingVideo, videoState);
    } else if (!existingVideo) {
      // Limpar qualquer conteúdo restante se não há vídeo
      container.innerHTML = '';
    }

    // Criar novo elemento de vídeo com configurações otimizadas
    const videoElement = document.createElement('video');
    
    // Configurações essenciais para autoplay
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true; // Essencial para autoplay sem interação do usuário
    videoElement.controls = false;
    videoElement.preload = 'metadata'; // Otimizar carregamento
    
    // Atributos específicos para compatibilidade mobile
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    
    // Estilos CSS
    videoElement.className = 'w-full h-full object-cover';
    videoElement.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      background-color: transparent;
    `;
    
    // Definir stream APENAS UMA VEZ para evitar múltiplos load events
    videoElement.srcObject = stream;
    videoState.lastStreamId = stream.id;
    
    // Adicionar ao container
    container.appendChild(videoElement);
    
    // Configurar event listeners antes de tentar reproduzir
    setupVideoEventListeners(videoElement, container, videoState, stream.id);
    
    // Tentar reprodução inicial
    attemptPlay(videoElement, container, videoState, stream.id);
    
    return videoElement;

    // Função para limpeza adequada do elemento de vídeo
    async function cleanupVideoElement(video: HTMLVideoElement, state: VideoPlayState) {
      console.log('🧹 Cleaning up video element');
      
      // Aguardar conclusão de qualquer play() pendente
      if (state.playPromise) {
        try {
          await state.playPromise;
        } catch (error) {
          console.log('⚠️ Play promise rejected during cleanup:', error);
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
    }

    // Configurar listeners de eventos do vídeo
    function setupVideoEventListeners(
      video: HTMLVideoElement, 
      container: HTMLElement, 
      state: VideoPlayState,
      streamId: string
    ) {
      const containerId = container.id || container.className;

      // Evento: metadados carregados
      video.onloadedmetadata = () => {
        console.log(`📊 Video metadata loaded for ${containerId}`, {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        });
      };

      // Evento: pode reproduzir
      video.oncanplay = () => {
        console.log(`🎯 Video can play for ${containerId}`, {
          readyState: video.readyState,
          networkState: video.networkState,
          paused: video.paused
        });
        
        // Tentar reproduzir apenas se não estiver já reproduzindo
        if (video.paused && !state.isPlaying) {
          attemptPlay(video, container, state, streamId);
        }
      };

      // Evento: reprodução iniciada
      video.onplay = () => {
        console.log(`▶️ Video started playing for ${containerId}`);
        state.isPlaying = true;
        state.retryCount = 0; // Reset retry count on success
        
        // Tornar container visível
        container.style.background = 'transparent';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
      };

      // Evento: reprodução pausada
      video.onpause = () => {
        console.log(`⏸️ Video paused for ${containerId}`);
        state.isPlaying = false;
      };

      // Evento: erro
      video.onerror = (event) => {
        console.error(`❌ Video error in ${containerId}:`, {
          error: video.error,
          code: video.error?.code,
          message: video.error?.message,
          readyState: video.readyState,
          networkState: video.networkState
        });
        
        state.isPlaying = false;
        state.playPromise = null;
      };

      // Evento: stream terminou
      video.onended = () => {
        console.log(`🔚 Video ended for ${containerId}`);
        state.isPlaying = false;
      };
    }

    // Função principal para tentar reprodução com gestão adequada de promises
    async function attemptPlay(
      video: HTMLVideoElement, 
      container: HTMLElement, 
      state: VideoPlayState,
      streamId: string,
      maxRetries = 3
    ) {
      const containerId = container.id || container.className;
      
      // Evitar múltiplas tentativas simultâneas
      if (state.isPlaying || state.playPromise) {
        console.log(`⏭️ Play already in progress for ${containerId}, skipping`);
        return;
      }

      // Verificar limite de tentativas
      if (state.retryCount >= maxRetries) {
        console.error(`❌ Max retry attempts (${maxRetries}) reached for ${containerId}`);
        return;
      }

      state.retryCount++;
      console.log(`🎮 Attempting to play video in ${containerId} (attempt ${state.retryCount}/${maxRetries})`, {
        paused: video.paused,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: video.currentTime,
        streamActive: stream.active,
        streamTracks: stream.getTracks().length
      });

      try {
        // Verificar se o stream ainda está ativo
        if (!stream.active || stream.getTracks().length === 0) {
          console.warn(`⚠️ Stream is not active for ${containerId}, aborting play attempt`);
          return;
        }

        // Verificar se o vídeo está pronto para reprodução
        if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          console.log(`⏳ Video not ready yet for ${containerId}, waiting...`);
          
          // Aguardar até que os dados estejam disponíveis
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for video data'));
            }, 5000);

            const checkReady = () => {
              if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                clearTimeout(timeout);
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        }

        // Criar e gerenciar a promise de play()
        state.playPromise = video.play();
        await state.playPromise;
        
        console.log(`✅ Video playing successfully in ${containerId}`);
        state.playPromise = null;
        
      } catch (error: any) {
        state.playPromise = null;
        
        // Tratar diferentes tipos de erro
        if (error.name === 'AbortError') {
          console.warn(`⚠️ Play was aborted for ${containerId} (attempt ${state.retryCount}):`, error.message);
          
          // Para AbortError, aguardar um pouco antes de tentar novamente
          if (state.retryCount < maxRetries) {
            const delay = 500 * state.retryCount; // Backoff exponencial
            console.log(`🔄 Retrying play for ${containerId} in ${delay}ms...`);
            
            setTimeout(() => {
              // Verificar se ainda é o mesmo stream antes de tentar novamente
              if (state.lastStreamId === streamId) {
                attemptPlay(video, container, state, streamId, maxRetries);
              }
            }, delay);
          }
          
        } else if (error.name === 'NotAllowedError') {
          console.error(`🚫 Autoplay not allowed for ${containerId}:`, error.message);
          // Para autoplay bloqueado, não tentar novamente automaticamente
          
        } else {
          console.error(`❌ Play failed for ${containerId} (attempt ${state.retryCount}):`, {
            name: error.name,
            message: error.message,
            readyState: video.readyState,
            networkState: video.networkState
          });
          
          // Para outros erros, tentar novamente com delay
          if (state.retryCount < maxRetries) {
            const delay = 1000 * state.retryCount;
            setTimeout(() => {
              if (state.lastStreamId === streamId) {
                attemptPlay(video, container, state, streamId, maxRetries);
              }
            }, delay);
          }
        }
      }
    }
  }, []);

  // Função para limpeza quando o hook é desmontado
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up all video states');
    videoStatesRef.current.clear();
  }, []);

  return { createVideoElement, cleanup };
};
