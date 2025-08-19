import { useCallback, useRef, useEffect } from 'react';

interface StreamRequest {
  participantId: string;
  stream: MediaStream;
  timestamp: number;
}

import { streamDebugUtils } from '@/utils/streamDebugUtils';

export const useStreamDisplayManager = () => {
  const activeCreations = useRef<Set<string>>(new Set());
  const pendingRequests = useRef<Map<string, StreamRequest>>(new Map());
  const processingQueue = useRef<StreamRequest[]>([]);
  const isProcessing = useRef(false);
  const heartbeatInterval = useRef<NodeJS.Timeout>();

  // ✅ ETAPA 1: REATIVAR STREAM DISPLAY MANAGER COM LOGS DETALHADOS
  useEffect(() => {
    console.log('🚀 STREAM DISPLAY MANAGER: Initializing with enhanced debugging...');
    
    const handleVideoStreamReady = (event: CustomEvent) => {
      const { participantId, stream, hasVideo, hasAudio, debugInfo } = event.detail;
      
      console.log(`🚨 DIAGNÓSTICO CRÍTICO: STREAM DISPLAY MANAGER received event`, {
        eventType: event.type,
        participantId,
        streamId: stream?.id?.substring(0, 8),
        hasVideo,
        hasAudio,
        streamActive: stream?.active,
        trackCount: stream?.getTracks()?.length,
        timestamp: Date.now(),
        debugInfo,
        queueLength: processingQueue.current.length,
        isProcessing: isProcessing.current
      });
      
      // ✅ DIAGNÓSTICO: Confirmar recepção do evento
      window.dispatchEvent(new CustomEvent('debug-stream-manager-received', {
        detail: { participantId, eventType: event.type, timestamp: Date.now() }
      }));
      
      if (!participantId || !stream) {
        console.error('❌ STREAM DISPLAY MANAGER: Invalid event data', { participantId, stream });
        return;
      }

      const request: StreamRequest = {
        participantId,
        stream,
        timestamp: Date.now()
      };

      // Add to queue and process immediately
      processingQueue.current.push(request);
      console.log(`📥 STREAM DISPLAY MANAGER: Added ${participantId} to processing queue (length: ${processingQueue.current.length})`);
      processQueue();
    };

    // ✅ CORREÇÃO 1: ADICIONAR LISTENER PARA BRIDGE REATIVO
    const handleReactContainerReady = (event: CustomEvent) => {
      const { participantId, stream, container } = event.detail;
      
      console.log(`🎯 BRIDGE REATIVO: Container React pronto para ${participantId}`, {
        streamId: stream?.id?.substring(0, 8),
        hasContainer: !!container,
        containerId: container?.id
      });
      
      if (!participantId || !stream || !container) {
        console.error('❌ BRIDGE REATIVO: Dados inválidos', { participantId, stream, container });
        return;
      }

      // Processar imediatamente com container React garantido
      const request: StreamRequest = {
        participantId,
        stream,
        timestamp: Date.now()
      };

      processingQueue.current.push(request);
      console.log(`📥 BRIDGE REATIVO: Adicionado ${participantId} à fila (length: ${processingQueue.current.length})`);
      processQueue();
    };
    
    // ✅ DIAGNÓSTICO CRÍTICO: MÚLTIPLOS EVENT LISTENERS COM DEBUG + BRIDGE REATIVO
    const eventTypes = ['video-stream-ready', 'participant-stream-received', 'debug-stream-dispatched', 'react-container-ready'];
    
    eventTypes.forEach(eventType => {
      if (eventType === 'react-container-ready') {
        window.addEventListener(eventType, handleReactContainerReady as EventListener);
      } else {
        window.addEventListener(eventType, handleVideoStreamReady as EventListener);
      }
      console.log(`🚨 DIAGNÓSTICO: STREAM DISPLAY MANAGER registered listener for ${eventType}`);
    });
    
    // ✅ DIAGNÓSTICO: Adicionar listener para debug de ontrack
    const handleOntrackFired = (event: CustomEvent) => {
      console.log(`🚨 DIAGNÓSTICO: ontrack fired detected for ${event.detail.participantId}`);
    };
    window.addEventListener('debug-ontrack-fired', handleOntrackFired as EventListener);
    
    // ✅ ETAPA 4: SISTEMA DE HEARTBEAT PARA DEBUG
    heartbeatInterval.current = setInterval(() => {
      console.log(`💓 STREAM DISPLAY MANAGER: Heartbeat - Active: ${activeCreations.current.size}, Queue: ${processingQueue.current.length}, Processing: ${isProcessing.current}`);
      
      // Log available containers
      const containers = document.querySelectorAll('[data-participant-id], [id*="video-container"], [id*="unified-video"]');
      console.log(`📦 STREAM DISPLAY MANAGER: Available containers: ${containers.length}`);
    }, 10000);
    
    // ✅ ETAPA 4: EXPOSE DEBUG UTILS GLOBALLY
    streamDebugUtils.exposeGlobalDebugFunctions();
    
    // Expose global debug functions
    (window as any).__streamDisplayDebug = {
      getActiveCreations: () => Array.from(activeCreations.current),
      getProcessingQueue: () => processingQueue.current,
      getIsProcessing: () => isProcessing.current,
      forceProcess: () => processQueue(),
      clearQueue: () => {
        processingQueue.current = [];
        activeCreations.current.clear();
      }
    };
    
    console.log('✅ STREAM DISPLAY MANAGER: Initialization complete, debug available at window.__streamDisplayDebug');
    
    return () => {
      eventTypes.forEach(eventType => {
        if (eventType === 'react-container-ready') {
          window.removeEventListener(eventType, handleReactContainerReady as EventListener);
        } else {
          window.removeEventListener(eventType, handleVideoStreamReady as EventListener);
        }
      });
      
      window.removeEventListener('debug-ontrack-fired', handleOntrackFired as EventListener);
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      
      delete (window as any).__streamDisplayDebug;
      delete (window as any).__streamDebug;
      console.log('🧹 STREAM DISPLAY MANAGER: Cleanup complete');
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing.current || processingQueue.current.length === 0) {
      return;
    }

    isProcessing.current = true;

    while (processingQueue.current.length > 0) {
      const request = processingQueue.current.shift()!;
      const { participantId, stream } = request;

      // Skip if already creating video for this participant
      if (activeCreations.current.has(participantId)) {
        console.log(`🔄 STREAM DISPLAY MANAGER: Skipping ${participantId} - already creating video`);
        continue;
      }

      try {
        activeCreations.current.add(participantId);
        await createVideoForParticipant(participantId, stream);
      } catch (error) {
        console.error(`❌ STREAM DISPLAY MANAGER: Failed to create video for ${participantId}:`, error);
      } finally {
        activeCreations.current.delete(participantId);
      }
    }

    isProcessing.current = false;
  }, []);

  const createVideoForParticipant = useCallback(async (participantId: string, stream: MediaStream) => {
    // CORREÇÃO CRÍTICA: Validar tracks antes de criar vídeo
    const { validateMediaStreamTracks, shouldProcessStream } = await import('@/utils/media/trackValidation');
    
    console.log(`🎥 STREAM DISPLAY MANAGER: Iniciando criação de vídeo para ${participantId}`);
    
    const validation = validateMediaStreamTracks(stream, participantId);
    console.log(`🔍 STREAM DISPLAY MANAGER: Validação de tracks para ${participantId}:`, validation);
    
    if (!shouldProcessStream(stream, participantId)) {
      console.error(`❌ STREAM DISPLAY MANAGER: REJEITADO - Stream sem tracks de vídeo ativas para ${participantId}`);
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('video-display-ready', {
        detail: { 
          participantId, 
          success: false, 
          error: 'Stream sem tracks de vídeo ativas',
          validation
        }
      }));
      return;
    }
    
    console.log(`✅ STREAM DISPLAY MANAGER: Stream aprovado para ${participantId}`, {
      streamId: stream.id.substring(0, 8),
      ...validation
    });

    // ✅ CORREÇÃO 2: PRIORIZAR CONTAINERS REACT COM DOM READY
    const containerSelectors = [
      // PRIORIDADE 1: Containers React padronizados
      `#video-container-${participantId}`,
      `#unified-video-${participantId}`,
      // PRIORIDADE 2: Data attributes React
      `[data-participant-id="${participantId}"]`,
      // PRIORIDADE 3: Fallbacks
      `.participant-container[data-id="${participantId}"]`,
      `.video-container:has([data-participant-id="${participantId}"])`
    ];

    let container: HTMLElement | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    // ✅ CORREÇÃO 3: AGUARDAR DOM READY COM RETRY
    const findContainerWithRetry = async (): Promise<HTMLElement | null> => {
      while (retryCount < maxRetries) {
        for (const selector of containerSelectors) {
          container = document.querySelector(selector);
          if (container) {
            console.log(`✅ STREAM DISPLAY MANAGER: Found React container for ${participantId} using selector: ${selector} (retry ${retryCount})`);
            return container;
          }
        }
        
        retryCount++;
        console.log(`⏳ STREAM DISPLAY MANAGER: Container not found for ${participantId}, retry ${retryCount}/${maxRetries}`);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * retryCount)); // Progressive delay
        }
      }
      
      return null;
    };
    
    container = await findContainerWithRetry();

    // ✅ CORREÇÃO 2 & 3: CRIAR EMERGENCY CONTAINER APENAS COMO ÚLTIMO RECURSO
    if (!container) {
      console.warn(`⚠️ STREAM DISPLAY MANAGER: No React container found for ${participantId} after ${maxRetries} retries`);
      console.log(`🏗️ STREAM DISPLAY MANAGER: Creating emergency container as last resort for ${participantId}`);
      
      // Try to find participant grid to append to
      const participantGrid = document.querySelector('.participant-grid, [data-testid="participant-grid"], .participants-container');
      
      if (participantGrid) {
        container = document.createElement('div');
        container.id = `video-container-${participantId}`; // PADRONIZAÇÃO: mesmo ID que React
        container.setAttribute('data-participant-id', participantId);
        container.setAttribute('data-emergency', 'true');
        container.className = 'participant-container relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden border-2 border-yellow-500';
        container.innerHTML = `
          <div class="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-sm font-bold">
            EMERGENCY ${participantId.substring(0, 6)}
          </div>
        `;
        participantGrid.appendChild(container);
        console.log(`⚠️ STREAM DISPLAY MANAGER: Emergency container created for ${participantId}`);
      } else {
        console.error(`❌ STREAM DISPLAY MANAGER: No participant grid found to create emergency container for ${participantId}`);
        return;
      }
    }

    // Remove existing video elements
    const existingVideos = container.querySelectorAll('video');
    existingVideos.forEach(video => video.remove());

    // Create new video element
    const video = document.createElement('video');
    video.id = `stream-video-${participantId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.className = 'w-full h-full object-cover absolute inset-0 z-10';
    video.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
      background: #000;
    `;

    // ✅ ETAPA 4: LOG STREAM INFO ANTES DE CONFIGURAR
    streamDebugUtils.logStreamInfo(participantId, stream);
    
    // Set stream
    video.srcObject = stream;
    container.appendChild(video);
    
    console.log(`📹 STREAM DISPLAY MANAGER: Video element created and added to container for ${participantId}`);

    // IMPLEMENTAÇÃO CRÍTICA: Fallback para reaplica srcObject
    let fallbackApplied = false;
    const applyFallback = () => {
      if (!fallbackApplied) {
        fallbackApplied = true;
        console.log(`🔄 STREAM DISPLAY MANAGER: Aplicando fallback - recarregando srcObject para ${participantId}`);
        
        // Reaplica srcObject após delay
        setTimeout(() => {
          if (video.srcObject !== stream) {
            video.srcObject = stream;
            console.log(`🔄 STREAM DISPLAY MANAGER: srcObject reaplicado para ${participantId}`);
          }
        }, 1000);
      }
    };

    // Attempt playback with retries
    let attempts = 0;
    const maxAttempts = 3;

    const attemptPlay = async () => {
      try {
        await video.play();
        console.log(`✅ STREAM DISPLAY MANAGER: Video playing for ${participantId}`);
        
        // Dispatch success event
        window.dispatchEvent(new CustomEvent('video-display-ready', {
          detail: { participantId, success: true }
        }));
      } catch (error) {
        attempts++;
        console.warn(`⚠️ STREAM DISPLAY MANAGER: Play attempt ${attempts} failed for ${participantId}:`, error);
        
        // Aplicar fallback na primeira falha
        if (attempts === 1) {
          applyFallback();
        }
        
        if (attempts < maxAttempts) {
          setTimeout(attemptPlay, attempts * 1000);
        } else {
          console.error(`❌ STREAM DISPLAY MANAGER: Play failed after ${maxAttempts} attempts for ${participantId}`);
          
          // Último recurso: tentar fallback final
          applyFallback();
          
          // Dispatch failure event
          window.dispatchEvent(new CustomEvent('video-display-ready', {
            detail: { participantId, success: false, error: error.message }
          }));
        }
      }
    };

    // Monitor para reaplica srcObject se vídeo não iniciar em 3s
    const fallbackTimer = setTimeout(() => {
      if (video.readyState === 0 || video.videoWidth === 0) {
        console.log(`⚠️ STREAM DISPLAY MANAGER: Vídeo não iniciou em 3s, aplicando fallback para ${participantId}`);
        applyFallback();
      }
    }, 3000);

    video.addEventListener('loadeddata', () => {
      clearTimeout(fallbackTimer);
    }, { once: true });

    attemptPlay();
  }, []);

  const cleanup = useCallback(() => {
    activeCreations.current.clear();
    pendingRequests.current.clear();
    processingQueue.current = [];
    isProcessing.current = false;
  }, []);

  return {
    cleanup
  };
};