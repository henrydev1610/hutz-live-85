
import { useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { useStreamValidation } from './useStreamValidation';
import { useStreamTransmission } from './useStreamTransmission';
import { useStreamStateManagement } from './useStreamStateManagement';

interface UseParticipantStreamsProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef?: React.MutableRefObject<Window | null>) => void;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useParticipantStreams = ({
  setParticipantStreams,
  setParticipantList,
  updateVideoElementsImmediately,
  transmissionWindowRef
}: UseParticipantStreamsProps) => {
  const { toast } = useToast();
  const { validateStream } = useStreamValidation();
  const { sendStreamToTransmission } = useStreamTransmission();
  const { updateStreamState, updateTrackState } = useStreamStateManagement({
    setParticipantStreams,
    setParticipantList
  });

  const handleParticipantStream = useCallback((participantId: string, stream: MediaStream) => {
    const operationId = `${participantId}-${Date.now()}`;
    console.log(`🎥 CRITICAL: handleParticipantStream called for: ${participantId} (${operationId})`, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      totalTracks: stream.getTracks().length
    });
    
    // Validate stream
    if (!validateStream(stream, participantId)) {
      console.error(`❌ CRITICAL: Stream validation failed for ${participantId}`);
      return;
    }
    
    console.log(`✅ CRITICAL: Stream validated successfully for ${participantId}`);
    
    // FORCE immediate state update with video
    updateStreamState(participantId, stream);
    
    // IMMEDIATELY process video update
    const processVideoUpdate = async () => {
      console.log(`📤 CRITICAL: IMMEDIATE video processing for ${participantId} (${operationId})`);
      
      try {
        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // FORCE video element creation
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Send to transmission window immediately
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        
        console.log(`✅ CRITICAL: Video processing completed for ${participantId} (${operationId})`);
        
        // Success notification
        toast({
          title: "Participante conectado!",
          description: `${participantId.substring(0, 8)} está transmitindo vídeo`,
        });
        
      } catch (error) {
        console.error(`❌ CRITICAL: Video processing failed (${operationId}):`, error);
        
        // Error notification
        toast({
          title: "Erro no vídeo",
          description: `Falha ao exibir vídeo de ${participantId.substring(0, 8)}`,
          variant: "destructive"
        });
      }
    };
    
    // Execute immediately without delay
    processVideoUpdate();
    
  }, [validateStream, updateStreamState, updateVideoElementsImmediately, transmissionWindowRef, sendStreamToTransmission, toast]);

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
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
      }
    }, 100);
  }, [updateTrackState, transmissionWindowRef, updateVideoElementsImmediately, sendStreamToTransmission, setParticipantStreams]);

  return {
    handleParticipantStream,
    handleParticipantTrack,
    sendStreamToTransmission
  };
};
