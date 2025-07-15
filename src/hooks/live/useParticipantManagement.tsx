
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

  // REMOVED: Legacy WebRTC callbacks - now handled by UnifiedWebRTCManager
  // The callbacks are now set up in useLivePageEffects through UnifiedWebRTCManager
  useEffect(() => {
    console.log('🔧 UNIFIED: WebRTC callbacks handled by UnifiedWebRTCManager');
    
    // No longer setting callbacks here - they're handled by UnifiedWebRTCManager
    // in useLivePageEffects for consistency and to avoid conflicts
    
    return () => {
      console.log('🧹 UNIFIED: Cleanup handled by UnifiedWebRTCManager');
    };
  }, [sessionId]);

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
    
    // HOST: Test connection without using local camera
    const testStream = new MediaStream();
    console.log('✅ Test connection initiated for:', testParticipant.id);
    
    handleParticipantStream(testParticipant.id, testStream);
        
    setTimeout(() => {
      testStream.getTracks().forEach(track => track.stop());
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
