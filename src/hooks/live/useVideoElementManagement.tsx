
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
    
    // Force stream update and immediate play
    console.log('🔗 Setting stream on video element');
    videoElement.srcObject = stream;
    
    // Force video to show immediately
    const attemptPlay = async () => {
      try {
        videoElement.style.display = 'block';
        videoElement.style.opacity = '1';
        
        await videoElement.play();
        console.log(`✅ Video playing successfully for: ${container.id}`);
        
        // Force visibility
        container.style.transform = 'translateZ(0)';
        setTimeout(() => {
          container.style.transform = '';
        }, 100);
        
        // Verify video is displaying
        setTimeout(() => {
          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            console.log(`📐 Video dimensions confirmed: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
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
        setTimeout(() => {
          videoElement.play().catch(retryErr => {
            console.error('❌ Video play retry failed:', retryErr);
          });
        }, 500);
      }
    };
    
    attemptPlay();
    
    videoElement.onloadedmetadata = () => {
      console.log(`📊 Video metadata loaded for ${container.id}`);
      attemptPlay();
    };
    
    videoElement.oncanplay = () => {
      console.log(`🎯 Video can play for ${container.id}`);
      container.style.visibility = 'visible';
      container.style.opacity = '1';
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
    
    // Enhanced retry logic with better container detection
    const updateWithRetry = (attempt = 1, maxAttempts = 10) => {
      console.log(`🔍 Attempt ${attempt}/${maxAttempts} to find video containers for:`, participantId);
      
      // Wait for DOM to be ready
      requestAnimationFrame(() => {
        // Multiple container search strategies
        const containers = [
          document.getElementById(`preview-participant-video-${participantId}`),
          document.getElementById(`participant-video-${participantId}`),
          document.querySelector(`[data-participant-id="${participantId}"]`),
          // Look for any video container that might match
          ...Array.from(document.querySelectorAll('[id*="participant-video"]')).filter(el => 
            el.id.includes(participantId.substring(0, 8))
          )
        ].filter(Boolean) as HTMLElement[];
        
        let foundAny = false;
        
        containers.forEach((container, index) => {
          if (container) {
            console.log(`📹 Found container ${index + 1} for ${participantId}:`, container.id);
            updateVideoElement(container, stream);
            foundAny = true;
          }
        });
        
        // If no containers found and we have attempts left, retry
        if (!foundAny && attempt < maxAttempts) {
          console.log(`🔄 No containers found, retrying in ${attempt * 100}ms (attempt ${attempt + 1})`);
          setTimeout(() => updateWithRetry(attempt + 1, maxAttempts), attempt * 100);
        } else if (!foundAny) {
          console.error(`❌ CRITICAL: No video containers found for participant ${participantId} after ${maxAttempts} attempts`);
          
          // Force create a container if none exists
          const gridContainer = document.querySelector('.participant-grid, [class*="grid"]');
          if (gridContainer) {
            console.log('🆘 Creating emergency video container');
            const emergencyContainer = document.createElement('div');
            emergencyContainer.id = `participant-video-${participantId}`;
            emergencyContainer.className = 'aspect-video bg-black rounded-lg overflow-hidden relative';
            emergencyContainer.setAttribute('data-participant-id', participantId);
            
            gridContainer.appendChild(emergencyContainer);
            updateVideoElement(emergencyContainer, stream);
          }
        } else {
          console.log(`✅ Successfully updated ${containers.length} video container(s) for:`, participantId);
        }
      });
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
