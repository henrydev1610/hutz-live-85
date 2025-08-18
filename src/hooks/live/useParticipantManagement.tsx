
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

  // ETAPA 1: Registrar window.hostStreamCallback ANTES de qualquer setup WebRTC
  useEffect(() => {
    if (isHost && typeof window !== 'undefined') {
      console.log('HOST-CALLBACK-REGISTERED');
      
      // CRÍTICO: Inicializar registro de streams global como Map (consistente)
      if (!window.__mlStreams__) {
        window.__mlStreams__ = new Map();
      }
      console.log(`[HOST-CALLBACK-REGISTERED] __mlStreams__ initialized as Map, size=${window.__mlStreams__.size}`);
      
      // CALLBACK ÚNICO: Sem duplicação de processamento
      window.hostStreamCallback = (participantId: string, stream: MediaStream) => {
        console.log(`🎯 HOST-ÚNICO: ${participantId} stream=${stream.id}`);
        
        // Registrar stream
        window.__mlStreams__.set(participantId, stream);
        
        // Processar uma única vez
        handleParticipantStreamDirect(participantId, stream);
      };
      
      // Getter para popup acessar o stream (Map)
      window.getParticipantStream = (participantId: string) => {
        const stream = window.__mlStreams__?.get(participantId) ?? null;
        console.log(`[HOST-BRIDGE] getParticipantStream participantId=${participantId} found=${!!stream} mapSize=${window.__mlStreams__?.size || 0}`);
        return stream;
      };
      
      console.log('[HOST-CALLBACK-REGISTERED] Registration complete - callback will survive page lifecycle');
    }
  }, [isHost]);

  // ETAPA 3: Lidar com detecção de participantes e solicitar offer IMEDIATAMENTE
  useEffect(() => {
    if (!isHost) return;

    const handleParticipantDiscovered = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log('🔍 DETECÇÃO: Participante descoberto:', participantId);
      
      // ETAPA 3: Solicitar offer IMEDIATAMENTE
      setTimeout(() => {
        console.log('🚀 CRÍTICO: Solicitando offer do participante:', participantId);
        
        // Importar e usar HostHandshake
        import('@/webrtc/handshake/HostHandshake').then(({ requestOfferFromParticipant }) => {
          requestOfferFromParticipant(participantId);
        });
      }, 100); // Delay mínimo de 100ms
    };

    window.addEventListener('participant-discovered', handleParticipantDiscovered as EventListener);
    
    return () => {
      window.removeEventListener('participant-discovered', handleParticipantDiscovered as EventListener);
    };
  }, [isHost]);

  // Set up WebRTC callbacks APÓS o registro da ponte
  useEffect(() => {
    if (sessionId) {
      // 🚀 CORREÇÃO CRÍTICA: Registrar callbacks apenas uma vez por sessionId
      console.log('🔄 Configurando callbacks WebRTC para sessão:', sessionId);
      
      const streamCallback = (participantId: string, stream: MediaStream) => {
        console.log('🎥 Stream recebido do participante:', participantId);
        setParticipantStreams(prev => {
          if (prev[participantId]) {
            console.log('⚠️ Stream já existe para participante:', participantId);
            return prev;
          }
          return { ...prev, [participantId]: stream };
        });
        updateTransmissionParticipants();
      };

      const joinCallback = (participantId: string) => {
        console.log('👤 Participante entrou na sessão:', participantId);
        const newParticipant: Participant = {
          id: participantId,
          name: `Participante ${participantId.slice(-4)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: false,
          hasVideo: false,
          isMobile: false
        };

        setParticipantList(prev => {
          const existing = prev.find(p => p.id === participantId);
          if (existing) {
            console.log('⚠️ Participante já existe na lista:', participantId);
            return prev;
          }
          return [...prev, newParticipant];
        });
      };

      setStreamCallback(streamCallback);
      setParticipantJoinCallback(joinCallback);
      
      console.log('✅ Callbacks WebRTC configurados com sucesso');
    }
  }, [sessionId, updateTransmissionParticipants]);

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
