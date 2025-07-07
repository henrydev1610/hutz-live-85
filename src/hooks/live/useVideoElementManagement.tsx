
import { useCallback } from 'react';

export const useVideoElementManagement = () => {
  const updateVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    if (!container) {
      console.warn("❌ Video container not found");
      return;
    }
    
    console.log('🎬 Updating video element in container:', container.id, {
      streamId: stream.id,
      streamActive: stream.active,
      trackCount: stream.getTracks().length
    });
    
    let videoElement = container.querySelector('video') as HTMLVideoElement;
    
    if (!videoElement) {
      console.log('📹 Creating new video element for:', container.id);
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.className = 'w-full h-full object-cover';
      
      // Clear container and add video
      container.innerHTML = '';
      container.appendChild(videoElement);
      
      console.log('✅ Video element created and added to container');
    }
    
    // Always set stream, even if it's the same reference (tracks might have changed)
    console.log('🔗 Setting stream on video element');
    videoElement.srcObject = stream;
    
    // Enhanced play logic with retries
    const attemptPlay = async (attempt = 1, maxAttempts = 3) => {
      try {
        await videoElement.play();
        console.log(`✅ Video playing successfully for: ${container.id} (attempt ${attempt})`);
        
        // Verify video is actually playing
        setTimeout(() => {
          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            console.log(`📐 Video dimensions confirmed: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
          } else {
            console.warn(`⚠️ Video playing but no dimensions for: ${container.id}`);
          }
        }, 1000);
        
      } catch (err) {
        console.error(`❌ Video play failed for ${container.id} (attempt ${attempt}):`, err);
        
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying play for ${container.id} in 500ms...`);
          setTimeout(() => attemptPlay(attempt + 1, maxAttempts), 500);
        } else {
          console.error(`❌ All play attempts failed for ${container.id}`);
        }
      }
    };
    
    // Start play attempt
    attemptPlay();
    
    // Add event listeners for monitoring
    videoElement.onloadedmetadata = () => {
      console.log(`📊 Video metadata loaded for ${container.id}:`, {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        duration: videoElement.duration
      });
    };
    
    videoElement.oncanplay = () => {
      console.log(`🎯 Video can play for ${container.id}`);
    };
    
    videoElement.onerror = (event) => {
      console.error(`❌ Video error for ${container.id}:`, videoElement.error);
    };
  }, []);

  const updateVideoElementsImmediately = useCallback((
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef: React.MutableRefObject<Window | null>
  ) => {
    console.log('🎬 IMMEDIATE video update for:', participantId, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    // Update preview video
    const previewContainer = document.getElementById(`preview-participant-video-${participantId}`) as HTMLElement;
    if (previewContainer) {
      console.log('📹 Updating preview video for:', participantId);
      updateVideoElement(previewContainer, stream);
    } else {
      console.log('⚠️ Preview container not found for:', participantId);
    }
    
    // Update grid video
    const gridContainer = document.getElementById(`participant-video-${participantId}`) as HTMLElement;
    if (gridContainer) {
      console.log('📹 Updating grid video for:', participantId);
      updateVideoElement(gridContainer, stream);
    } else {
      console.log('⚠️ Grid container not found for:', participantId);
      
      // Try to find container by class or other means
      const alternativeContainer = document.querySelector(`[data-participant-id="${participantId}"]`) as HTMLElement;
      if (alternativeContainer) {
        console.log('📹 Found alternative container for:', participantId);
        updateVideoElement(alternativeContainer, stream);
      }
    }
    
    // Update transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      console.log(`📤 Sending stream to transmission window for: ${participantId}`);
      
      transmissionWindowRef.current.postMessage({
        type: 'video-stream',
        participantId: participantId,
        hasStream: true,
        timestamp: Date.now(),
        streamInfo: {
          id: stream.id,
          active: stream.active,
          trackCount: stream.getTracks().length
        }
      }, '*');
    } else {
      console.log('⚠️ Transmission window not available');
    }
  }, [updateVideoElement]);

  return {
    updateVideoElement,
    updateVideoElementsImmediately
  };
};
