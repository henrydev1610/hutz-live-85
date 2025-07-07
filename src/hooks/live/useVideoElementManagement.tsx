
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
      
      container.innerHTML = '';
      container.appendChild(videoElement);
      
      console.log('✅ Video element created and added to container');
    }
    
    // CRITICAL FIX: Force stream update and immediate play
    console.log('🔗 Setting stream on video element');
    videoElement.srcObject = stream;
    
    // Force video to show immediately
    const attemptPlay = async () => {
      try {
        // Ensure video is visible
        videoElement.style.display = 'block';
        videoElement.style.opacity = '1';
        
        await videoElement.play();
        console.log(`✅ Video playing successfully for: ${container.id}`);
        
        // Force a layout recalculation to ensure video appears
        container.style.transform = 'translateZ(0)';
        setTimeout(() => {
          container.style.transform = '';
        }, 100);
        
        // Verify video is actually displaying
        setTimeout(() => {
          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            console.log(`📐 Video dimensions confirmed: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            
            // Force container to show the video
            container.style.background = 'transparent';
            if (container.parentElement) {
              container.parentElement.style.background = 'transparent';
            }
          } else {
            console.warn(`⚠️ Video playing but no dimensions for: ${container.id}`);
          }
        }, 1000);
        
      } catch (err) {
        console.error(`❌ Video play failed for ${container.id}:`, err);
        
        // Retry once more
        setTimeout(() => {
          videoElement.play().catch(retryErr => {
            console.error('❌ Video play retry failed:', retryErr);
          });
        }, 500);
      }
    };
    
    // Start play attempt immediately
    attemptPlay();
    
    // Enhanced event listeners
    videoElement.onloadedmetadata = () => {
      console.log(`📊 Video metadata loaded for ${container.id}:`, {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        duration: videoElement.duration
      });
      
      // Force another play attempt after metadata loads
      attemptPlay();
    };
    
    videoElement.oncanplay = () => {
      console.log(`🎯 Video can play for ${container.id}`);
      
      // Ensure container is visible when video can play
      container.style.visibility = 'visible';
      container.style.opacity = '1';
    };
    
    videoElement.onerror = (event) => {
      console.error(`❌ Video error for ${container.id}:`, videoElement.error);
    };

    videoElement.onloadstart = () => {
      console.log(`🎬 Video load started for ${container.id}`);
    };

    videoElement.onloadeddata = () => {
      console.log(`📊 Video data loaded for ${container.id}`);
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
    
    // Force immediate DOM query with multiple attempts
    const updateWithRetry = (attempt = 1, maxAttempts = 5) => {
      console.log(`🔍 Attempt ${attempt}/${maxAttempts} to find video containers for:`, participantId);
      
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
        
        // Try alternative selectors
        const alternativeContainer = document.querySelector(`[data-participant-id="${participantId}"]`) as HTMLElement;
        if (alternativeContainer) {
          console.log('📹 Found alternative container for:', participantId);
          updateVideoElement(alternativeContainer, stream);
        }
      }
      
      // If containers not found and we have attempts left, retry
      if (!previewContainer && !gridContainer && attempt < maxAttempts) {
        console.log(`🔄 Retrying container search in 200ms (attempt ${attempt + 1})`);
        setTimeout(() => updateWithRetry(attempt + 1, maxAttempts), 200);
      }
    };
    
    // Start immediate update
    updateWithRetry();
    
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
