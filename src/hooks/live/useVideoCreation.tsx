
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
    console.log(`🎬 FORCE: FORCING video element creation in container: ${containerId} (${operationId})`, {
      containerExists: !!container,
      streamActive: stream.active,
      streamTracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    // FORCE: Limpar container completamente
    console.log(`🧹 FORCE: Clearing container ${containerId} completely`);
    container.innerHTML = '';
    
    // FORCE: Criar novo vídeo sempre
    const videoElement = document.createElement('video');
    
    // FORCE: Configurações mais agressivas
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.preload = 'auto'; // Changed to auto for faster loading
    
    // FORCE: Todos os atributos possíveis
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('muted', 'true');
    videoElement.setAttribute('autoplay', 'true');
    
    // FORCE: Estilos mais específicos
    videoElement.className = 'w-full h-full object-cover absolute inset-0 z-10';
    videoElement.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      background-color: transparent !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
    `;
    
    // FORCE: Adicionar ao DOM PRIMEIRO
    console.log(`📺 FORCE: Adding video to container ${containerId}`);
    container.appendChild(videoElement);
    
    // FORCE: Configurar stream IMEDIATAMENTE
    console.log(`🎯 FORCE: Setting srcObject for ${containerId}`);
    videoElement.srcObject = stream;
    
    // FORCE: Event listeners básicos
    videoElement.addEventListener('loadedmetadata', () => {
      console.log(`✅ FORCE: Metadata loaded for ${containerId}`);
      videoElement.play().catch(err => {
        console.log(`⚠️ FORCE: Play failed for ${containerId}:`, err);
      });
    });
    
    videoElement.addEventListener('canplay', () => {
      console.log(`✅ FORCE: Can play for ${containerId}`);
      videoElement.play().catch(err => {
        console.log(`⚠️ FORCE: Play failed for ${containerId}:`, err);
      });
    });
    
    // FORCE: Tentar reprodução múltiplas vezes
    const forcePlay = async () => {
      try {
        console.log(`🎮 FORCE: Attempting to play video in ${containerId}`);
        await videoElement.play();
        console.log(`✅ FORCE: Video playing successfully in ${containerId}`);
      } catch (error) {
        console.log(`⚠️ FORCE: Play attempt failed for ${containerId}:`, error);
        // Try again in 100ms
        setTimeout(() => {
          if (!videoElement.paused) return;
          videoElement.play().catch(e => console.log(`⚠️ FORCE: Retry play failed:`, e));
        }, 100);
      }
    };
    
    // FORCE: Aguardar DOM e tentar play
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    
    // FORCE: Múltiplas tentativas de play
    forcePlay();
    setTimeout(forcePlay, 100);
    setTimeout(forcePlay, 300);
    
    console.log(`✅ FORCE: Video element FORCED into ${containerId} (${operationId})`);
    return videoElement;

  }, []);

  const cleanup = useCallback(() => {
    clearAllStates();
  }, [clearAllStates]);

  return { createVideoElement, cleanup };
};
