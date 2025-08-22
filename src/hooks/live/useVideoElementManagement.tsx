
import { useCallback, useEffect } from 'react';
import { useUnifiedVideoCreation } from './useUnifiedVideoCreation';
import { useContainerManagement } from './useContainerManagement';

export const useVideoElementManagement = () => {
  const { createVideoElementUnified, cleanup } = useUnifiedVideoCreation();
  const { findVideoContainers } = useContainerManagement();

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
    console.log('🎯 CLEAN VIDEO MANAGEMENT: Processing stream for:', participantId);
    
    if (!stream || !stream.active) {
      console.warn('⚠️ CLEAN VIDEO MANAGEMENT: Invalid or inactive stream for:', participantId);
      return;
    }

    try {
      // Wait for DOM to be ready
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(void 0);
        } else {
          const handler = () => {
            if (document.readyState === 'complete') {
              document.removeEventListener('readystatechange', handler);
              resolve(void 0);
            }
          };
          document.addEventListener('readystatechange', handler);
        }
      });

      // Additional wait for React rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn('⚠️ CLEAN VIDEO MANAGEMENT: No containers found for:', participantId);
        return;
      }

      console.log(`📦 CLEAN VIDEO MANAGEMENT: Found ${containers.length} containers for ${participantId}`);

      // Create video in each container using unified system
      for (const container of containers) {
        try {
          const videoElement = await createVideoElementUnified(container, stream, participantId);
          if (videoElement) {
            console.log('✅ CLEAN VIDEO MANAGEMENT: Video created successfully in container');
          }
        } catch (error) {
          console.error('❌ CLEAN VIDEO MANAGEMENT: Failed to create video in container:', error);
        }
      }

      // Send to transmission window with instrumentation
      if (transmissionWindowRef?.current && !transmissionWindowRef.current.closed) {
        try {
          console.log('TRANSMISSION-WINDOW-OPEN');
          transmissionWindowRef.current.postMessage({
            type: 'stream_ready',
            participantId,
            streamId: stream.id,
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
            active: stream.active,
            timestamp: Date.now()
          }, '*');
          console.log('TRANSMISSION-UPDATE-APPLIED');
          console.log('📡 CLEAN VIDEO MANAGEMENT: Stream info sent to transmission window');
        } catch (error) {
          console.error('❌ CLEAN VIDEO MANAGEMENT: Failed to send to transmission window:', error);
        }
      } else {
        console.log('TRANSMISSION-WINDOW-MISSING');
        console.log('TRANSMISSION-UPDATE-QUEUED');
        // Defer update instead of failing
        console.log('📊 CLEAN VIDEO MANAGEMENT: Deferring transmission update - window missing');
      }

      console.log('✅ CLEAN VIDEO MANAGEMENT: Completed processing for:', participantId);
    } catch (error) {
      console.error('❌ CLEAN VIDEO MANAGEMENT: Error processing:', participantId, error);
      throw error;
    }
  }, [createVideoElementUnified, findVideoContainers]);

  return {
    updateVideoElementsImmediately,
    cleanup
  };
};
