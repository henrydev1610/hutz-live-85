import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseVideoStreamValidatorProps {
  participantStreams: { [id: string]: MediaStream };
  participantList: any[];
  transmissionOpen: boolean;
}

export const useVideoStreamValidator = ({
  participantStreams,
  participantList,
  transmissionOpen
}: UseVideoStreamValidatorProps) => {
  const { toast } = useToast();
  const lastValidationRef = useRef<number>(0);
  const noStreamWarningRef = useRef<boolean>(false);

  useEffect(() => {
    // Skip if transmission is not open
    if (!transmissionOpen) return;

    const now = Date.now();
    
    // Throttle validation to every 3 seconds
    if (now - lastValidationRef.current < 3000) return;
    lastValidationRef.current = now;

    const activeParticipants = participantList.filter(p => p.active);
    const streamsCount = Object.keys(participantStreams).length;
    const selectedWithVideo = participantList.filter(p => p.selected).length;

    console.log('🔍 VALIDATION:', {
      activeParticipants: activeParticipants.length,
      availableStreams: streamsCount,
      selectedWithVideo: selectedWithVideo,
      streamIds: Object.keys(participantStreams)
    });

    // CRITICAL: Check for missing streams
    if (activeParticipants.length > 0 && streamsCount === 0) {
      if (!noStreamWarningRef.current) {
        console.warn('⚠️ Nenhum stream recebido do celular após 3 tentativas');
        toast({
          title: "Problema de Conexão",
          description: "Câmera conectada mas vídeo não está sendo transmitido",
          variant: "destructive"
        });
        noStreamWarningRef.current = true;
      }
    } else if (streamsCount > 0) {
      noStreamWarningRef.current = false;
    }

    // CRITICAL: Validate video element readiness
    activeParticipants.forEach(participant => {
      const videoElement = document.querySelector(`video[data-participant="${participant.id}"]`) as HTMLVideoElement;
      if (videoElement && participantStreams[participant.id]) {
        const stream = participantStreams[participant.id];
        
        if (videoElement.readyState < 3) {
          console.warn(`⚠️ Video element not ready for ${participant.id}:`, {
            readyState: videoElement.readyState,
            hasActiveTracks: stream.getVideoTracks().some(t => t.readyState === 'live')
          });
        } else {
          console.log(`✅ Video playing successfully for ${participant.id}`);
        }
      }
    });

  }, [participantStreams, participantList, transmissionOpen, toast]);

  return {
    // Return validation status
    hasActiveStreams: Object.keys(participantStreams).length > 0,
    validationsPassed: Object.keys(participantStreams).length === participantList.filter(p => p.active).length
  };
};