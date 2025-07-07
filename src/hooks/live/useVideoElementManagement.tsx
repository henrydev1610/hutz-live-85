import { useCallback, useEffect } from 'react';
import { useVideoCreation } from './useVideoCreation';
import { useContainerManagement } from './useContainerManagement';

export const useVideoElementManagement = () => {
  const { createVideoElement, cleanup } = useVideoCreation();
  const { findVideoContainers, createEmergencyContainer } = useContainerManagement();

  // Limpeza quando o componente for desmontado
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
    console.log('🎬 CRITICAL: IMMEDIATE video update for:', participantId, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active,
      domReady: document.readyState
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Stream is not active or has no video tracks');
      return;
    }
    
    try {
      // Wait for DOM to be fully ready if needed
      if (document.readyState !== 'complete') {
        console.log('⏳ Waiting for DOM to be ready...');
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(null);
          } else {
            window.addEventListener('load', () => resolve(null), { once: true });
          }
        });
      }
      
      // Find existing containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ No containers found for ${participantId}, creating emergency container`);
        const emergencyContainer = createEmergencyContainer(participantId);
        if (emergencyContainer) {
          console.log('🎬 Creating video in emergency container');
          await createVideoElement(emergencyContainer, stream);
        } else {
          console.error('❌ Failed to create emergency container');
          return;
        }
      } else {
        console.log(`📹 Found ${containers.length} container(s) for ${participantId}, creating videos`);
        for (const [index, container] of containers.entries()) {
          console.log(`🎯 Creating video in container ${index + 1}:`, container.id || container.className);
          await createVideoElement(container, stream);
        }
      }
      
      // Update transmission window if available
      if (transmissionWindowRef?.current && !transmissionWindowRef.current.closed) {
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
      } else {
        console.log('ℹ️ Transmission window not available (this is normal for preview)');
      }
      
      console.log(`✅ Video update completed successfully for ${participantId}`);
      
    } catch (error) {
      console.error('❌ Failed to update video elements:', error);
      throw error;
    }
  }, [findVideoContainers, createEmergencyContainer, createVideoElement]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers,
    cleanup
  };
};
