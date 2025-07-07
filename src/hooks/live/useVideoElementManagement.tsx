
import { useCallback, useEffect } from 'react';
import { useVideoCreation } from './useVideoCreation';
import { useContainerManagement } from './useContainerManagement';
import { useStreamManager } from './useStreamManager';

export const useVideoElementManagement = () => {
  const { createVideoElement, cleanup } = useVideoCreation();
  const { findVideoContainers, createEmergencyContainer } = useContainerManagement();
  const { processStreamSafely } = useStreamManager();

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
    const operationId = `${participantId}-${Date.now()}`;
    console.log(`🎬 SAFE: IMMEDIATE video update for: ${participantId} (${operationId})`, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn(`⚠️ INVALID: Stream is not active or has no video tracks (${operationId})`);
      return;
    }
    
    // Usar processamento seguro para evitar múltiplas chamadas simultâneas
    await processStreamSafely(participantId, stream, async (pId, str) => {
      console.log(`🔐 PROCESSING: Safe video processing for ${pId} (${operationId})`);
      
      // Aguardar DOM estar pronto
      if (document.readyState !== 'complete') {
        console.log(`⏳ DOM: Waiting for DOM to be ready (${operationId})`);
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(null);
          } else {
            window.addEventListener('load', () => resolve(null), { once: true });
          }
        });
      }
      
      // Encontrar containers
      const containers = await findVideoContainers(pId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ EMERGENCY: No containers found for ${pId}, creating emergency container (${operationId})`);
        const emergencyContainer = createEmergencyContainer(pId);
        if (emergencyContainer) {
          console.log(`🆘 EMERGENCY: Creating video in emergency container (${operationId})`);
          await createVideoElement(emergencyContainer, str);
        } else {
          console.error(`❌ EMERGENCY: Failed to create emergency container (${operationId})`);
          return;
        }
      } else {
        console.log(`📹 CONTAINERS: Found ${containers.length} container(s) for ${pId} (${operationId})`);
        for (const [index, container] of containers.entries()) {
          console.log(`🎯 CONTAINER: Creating video in container ${index + 1}: ${container.id || container.className} (${operationId})`);
          await createVideoElement(container, str);
        }
      }
      
      // Atualizar janela de transmissão
      if (transmissionWindowRef?.current && !transmissionWindowRef.current.closed) {
        console.log(`📤 TRANSMISSION: Sending stream to transmission window for: ${pId} (${operationId})`);
        
        transmissionWindowRef.current.postMessage({
          type: 'video-stream',
          participantId: pId,
          hasStream: true,
          timestamp: Date.now(),
          streamInfo: {
            id: str.id,
            active: str.active,
            trackCount: str.getTracks().length,
            videoTracks: str.getVideoTracks().length
          }
        }, '*');
      }
      
      console.log(`✅ COMPLETE: Video update completed successfully for ${pId} (${operationId})`);
    });
    
  }, [findVideoContainers, createEmergencyContainer, createVideoElement, processStreamSafely]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers,
    cleanup
  };
};
