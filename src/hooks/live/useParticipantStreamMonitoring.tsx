
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

  // Enhanced stream monitoring with better DOM-ready checks and auto-selection
  useEffect(() => {
    console.log('🔍 CRITICAL Stream Monitor:', {
      totalStreams: Object.keys(participantStreams).length,
      activeParticipants: participantList.filter(p => p.active).length,
      selectedParticipants: participantList.filter(p => p.selected).length,
      realParticipants: participantList.filter(p => !p.id.startsWith('placeholder-')).length
    });
    
    // Process streams when DOM is ready
    const processStreams = () => {
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        console.log(`📹 Processing stream for participant: ${participantId}`, {
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        const participant = participantList.find(p => p.id === participantId);
        if (participant) {
          console.log(`✅ Found participant ${participantId}, updating for transmission`);
          
          // Ensure participant is marked correctly AND selected for transmission
          setParticipantList(prev => prev.map(p => 
            p.id === participantId 
              ? { 
                  ...p, 
                  hasVideo: true, 
                  active: true, 
                  selected: true, // AUTO-SELECT for transmission
                  lastActive: Date.now() 
                }
              : p
          ));
          
          // Transfer stream to transmission and update video display
          setTimeout(() => {
            transferStreamToTransmission(participantId, stream);
            updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
          }, 150);
          
        } else {
          console.warn(`⚠️ Stream received for unknown participant: ${participantId}`);
          
          // Add new real participant for this stream and auto-select
          const newParticipant: Participant = {
            id: participantId,
            name: `Participante ${participantId.substring(0, 8)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true, // AUTO-SELECT new participants
            hasVideo: true
          };
          
          console.log(`➕ Adding new auto-selected participant: ${participantId}`);
          setParticipantList(prev => [...prev, newParticipant]);
          
          // Transfer stream and update display
          setTimeout(() => {
            transferStreamToTransmission(participantId, stream);
            updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
          }, 200);
        }
      });
    };

    // Process streams when DOM is ready
    if (document.readyState === 'complete') {
      processStreams();
    } else {
      window.addEventListener('load', processStreams);
      return () => window.removeEventListener('load', processStreams);
    }
  }, [participantList, participantStreams, transmissionWindowRef, updateVideoElementsImmediately, setParticipantList, sessionId, transferStreamToTransmission]);
};
