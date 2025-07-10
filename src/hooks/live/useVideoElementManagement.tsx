
import { useCallback, useEffect } from 'react';
import { useVideoCreation } from './useVideoCreation';
import { useContainerManagement } from './useContainerManagement';
import { useStreamManager } from './useStreamManager';

export const useVideoElementManagement = () => {
  const { createVideoElement, cleanup } = useVideoCreation();
  const { findVideoContainers, createEmergencyContainer } = useContainerManagement();
  const { processStreamSafely, resetParticipantState } = useStreamManager();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const updateVideoElementsImmediately = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef?: React.MutableRefObject<Window | null>
  ) => {
    console.log('🎯 CRITICAL: updateVideoElementsImmediately called for:', participantId);
    
    try {
      // Process the stream safely, even if it appears invalid
      if (!stream) {
        console.warn('⚠️ No stream provided for:', participantId);
        return;
      }

      console.log('🔄 Processing stream with details:', {
        participantId,
        streamId: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // Enhanced DOM ready waiting with multiple strategies
      const waitForDOM = () => new Promise<void>((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
          return;
        }

        let resolved = false;
        const resolveOnce = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        // Strategy 1: readystatechange
        const readyHandler = () => {
          if (document.readyState === 'complete') {
            document.removeEventListener('readystatechange', readyHandler);
            resolveOnce();
          }
        };
        document.addEventListener('readystatechange', readyHandler);

        // Strategy 2: DOMContentLoaded + load
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolveOnce, { once: true });
        }
        window.addEventListener('load', resolveOnce, { once: true });

        // Strategy 3: Timeout fallback
        setTimeout(resolveOnce, 2000);
      });

      await waitForDOM();
      
      // Additional wait for React rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find or create video containers with retries
      let containers = await findVideoContainers(participantId);
      let retryCount = 0;
      
      while (containers.length === 0 && retryCount < 5) {
        console.log(`🔄 Retry ${retryCount + 1}: Looking for containers for ${participantId}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        containers = await findVideoContainers(participantId);
        retryCount++;
      }

      console.log('📦 Found containers for', participantId, ':', containers.length);

      if (containers.length === 0) {
        console.warn('⚠️ No containers found after retries for:', participantId);
        // Try to find any video container as fallback
        const fallbackContainers = document.querySelectorAll('.participant-video');
        if (fallbackContainers.length > 0) {
          console.log('🆘 Using fallback container strategy');
          containers = Array.from(fallbackContainers) as HTMLElement[];
        }
      }

      // Create video element for each container with enhanced error handling
      for (const container of containers) {
        try {
          await createVideoElement(container, stream);
          console.log('✅ Video element created successfully for container');
          
          // Verify video is actually playing
          const video = container.querySelector('video');
          if (video && !video.paused) {
            console.log('🎬 Video is playing successfully');
          }
        } catch (error) {
          console.error('❌ Failed to create video element:', error);
          // Try alternative video creation
          try {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            container.innerHTML = '';
            container.appendChild(video);
            await video.play();
            console.log('✅ Fallback video creation successful');
          } catch (fallbackError) {
            console.error('❌ Fallback video creation failed:', fallbackError);
          }
        }
      }

      // Send stream info to transmission window if available
      if (transmissionWindowRef?.current) {
        try {
          console.log('📡 Sending stream to transmission window for:', participantId);
          transmissionWindowRef.current.postMessage({
            type: 'stream_ready',
            participantId,
            streamId: stream.id,
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
            active: stream.active,
            timestamp: Date.now()
          }, '*');
        } catch (error) {
          console.error('❌ Failed to send to transmission window:', error);
        }
      }

      console.log('✅ CRITICAL: updateVideoElementsImmediately completed for:', participantId);
    } catch (error) {
      console.error('❌ CRITICAL: Error in updateVideoElementsImmediately for:', participantId, error);
      throw error; // Re-throw to allow retry logic
    }
  }, [findVideoContainers, createEmergencyContainer, createVideoElement]);

  const resetVideoState = useCallback((participantId: string) => {
    console.log(`🔄 CRITICAL: Resetting video state for ${participantId}`);
    resetParticipantState(participantId);
  }, [resetParticipantState]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers,
    resetVideoState,
    cleanup
  };
};
