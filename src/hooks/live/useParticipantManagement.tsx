
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useCleanStreamManagement } from './useCleanStreamManagement';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { clearConnectionCache } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

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
  
  // Use clean stream management with enhanced error handling
  const { handleParticipantStream } = useCleanStreamManagement({
    setParticipantStreams,
    setParticipantList,
    updateVideoElementsImmediately,
    transmissionWindowRef
  });

  const { 
    handleParticipantJoin: originalHandleParticipantJoin,
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

  // CORREÇÃO: Participant join simples sem auto-handshake
  const handleParticipantJoin = async (participantId: string, participantInfo?: any) => {
    console.log('👤 MANAGEMENT: Handling participant join for:', participantId);
    
    // Call original handler only
    originalHandleParticipantJoin(participantId);
    
    // CORREÇÃO: Removido auto-handshake para evitar loops
    console.log('✅ MANAGEMENT: Participant joined without auto-handshake');
  };

  const { transferStreamToTransmission } = useParticipantAutoSelection({
    participantList,
    setParticipantList,
    participantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // Enhanced stream handling with retry and cache busting
  const enhancedHandleParticipantStream = async (participantId: string, stream: MediaStream) => {
    console.log('🔄 ENHANCED STREAM HANDLER: Processing stream for:', participantId);
    
    try {
      // Clear any stale cache that might interfere
      if (performance.now() % 10000 < 100) { // Occasionally clear cache
        console.log('🧹 ENHANCED STREAM HANDLER: Periodic cache cleanup');
        clearConnectionCache();
        clearDeviceCache();
      }
      
      await handleParticipantStream(participantId, stream);
      
      // Immediate transmission update
      setTimeout(() => {
        console.log('📡 ENHANCED STREAM HANDLER: Triggering transmission update');
        updateTransmissionParticipants();
      }, 100);
      
    } catch (error) {
      console.error('❌ ENHANCED STREAM HANDLER: Error processing stream:', error);
      
      // Retry with cache clear
      try {
        console.log('🔄 ENHANCED STREAM HANDLER: Retrying with cache clear');
        clearConnectionCache();
        clearDeviceCache();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await handleParticipantStream(participantId, stream);
      } catch (retryError) {
        console.error('❌ ENHANCED STREAM HANDLER: Retry failed:', retryError);
      }
    }
  };

  // Set up WebRTC callbacks with cache clearing
  useEffect(() => {
    console.log('🔧 ENHANCED MANAGEMENT: Setting up WebRTC callbacks with cache management');
    
    // Clear cache on session change
    if (sessionId) {
      console.log('🧹 ENHANCED MANAGEMENT: Clearing cache for new session');
      clearConnectionCache();
      clearDeviceCache();
    }
    
    setStreamCallback(enhancedHandleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 ENHANCED MANAGEMENT: Cleaning up WebRTC callbacks');
    };
  }, [sessionId, handleParticipantJoin]);

  const testConnection = () => {
    console.log('🧪 ENHANCED MANAGEMENT: Testing connection with cache clearing...');
    
    // Clear all cache before test
    clearConnectionCache();
    clearDeviceCache();
    
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Participante Teste',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: true,
      hasVideo: false,
      isMobile: false
    };
    
    setParticipantList(prev => {
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        console.log('✅ ENHANCED MANAGEMENT: Test stream obtained');
        enhancedHandleParticipantStream(testParticipant.id, stream);
        
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
          setParticipantStreams(prev => {
            const updated = { ...prev };
            delete updated[testParticipant.id];
            return updated;
          });
        }, 10000);
      })
      .catch(err => {
        console.error('❌ ENHANCED MANAGEMENT: Test connection failed:', err);
      });
  };

  return {
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream: enhancedHandleParticipantStream,
    testConnection,
    transferStreamToTransmission
  };
};
