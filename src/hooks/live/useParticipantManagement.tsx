
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useParticipantStreams } from './useParticipantStreams';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { useParticipantStreamMonitoring } from './useParticipantStreamMonitoring';
import { useForceVideoDisplay } from './useForceVideoDisplay';

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

  const { transferStreamToTransmission } = useParticipantAutoSelection({
    participantList,
    setParticipantList,
    participantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  useParticipantStreamMonitoring({
    participantList,
    setParticipantList,
    participantStreams,
    transmissionWindowRef,
    updateVideoElementsImmediately,
    transferStreamToTransmission,
    sessionId
  });

  // EMERGENCY: Force video display hook
  useForceVideoDisplay({
    participantList,
    participantStreams
  });

  // Set up WebRTC callbacks immediately
  useEffect(() => {
    console.log('🔧 Setting up IMMEDIATE WebRTC callbacks');
    
    setStreamCallback(handleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 Cleaning up WebRTC callbacks');
    };
  }, [sessionId, handleParticipantStream, handleParticipantJoin]);

  const testConnection = () => {
    console.log('🧪 Testing WebRTC connection...');
    
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Participante Teste',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: true, // Auto-select test participant
      hasVideo: false
    };
    
    setParticipantList(prev => {
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    // Don't request camera from host - use placeholder for test
    console.log('✅ Test participant added without camera request');
    
    // Create a simple placeholder stream instead of requesting camera
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Test Participant', canvas.width / 2, canvas.height / 2);
    }
    
    const placeholderStream = canvas.captureStream(30);
    handleParticipantStream(testParticipant.id, placeholderStream);
    
    setTimeout(() => {
      placeholderStream.getTracks().forEach(track => track.stop());
      setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
      setParticipantStreams(prev => {
        const updated = { ...prev };
        delete updated[testParticipant.id];
        return updated;
      });
    }, 10000);
  };

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream,
    testConnection,
    transferStreamToTransmission
  };
};
