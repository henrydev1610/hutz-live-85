
import { useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { useStreamValidation } from './useStreamValidation';
import { useStreamTransmission } from './useStreamTransmission';
import { useStreamStateManagement } from './useStreamStateManagement';
import { useStreamBuffer } from './useStreamBuffer';

import { useStreamTransmissionHandler } from './useStreamTransmissionHandler';

interface UseParticipantStreamsProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef?: React.MutableRefObject<Window | null>) => void;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  sessionId: string;
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
}

export const useParticipantStreams = ({
  setParticipantStreams,
  setParticipantList,
  updateVideoElementsImmediately,
  transmissionWindowRef,
  sessionId,
  participantList,
  participantStreams
}: UseParticipantStreamsProps) => {
  const { toast } = useToast();
  const { validateStream } = useStreamValidation();
  const { sendStreamToTransmission: legacySendStreamToTransmission } = useStreamTransmission();
  const { updateStreamState, updateTrackState } = useStreamStateManagement({
    setParticipantStreams,  
    setParticipantList
  });
  const { addToBuffer, processBuffer, removeFromBuffer, cleanup } = useStreamBuffer();
  
  // New enhanced stream transmission handler with mobile priority
  const { sendStreamToTransmission, updateTransmissionParticipants, forceRetransmitStreams } = useStreamTransmissionHandler({
    sessionId,
    transmissionWindowRef,
    participantList,
    participantStreams
  });

  // Process function for buffered streams with mobile priority
  const processStreamSafely = useCallback(async (participantId: string, stream: MediaStream): Promise<boolean> => {
    try {
      console.log('🎯 CRITICAL: Processing stream for:', participantId);
      
      // Find participant info
      const participant = participantList.find(p => p.id === participantId);
      const isMobile = participant?.isMobile || false;
      
      console.log(`📱 CRITICAL: Participant ${participantId} is ${isMobile ? 'MOBILE' : 'DESKTOP'} device`);
      
      // Update stream state immediately
      updateStreamState(participantId, stream);
      
      // Wait for DOM to be ready
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(undefined);
        } else {
          const handler = () => {
            document.removeEventListener('readystatechange', handler);
            resolve(undefined);
          };
          document.addEventListener('readystatechange', handler);
        }
      });
      
      // Process video update with timeout
      await Promise.race([
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Video processing timeout')), 5000))
      ]);
      
      // Send to transmission window with mobile prioritization
      sendStreamToTransmission(participantId, stream, isMobile);
      
      // Success notification with mobile indication
      toast({
        title: `${isMobile ? '📱 Mobile' : '💻 Desktop'} Participante conectado!`,
        description: `${participantId.substring(0, 8)} está transmitindo vídeo${isMobile ? ' (Prioridade Móvel)' : ''}`,
      });
      
      console.log(`✅ CRITICAL: Stream processing completed for: ${participantId} (${isMobile ? 'MOBILE' : 'DESKTOP'})`);
      return true;
    } catch (error) {
      console.error('❌ Error processing stream for:', participantId, error);
      
      // Error notification only for final failures
      if (error.message !== 'Video processing timeout') {
        toast({
          title: "Erro no vídeo",
          description: `Falha ao exibir vídeo de ${participantId.substring(0, 8)}`,
          variant: "destructive"
        });
      }
      return false;
    }
  }, [updateStreamState, updateVideoElementsImmediately, transmissionWindowRef, sendStreamToTransmission, toast, participantList]);

  const handleParticipantStream = useCallback(async (participantId: string, stream: MediaStream) => {
    console.log('🎬 MOBILE-CRITICAL: Handling participant stream for:', participantId);
    
    // Verificações de segurança
    if (!participantId || !stream) {
      console.error('❌ CRITICAL: Invalid parameters for handleParticipantStream');
      return;
    }
    
    console.log('🎬 STREAM-DETAILS:', {
      participantId,
      streamId: stream.id,
      tracks: stream.getTracks()?.map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })) || [],
      active: stream.active
    });
    
    // CRITICAL: Immediate participant state update with mobile detection
    setParticipantList(prev => {
      // Verificação de segurança para prev
      if (!Array.isArray(prev)) {
        console.error('❌ CRITICAL: participantList is not an array:', prev);
        return [];
      }
      
      const updated = prev.map(p => 
        p?.id === participantId 
          ? { 
              ...p, 
              hasVideo: true, 
              active: true, 
              selected: true,
              connectedAt: Date.now(),
              isMobile: true // FORCE mobile flag for stream participants
            }
          : p
      );
      
      // If participant doesn't exist, add it as mobile participant
      if (!updated.find(p => p?.id === participantId)) {
        const newParticipant = {
          id: participantId,
          name: `Mobile-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: true
        };
        updated.push(newParticipant);
        console.log('🆕 MOBILE-NEW: Added new mobile participant:', newParticipant);
      }
      
      const mobileCount = updated.filter(p => p?.isMobile).length;
      console.log('🔄 MOBILE-STATE: Updated participant list. Mobile count:', mobileCount);  
      return updated;
    });
    
    if (!validateStream(stream, participantId)) {
      console.warn('❌ Stream validation failed for:', participantId);
      return;
    }

    // Force immediate stream state update
    setParticipantStreams(prev => {
      const updated = { ...prev, [participantId]: stream };
      console.log('🔄 MOBILE-STREAM: Updated streams for:', participantId);
      return updated;
    });

    // Try immediate processing first
    const success = await processStreamSafely(participantId, stream);
    
    if (!success) {
      // Add to buffer for retry
      console.log('📦 Adding to buffer for retry:', participantId);
      addToBuffer(participantId, stream);
    }
  }, [validateStream, processStreamSafely, addToBuffer, setParticipantList, setParticipantStreams]);

  // Process buffer periodically
  useEffect(() => {
    const interval = setInterval(() => {
      processBuffer(processStreamSafely);
    }, 2000);

    return () => clearInterval(interval);
  }, [processBuffer, processStreamSafely]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleParticipantTrack = useCallback((participantId: string, track: MediaStreamTrack) => {
    updateTrackState(participantId, track);
    
    // Send updated stream to transmission and update video elements
    setTimeout(async () => {
      const currentStreams = await new Promise<{[id: string]: MediaStream}>(resolve => {
        setParticipantStreams(prev => {
          resolve(prev);
          return prev;
        });
      });
      
      const stream = currentStreams[participantId];
      if (stream) {
        const participant = participantList.find(p => p.id === participantId);
        const isMobile = participant?.isMobile || false;
        sendStreamToTransmission(participantId, stream, isMobile);
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
      }
    }, 100);
  }, [updateTrackState, transmissionWindowRef, updateVideoElementsImmediately, sendStreamToTransmission, setParticipantStreams]);

  return {
    handleParticipantStream,
    handleParticipantTrack,
    sendStreamToTransmission: (participantId: string, stream: MediaStream) => {
      const participant = participantList.find(p => p.id === participantId);
      const isMobile = participant?.isMobile || false;
      return sendStreamToTransmission(participantId, stream, isMobile);
    },
    updateTransmissionParticipants,
    forceRetransmitStreams
  };
};
