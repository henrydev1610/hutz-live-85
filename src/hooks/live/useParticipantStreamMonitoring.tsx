
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseParticipantStreamMonitoringProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef: React.MutableRefObject<Window | null>) => void;
  transferStreamToTransmission: (participantId: string, stream: MediaStream) => void;
  sessionId: string | null;
}

export const useParticipantStreamMonitoring = ({
  participantList,
  setParticipantList,
  participantStreams,
  transmissionWindowRef,
  updateVideoElementsImmediately,
  transferStreamToTransmission,
  sessionId
}: UseParticipantStreamMonitoringProps) => {

  // SIMPLIFIED stream monitoring - remove duplicate calls that cause flickering
  useEffect(() => {
    const activeStreams = Object.keys(participantStreams).length;
    const activeParticipants = participantList.filter(p => p.active).length;
    const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo).length;
    const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-')).length;
    
    console.log('🔍 MONITOR: Stream monitoring - SIMPLIFIED:', {
      totalStreams: activeStreams,
      activeParticipants,
      selectedParticipants,
      realParticipants,
      domReady: document.readyState
    });
    
    // Only update participant state, NOT trigger video processing
    // Video processing is now handled by the main handleParticipantStream callback only
    for (const [participantId, stream] of Object.entries(participantStreams)) {
      console.log(`📋 STATE: Updating participant state for: ${participantId}`, {
        streamActive: stream.active,
        trackCount: stream.getTracks().length
      });
      
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        // Update existing participant
        setParticipantList(prev => prev.map(p => 
          p.id === participantId 
            ? { 
                ...p, 
                hasVideo: true, 
                active: true, 
                selected: true,
                lastActive: Date.now() 
              }
            : p
        ));
        
        // Only send to transmission, no video element updates here
        transferStreamToTransmission(participantId, stream);
        
      } else {
        // Add new participant but don't trigger video processing
        console.warn(`➕ NEW: Adding new participant without video processing: ${participantId}`);
        
        const newParticipant: Participant = {
          id: participantId,
          name: `Participante ${participantId.substring(0, 8)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: true,
          hasVideo: true
        };
        
        setParticipantList(prev => [...prev, newParticipant]);
        transferStreamToTransmission(participantId, stream);
      }
    }

  }, [participantList, participantStreams, transferStreamToTransmission, setParticipantList, sessionId]);
};
