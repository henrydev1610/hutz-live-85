
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseTransmissionMessageHandlerProps {
  sessionId: string | null;
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
  handleParticipantJoin: (id: string) => void;
  transferStreamToTransmission?: (participantId: string, stream: MediaStream) => void;
}

export const useTransmissionMessageHandler = ({
  sessionId,
  participantStreams,
  participantList,
  transmissionWindowRef,
  updateTransmissionParticipants,
  handleParticipantJoin,
  transferStreamToTransmission
}: UseTransmissionMessageHandlerProps) => {
  
  const handleTransmissionMessage = (event: MessageEvent) => {
    console.log('📨 HOST: Received message from transmission:', event.data.type);
    
    if (event.data.type === 'transmission-ready' && event.data.sessionId === sessionId) {
      console.log('🎯 HOST: Transmission ready, sending initial data');
      
      updateTransmissionParticipants();
      
      // Send existing streams to transmission
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        const participant = participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          console.log('📤 HOST: Sending existing stream to transmission:', participantId);
          
          if (transferStreamToTransmission) {
            transferStreamToTransmission(participantId, stream);
          }
        }
      });
    }
    else if (event.data.type === 'transmission-heartbeat') {
      console.log('💓 HOST: Transmission heartbeat -', event.data.activeParticipants, 'participants');
    }
    else if (event.data.type === 'participant-joined' && event.data.sessionId === sessionId) {
      console.log('👤 HOST: Participant joined via transmission message:', event.data.id);
      handleParticipantJoin(event.data.id);
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleTransmissionMessage);
    return () => window.removeEventListener('message', handleTransmissionMessage);
  }, [sessionId, participantStreams, participantList]);
};
