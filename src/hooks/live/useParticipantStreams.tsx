
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
    console.log('🎥 CRITICAL: handleParticipantStream called for:', participantId);
    
    // Validate stream
    if (!validateStream(stream, participantId)) {
      return;
    }
    
    // Update React state immediately
    updateStreamState(participantId, stream);
    
    // Update video elements with retry logic
    const updateVideoWithRetry = async (attempt = 1, maxAttempts = 5) => {
      console.log(`📤 CRITICAL: Video update attempt ${attempt}/${maxAttempts} for ${participantId}`);
      
      try {
        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
        
        // Update video elements
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Send to transmission window
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        
        console.log(`✅ Video elements updated successfully on attempt ${attempt}`);
        
        // Show success toast
        toast({
          title: "Vídeo conectado!",
          description: `Participante ${participantId.substring(0, 8)} está transmitindo`,
        });
        
      } catch (error) {
        console.error(`❌ Video update attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying video update for ${participantId} (attempt ${attempt + 1})`);
          setTimeout(() => updateVideoWithRetry(attempt + 1, maxAttempts), 300);
        } else {
          console.error(`❌ All video update attempts failed for ${participantId}`);
        }
      }
    };
    
    // Start the retry process
    updateVideoWithRetry();
    
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
