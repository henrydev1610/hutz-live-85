import { useEffect, useCallback } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseMobileCameraForcerProps {
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
}

/**
 * Hook to force mobile camera display and ensure they are never filtered out
 */
export const useMobileCameraForcer = ({
  participantList,
  participantStreams,
  setParticipantList
}: UseMobileCameraForcerProps) => {
  
  // Force mobile participants to be visible
  const forceMobileDisplay = useCallback(() => {
    console.log('🚀 MOBILE-FORCER: Forcing mobile camera display');
    
    setParticipantList(prev => {
      return prev.map(participant => {
        // If participant has a stream and is mobile, ensure they're always active/selected
        if (participantStreams[participant.id] && (participant.isMobile || participant.id.includes('mobile'))) {
          return {
            ...participant,
            active: true,
            selected: true,
            hasVideo: true,
            isMobile: true,
            lastActive: Date.now(),
            connectedAt: Date.now()
          };
        }
        return participant;
      });
    });
  }, [participantStreams, setParticipantList]);

  // Monitor for new mobile streams and force their display
  useEffect(() => {
    const mobileStreams = Object.keys(participantStreams).filter(id => {
      const participant = participantList.find(p => p.id === id);
      return participant?.isMobile || id.includes('mobile');
    });

    if (mobileStreams.length > 0) {
      console.log('📱 MOBILE-FORCER: Detected mobile streams, forcing display:', mobileStreams);
      forceMobileDisplay();
    }
  }, [participantStreams, participantList, forceMobileDisplay]);

  // Auto-refresh mobile participants every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const mobileParticipants = participantList.filter(p => p.isMobile);
      const mobileWithStreams = mobileParticipants.filter(p => participantStreams[p.id]);
      
      if (mobileWithStreams.length > 0) {
        console.log('⏰ MOBILE-FORCER: Auto-refreshing mobile participants');
        forceMobileDisplay();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [participantList, participantStreams, forceMobileDisplay]);

  return {
    forceMobileDisplay
  };
};