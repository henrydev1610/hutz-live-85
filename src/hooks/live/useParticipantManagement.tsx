
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

  // ✅ ETAPA 2: REMOVIDO handleParticipantStreamDirect - streams vão direto para StreamDisplayManager
  // ❌ CALLBACK DUPLICADO REMOVIDO - apenas eventos centralizados

  // ✅ ETAPA 2: SISTEMA UNIFICADO SEM CALLBACKS DUPLICADOS
  useEffect(() => {
    if (!isHost) return;
    
    console.log('🎯 HOST: Setting up UNIFIED WebRTC system (NO DUPLICATES)');
    
    // ❌ REMOVIDO: setStreamCallback duplicado - streams serão processados via eventos
    // ❌ REMOVIDO: handleParticipantStreamDirect duplicado
    
    // ✅ APENAS callback para participant joining (sem stream processing)
    setParticipantJoinCallback((participantData: any) => {
      console.log('👤 HOST: Participant join callback (UNIFIED):', participantData);
      
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

    // Initialize global streams map if it doesn't exist
    if (!window.__mlStreams__) {
      window.__mlStreams__ = new Map<string, MediaStream>();
      console.log('🗺️ HOST: Initialized global streams map');
    }

    // Set up global access for participant stream retrieval (single instance)
    window.getParticipantStream = (participantId: string) => {
      // Tentar múltiplas fontes de streams
      const streamFromState = participantStreams[participantId];
      const streamFromGlobalMap = window.__mlStreams__?.get(participantId);
      const stream = streamFromState || streamFromGlobalMap || null;
      
      console.log('📥 HOST: getParticipantStream requested for:', participantId, {
        foundInState: !!streamFromState,
        foundInGlobalMap: !!streamFromGlobalMap,
        finalStream: !!stream,
        streamId: stream?.id,
        streamActive: stream?.active,
        tracksCount: stream?.getTracks()?.length || 0,
        allStreamsInState: Object.keys(participantStreams),
        allStreamsInGlobalMap: Array.from(window.__mlStreams__?.keys() || [])
      });
      
      return stream;
    };

    window.addEventListener('participant-discovered', handleParticipantDiscovered);

    return () => {
      console.log('🧹 HOST: Cleaning up unified WebRTC system');
      setParticipantJoinCallback(() => {});
      delete window.getParticipantStream;
      if (window.__mlStreams__) {
        window.__mlStreams__.clear();
      }
      window.removeEventListener('participant-discovered', handleParticipantDiscovered);
    };
  }, [isHost, setParticipantList, participantStreams]);

  // Effect to register streams in global map when they change
  useEffect(() => {
    if (!isHost) return;
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      if (stream && window.__mlStreams__) {
        if (!window.__mlStreams__.has(participantId)) {
          window.__mlStreams__.set(participantId, stream);
          console.log('🗺️ HOST: Registered stream in global map:', participantId, stream.id);
        }
      }
    });

    // Clean up streams that are no longer in participantStreams
    if (window.__mlStreams__) {
      const currentParticipantIds = Object.keys(participantStreams);
      Array.from(window.__mlStreams__.keys()).forEach(participantId => {
        if (!currentParticipantIds.includes(participantId)) {
          window.__mlStreams__?.delete(participantId);
          console.log('🗺️ HOST: Removed stream from global map:', participantId);
        }
      });
    }
  }, [isHost, participantStreams]);

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
        handleParticipantStream(testParticipant.id, stream);
        
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
    handleParticipantStream,
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
