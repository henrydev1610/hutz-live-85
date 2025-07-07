
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
    console.log(`🎥 HANDLER: handleParticipantStream called for: ${participantId} (${operationId})`, {
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
    
    // Update React state immediately
    updateStreamState(participantId, stream);
    
    // Process video update with controlled approach (sem retry excessivo)
    const processVideoUpdate = async () => {
      console.log(`📤 PROCESS: Processing video update for ${participantId} (${operationId})`);
      
      try {
        // Aguardar um pouco para o DOM estar pronto
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update video elements - agora com processamento seguro interno
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Send to transmission window
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        
        console.log(`✅ SUCCESS: Video elements updated successfully (${operationId})`);
        
        // Show success toast
        toast({
          title: "Vídeo conectado!",
          description: `Participante ${participantId.substring(0, 8)} está transmitindo`,
        });
        
      } catch (error) {
        console.error(`❌ FAILED: Video update failed (${operationId}):`, error);
        
        // Show error toast
        toast({
          title: "Erro na conexão",
          description: `Falha ao conectar vídeo do participante ${participantId.substring(0, 8)}`,
          variant: "destructive"
        });
      }
    };
    
    // Executar processamento sem retry manual (agora controlado pelo StreamManager)
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
