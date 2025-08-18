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
      const { participantId, stream, hasVideo, hasAudio } = event.detail;
      
      console.log(`🎯 STREAM DISPLAY MANAGER: video-stream-ready event received`, {
        participantId,
        streamId: stream?.id?.substring(0, 8),
        hasVideo,
        hasAudio,
        streamActive: stream?.active,
        trackCount: stream?.getTracks()?.length,
        timestamp: Date.now()
      });
      
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

    // ✅ ETAPA 1: MÚLTIPLOS EVENT LISTENERS PARA GARANTIR CAPTURA
    const eventTypes = ['video-stream-ready', 'participant-stream-received'];
    
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleVideoStreamReady as EventListener);
      console.log(`✅ STREAM DISPLAY MANAGER: Registered listener for ${eventType}`);
    });
    
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
        window.removeEventListener(eventType, handleVideoStreamReady as EventListener);
      });
      
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
    console.log(`🎥 STREAM DISPLAY MANAGER: Creating video for ${participantId}`, {
      streamId: stream.id.substring(0, 8),
      trackCount: stream.getTracks().length,
      active: stream.active
    });

    // ✅ ETAPA 3: ENCONTRAR OU CRIAR CONTAINER DINAMICAMENTE
    const containerSelectors = [
      `#video-container-${participantId}`,
      `#unified-video-${participantId}`, 
      `[data-participant-id="${participantId}"]`,
      `.participant-container[data-id="${participantId}"]`,
      `.video-container:has([data-participant-id="${participantId}"])`
    ];

    let container: HTMLElement | null = null;
    
    for (const selector of containerSelectors) {
      container = document.querySelector(selector);
      if (container) {
        console.log(`✅ STREAM DISPLAY MANAGER: Found container for ${participantId} using selector: ${selector}`);
        break;
      }
    }

    // ✅ ETAPA 3: CRIAR CONTAINER DINAMICAMENTE SE NÃO EXISTIR
    if (!container) {
      console.log(`🏗️ STREAM DISPLAY MANAGER: Creating dynamic container for ${participantId}`);
      
      // Try to find participant grid to append to
      const participantGrid = document.querySelector('.participant-grid, [data-testid="participant-grid"], .participants-container');
      
      if (participantGrid) {
        container = document.createElement('div');
        container.id = `video-container-${participantId}`;
        container.setAttribute('data-participant-id', participantId);
        container.className = 'participant-container relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden';
        container.innerHTML = `
          <div class="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            ${participantId.substring(0, 8)}...
          </div>
        `;
        participantGrid.appendChild(container);
        console.log(`✅ STREAM DISPLAY MANAGER: Dynamic container created for ${participantId}`);
      } else {
        console.error(`❌ STREAM DISPLAY MANAGER: No participant grid found to create container for ${participantId}`);
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
        
        if (attempts < maxAttempts) {
          setTimeout(attemptPlay, attempts * 1000);
        } else {
          console.error(`❌ STREAM DISPLAY MANAGER: Play failed after ${maxAttempts} attempts for ${participantId}`);
          
          // Dispatch failure event
          window.dispatchEvent(new CustomEvent('video-display-ready', {
            detail: { participantId, success: false, error: error.message }
          }));
        }
      }
    };

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