
import { useCallback } from 'react';
import { useVideoState } from './useVideoState';
import { useVideoEventHandlers } from './useVideoEventHandlers';
import { useVideoPlayback } from './useVideoPlayback';

export const useVideoCreation = () => {
  const { getVideoState, updateVideoState, clearAllStates } = useVideoState();
  const { setupVideoEventListeners } = useVideoEventHandlers({ updateVideoState });
  const { attemptPlaySafely, cleanupVideoElement } = useVideoPlayback({ 
    getVideoState, 
    updateVideoState 
  });

  const createVideoElement = useCallback(async (container: HTMLElement, stream: MediaStream) => {
    const containerId = container.id || container.className;
    const operationId = `${containerId}-${Date.now()}`;
    console.log(`🎬 SAFE: Creating video element in container: ${containerId} (${operationId})`);
    
    // Obter ou criar estado para este container
    const videoState = getVideoState(container);

    // Verificar se já existe um vídeo com o mesmo stream
    const existingVideo = container.querySelector('video') as HTMLVideoElement;
    
    if (existingVideo && 
        videoState.lastStreamId === stream.id && 
        existingVideo.srcObject === stream &&
        videoState.element === existingVideo) {
      console.log(`📹 REUSE: Video already exists with same stream for ${containerId} (${operationId})`);
      
      // Verificar se precisa tentar reproduzir
      if (existingVideo.paused && !videoState.isPlaying && !videoState.playPromise) {
        await attemptPlaySafely(existingVideo, container, stream, operationId);
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
      await cleanupVideoElement(existingVideo, container, operationId);
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
    updateVideoState(container, {
      lastStreamId: stream.id,
      element: videoElement,
      retryCount: 0
    });
    
    // Configurar eventos antes de adicionar stream
    setupVideoEventListeners(videoElement, container, stream.id, operationId);
    
    // Adicionar ao DOM
    container.appendChild(videoElement);
    
    // Definir stream APENAS UMA VEZ
    videoElement.srcObject = stream;
    
    // Aguardar um frame para o DOM atualizar
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Tentar reprodução inicial
    await attemptPlaySafely(videoElement, container, stream, operationId);
    
    console.log(`✅ SAFE: Video element created successfully for ${containerId} (${operationId})`);
    return videoElement;

  }, [getVideoState, updateVideoState, setupVideoEventListeners, attemptPlaySafely, cleanupVideoElement]);

  const cleanup = useCallback(() => {
    clearAllStates();
  }, [clearAllStates]);

  return { createVideoElement, cleanup };
};
