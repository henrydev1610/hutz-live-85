
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useParticipantStreams } from './useParticipantStreams';
import { useParticipantLifecycle } from './useParticipantLifecycle';

interface UseParticipantManagementProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantManagementProps) => {
  const { updateVideoElementsImmediately } = useVideoElementManagement();
  
  const { handleParticipantStream, handleParticipantTrack } = useParticipantStreams({
    setParticipantStreams,
    setParticipantList,
    updateVideoElementsImmediately,
    transmissionWindowRef
  });

  const { 
    handleParticipantJoin, 
    handleParticipantSelect, 
    handleParticipantRemove 
  } = useParticipantLifecycle({
    participantList,
    setParticipantList,
    setParticipantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // Set up WebRTC callbacks immediately
  useEffect(() => {
    console.log('🔧 Setting up IMMEDIATE WebRTC callbacks');
    
    // Set callbacks immediately
    setStreamCallback(handleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 Cleaning up WebRTC callbacks');
    };
  }, [sessionId, handleParticipantStream, handleParticipantJoin]);

  // Initialize placeholder participants
  useEffect(() => {
    if (participantList.length === 0) {
      console.log('🎭 Initializing placeholder participants');
      const initialParticipants = Array(4).fill(0).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `Participante ${i + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      }));
      setParticipantList(initialParticipants);
    }
  }, [participantList.length, setParticipantList]);

  // Monitor stream changes and update videos immediately
  useEffect(() => {
    console.log('🔍 Monitoring participant streams:', Object.keys(participantStreams).length);
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant && participant.active) {
        console.log(`📹 Ensuring video display for active participant: ${participantId}`);
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
      }
    });
  }, [participantList, participantStreams, transmissionWindowRef, updateVideoElementsImmediately]);

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream
  };
};
