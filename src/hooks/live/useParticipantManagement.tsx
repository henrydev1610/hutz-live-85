
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useCleanStreamManagement } from './useCleanStreamManagement';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
// REMOVIDO: import { useAutoHandshake } from './useAutoHandshake';
import { useWebRTCBridge } from './useWebRTCBridge';
import { useWebRTCDebugLogger } from './useWebRTCDebugLogger';
import { useWebRTCConnectionBridge } from './useWebRTCConnectionBridge';
import { useWebRTCAutoRetry } from './useWebRTCAutoRetry';
import { useConnectionHealthMonitor } from './useConnectionHealthMonitor';
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
  isHost?: boolean;
}

export const useParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants,
  isHost = false
}: UseParticipantManagementProps) => {
  const { updateVideoElementsImmediately } = useVideoElementManagement();
  
  // SISTEMA ÚNICO: Apenas useWebRTCConnectionBridge para desktop
  const { debugConnectionBridge } = useWebRTCConnectionBridge({
    participantStreams,
    setParticipantStreams,
    setParticipantList
  });

  const { debugAutoRetry, forceRetry, scheduleRetry } = useWebRTCAutoRetry({
    sessionId,
    participantStreams,
    participantList
  });

  // ETAPA 4: Monitor de saúde da conexão
  const { getConnectionHealth, forceConnectionRecovery, checkConnectionHealth } = useConnectionHealthMonitor({
    sessionId,
    participantStreams,
    participantList,
    isHost
  });
  
  // DEBUG LOGGER: Monitoramento WebRTC
  const { debugCurrentState } = useWebRTCDebugLogger();
  
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

  // REMOVIDO: Auto-handshake conflitante - Host só responde, nunca inicia

  // SIMPLIFICADO: Stream handler direto sem camadas extras
  const handleParticipantStreamDirect = async (participantId: string, stream: MediaStream) => {
    console.log(`📹 DIRETO: Stream recebido ${participantId}`);
    
    // Processar diretamente com handleParticipantStream original
    await handleParticipantStream(participantId, stream);
    
    // Update transmission sem delay
    updateTransmissionParticipants();
  };

  // ✅ CORREÇÃO: Sistema unificado de callbacks WebRTC sem duplicação
  useEffect(() => {
    if (!isHost) return;
    
    console.log('🎯 HOST: Setting up unified WebRTC system');
    
    // Single unified callback for receiving participant streams
    setStreamCallback((participantId: string, stream: MediaStream) => {
      console.log('🎬 HOST: Unified stream callback received:', participantId, stream.id);
      handleParticipantStreamDirect(participantId, stream);
    });

    // Single callback to handle participant joining
    setParticipantJoinCallback((participantData: any) => {
      console.log('👤 HOST: Unified participant join callback:', participantData);
      
      const participant = {
        ...participantData,
        selected: false,
        hasVideo: false,
        active: false
      };

      setParticipantList(prev => {
        const existingIndex = prev.findIndex(p => p.id === participant.id);
        if (existingIndex >= 0) {
          console.log('🔄 HOST: Updating existing participant:', participant.id);
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...participant };
          return updated;
        } else {
          console.log('➕ HOST: Adding new participant:', participant.id);
          return [...prev, participant];
        }
      });
    });

    // Listen for participant discovery and request offers
    const handleParticipantDiscovered = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { participantId } = customEvent.detail;
      
      console.log('🔍 HOST: Participant discovered:', participantId);
      
      // Request offer from discovered participant
      import('@/webrtc/handshake/HostHandshake').then(({ requestOfferFromParticipant }) => {
        console.log('📞 HOST: Requesting offer from participant:', participantId);
        requestOfferFromParticipant(participantId);
      });
    };

    // Set up global access for participant stream retrieval (single instance)
    window.getParticipantStream = (participantId: string) => {
      const stream = participantStreams[participantId];
      console.log('📥 HOST: getParticipantStream requested for:', participantId, stream ? stream.id : 'not found');
      return stream;
    };

    window.addEventListener('participant-discovered', handleParticipantDiscovered);

    return () => {
      console.log('🧹 HOST: Cleaning up unified WebRTC system');
      setStreamCallback(() => {});
      setParticipantJoinCallback(() => {});
      delete window.getParticipantStream;
      window.removeEventListener('participant-discovered', handleParticipantDiscovered);
    };
  }, [isHost, handleParticipantStreamDirect, setParticipantList, participantStreams]);

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
        handleParticipantStreamDirect(testParticipant.id, stream);
        
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
    handleParticipantStream: handleParticipantStreamDirect,
    testConnection,
    transferStreamToTransmission,
    
    // FASE 3 & 4: Novos métodos de debug e controle
    debugConnectionBridge,
    debugAutoRetry,
    forceRetry,
    scheduleRetry,
    
    // ETAPA 4: Health monitoring
    getConnectionHealth,
    forceConnectionRecovery,
    checkConnectionHealth
  };
};
