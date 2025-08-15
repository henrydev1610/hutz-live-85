import { useCallback, useRef, useEffect } from 'react';

interface StreamRequest {
  participantId: string;
  stream: MediaStream;
  timestamp: number;
}

export const useStreamDisplayManager = () => {
  const activeCreations = useRef<Set<string>>(new Set());
  const pendingRequests = useRef<Map<string, StreamRequest>>(new Map());
  const processingQueue = useRef<StreamRequest[]>([]);
  const isProcessing = useRef(false);

  // Central event listener for stream events from WebRTC layer
  useEffect(() => {
    const handleVideoStreamReady = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      if (!participantId || !stream) return;

      console.log(`🎯 STREAM DISPLAY MANAGER: Received stream for ${participantId}`);
      
      const request: StreamRequest = {
        participantId,
        stream,
        timestamp: Date.now()
      };

      // Add to queue and process
      processingQueue.current.push(request);
      processQueue();
    };

    window.addEventListener('video-stream-ready', handleVideoStreamReady as EventListener);
    
    return () => {
      window.removeEventListener('video-stream-ready', handleVideoStreamReady as EventListener);
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
    console.log(`🎥 VIDEO-RENDER-STABLE: Creating video for ${participantId}`);

    // ENHANCED: Multiple container search strategies with immediate DOM check
    const searchStrategies = [
      () => document.getElementById(`video-container-${participantId}`),
      () => document.querySelector(`[data-participant-id="${participantId}"]`) as HTMLElement,
      () => document.querySelector(`#unified-video-${participantId}`) as HTMLElement,
      () => document.querySelector(`#participant-${participantId}`) as HTMLElement,
      () => document.querySelector(`.participant-video[data-id="${participantId}"]`) as HTMLElement,
      () => document.querySelector(`[data-video-id="${participantId}"]`) as HTMLElement
    ];

    let container: HTMLElement | null = null;
    for (const strategy of searchStrategies) {
      container = strategy();
      if (container) {
        console.log(`🎯 VIDEO-RENDER-STABLE: Found container via strategy for ${participantId}`, container.id || container.className);
        break;
      }
    }

    if (!container) {
      console.error(`❌ VIDEO-RENDER-STABLE: NO CONTAINER FOUND for ${participantId}`);
      console.error(`🔍 Available containers:`, Array.from(document.querySelectorAll('[id*="video"], [data-participant-id], [class*="video"]')).map(el => ({
        id: el.id, 
        className: el.className,
        dataId: el.getAttribute('data-participant-id')
      })));
      
      // Dispatch failure event immediately 
      window.dispatchEvent(new CustomEvent('video-display-ready', {
        detail: { participantId, success: false, error: 'No container found' }
      }));
      return;
    }

    // CRITICAL: Force clear existing content
    console.log(`🧹 VIDEO-RENDER-STABLE: Clearing existing content for ${participantId}`);
    container.innerHTML = '';

    // ENHANCED: Create video with guaranteed properties
    const video = document.createElement('video');
    const videoId = `video-${participantId}-${Date.now()}`;
    video.id = videoId;
    
    // CRITICAL: Set all video properties before adding to DOM
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.className = 'w-full h-full object-cover';
    
    // FORCE CSS: Absolute positioning to ensure visibility
    video.style.cssText = `
      display: block !important;
      width: 100% !important;  
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 15 !important;
      background: #1a1a1a !important;
      border-radius: inherit;
    `;

    // CRITICAL: Assign stream BEFORE DOM insertion
    video.srcObject = stream;
    
    console.log(`📱 VIDEO-RENDER-STABLE: Inserting video into container for ${participantId}`);
    container.appendChild(video);
    
    // ENHANCED: Immediate play attempt with aggressive retry
    const playVideo = async () => {
      try {
        console.log(`▶️ VIDEO-RENDER-STABLE: Attempting play for ${participantId}`);
        await video.play();
        
        console.log(`✅ VIDEO-RENDER-STABLE: Video playing successfully for ${participantId}`);
        window.dispatchEvent(new CustomEvent('video-display-ready', {
          detail: { participantId, success: true, videoId }
        }));
        
      } catch (error) {
        console.error(`❌ VIDEO-RENDER-STABLE: Play failed for ${participantId}:`, error);
        
        // RETRY: One more attempt with delay
        setTimeout(async () => {
          try {
            await video.play();
            console.log(`✅ VIDEO-RENDER-STABLE: Retry successful for ${participantId}`);
            window.dispatchEvent(new CustomEvent('video-display-ready', {
              detail: { participantId, success: true, videoId }
            }));
          } catch (retryError) {
            console.error(`❌ VIDEO-RENDER-STABLE: Final retry failed for ${participantId}:`, retryError);
            window.dispatchEvent(new CustomEvent('video-display-ready', {
              detail: { participantId, success: false, error: retryError.message }
            }));
          }
        }, 1000);
      }
    };

    // IMMEDIATE: Start playback
    playVideo();
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