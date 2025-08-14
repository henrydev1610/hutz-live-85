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
    console.log(`🎥 STREAM DISPLAY MANAGER: Creating video for ${participantId}`);

    // Find the container using standardized ID format
    const containerId = `video-container-${participantId}`;
    let container = document.getElementById(containerId);

    // Fallback container searches
    if (!container) {
      container = document.querySelector(`[data-participant-id="${participantId}"]`);
    }
    if (!container) {
      container = document.querySelector(`#unified-video-${participantId}`);
    }

    if (!container) {
      console.warn(`⚠️ STREAM DISPLAY MANAGER: No container found for ${participantId}`);
      return;
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

    // Set stream
    video.srcObject = stream;
    container.appendChild(video);

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