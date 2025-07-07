
import { useCallback } from 'react';

export const useVideoElementManagement = () => {
  const createVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    console.log('🎬 Creating video element in container:', container.id);
    
    // Remove any existing video elements
    const existingVideos = container.querySelectorAll('video');
    existingVideos.forEach(video => video.remove());
    
    // Clear container content
    container.innerHTML = '';
    
    // Create new video element
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.className = 'w-full h-full object-cover';
    videoElement.style.display = 'block';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    
    // Set stream immediately
    videoElement.srcObject = stream;
    
    // Add to container
    container.appendChild(videoElement);
    
    // Force play with error handling
    const attemptPlay = async () => {
      try {
        await videoElement.play();
        console.log(`✅ Video playing successfully in: ${container.id}`);
        container.style.background = 'transparent';
      } catch (error) {
        console.error(`❌ Video play failed in ${container.id}:`, error);
        // Retry after short delay
        setTimeout(() => {
          videoElement.play().catch(retryError => 
            console.error('❌ Video play retry failed:', retryError)
          );
        }, 500);
      }
    };
    
    // Handle video events
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
      console.error(`❌ Video error in ${container.id}:`, videoElement.error);
    };
    
    // Start playing
    attemptPlay();
    
    return videoElement;
  }, []);

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
      videoElement = createVideoElement(container, stream);
    } else {
      console.log('🔗 Updating existing video element stream');
      videoElement.srcObject = stream;
      
      // Force play
      videoElement.play().catch(err => {
        console.error(`❌ Video play failed for ${container.id}:`, err);
      });
    }
  }, [createVideoElement]);

  const findVideoContainers = useCallback((participantId: string) => {
    // Wait for DOM to be ready
    return new Promise<HTMLElement[]>((resolve) => {
      const searchContainers = () => {
        const containers: HTMLElement[] = [];
        
        // Multiple search strategies
        const selectors = [
          `#preview-participant-video-${participantId}`,
          `#participant-video-${participantId}`,
          `[data-participant-id="${participantId}"]`,
          `.participant-video-${participantId}`,
          // Generic participant containers
          '[id*="participant-video"]',
          '[class*="participant-video"]',
          '.participant-grid [class*="rounded"]',
          '.participant-grid > div'
        ];
        
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const htmlEl = el as HTMLElement;
              if (htmlEl && !containers.includes(htmlEl)) {
                // Check if this container is related to our participant
                if (selector.includes(participantId) || 
                    htmlEl.id.includes(participantId) || 
                    htmlEl.getAttribute('data-participant-id') === participantId) {
                  containers.push(htmlEl);
                }
              }
            });
          } catch (e) {
            // Ignore selector errors
          }
        });
        
        return containers;
      };
      
      const containers = searchContainers();
      if (containers.length > 0) {
        resolve(containers);
      } else {
        // Wait a bit and try again
        setTimeout(() => {
          const retryContainers = searchContainers();
          resolve(retryContainers);
        }, 100);
      }
    });
  }, []);

  const createEmergencyContainer = useCallback((participantId: string) => {
    console.log('🆘 Creating emergency video container for:', participantId);
    
    // Find a parent container to add our video to
    const possibleParents = [
      document.querySelector('.participant-grid'),
      document.querySelector('[class*="grid"]'),
      document.querySelector('.live-preview'),
      document.querySelector('[class*="preview"]'),
      document.body
    ];
    
    for (const parent of possibleParents) {
      if (parent) {
        const emergencyContainer = document.createElement('div');
        emergencyContainer.id = `participant-video-${participantId}`;
        emergencyContainer.className = 'aspect-video bg-gray-800 rounded-lg overflow-hidden relative';
        emergencyContainer.setAttribute('data-participant-id', participantId);
        emergencyContainer.style.minHeight = '200px';
        emergencyContainer.style.minWidth = '300px';
        
        parent.appendChild(emergencyContainer);
        console.log('✅ Emergency container created:', emergencyContainer.id);
        return emergencyContainer;
      }
    }
    
    return null;
  }, []);

  const updateVideoElementsImmediately = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef: React.MutableRefObject<Window | null>
  ) => {
    console.log('🎬 IMMEDIATE video update for:', participantId, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Stream is not active or has no video tracks');
      return;
    }
    
    try {
      // Find existing containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ No containers found for ${participantId}, creating emergency container`);
        const emergencyContainer = createEmergencyContainer(participantId);
        if (emergencyContainer) {
          updateVideoElement(emergencyContainer, stream);
        }
      } else {
        console.log(`📹 Found ${containers.length} container(s) for ${participantId}`);
        containers.forEach((container, index) => {
          console.log(`🎯 Updating container ${index + 1}:`, container.id || container.className);
          updateVideoElement(container, stream);
        });
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
            trackCount: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length
          }
        }, '*');
      }
      
    } catch (error) {
      console.error('❌ Failed to update video elements:', error);
    }
  }, [findVideoContainers, createEmergencyContainer, updateVideoElement]);

  return {
    updateVideoElement,
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers
  };
};
