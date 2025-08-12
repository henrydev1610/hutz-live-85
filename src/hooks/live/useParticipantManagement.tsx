
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useCleanStreamManagement } from './useCleanStreamManagement';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { useAutoHandshake } from './useAutoHandshake';
import { useWebRTCBridge } from './useWebRTCBridge';
import { useWebRTCDebugLogger } from './useWebRTCDebugLogger';
import { useWebRTCConnectionBridge } from './useWebRTCConnectionBridge';
import { useWebRTCAutoRetry } from './useWebRTCAutoRetry';
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
  
  // CORREÇÃO CRÍTICA: Usar ponte WebRTC → React
  const { debugBridge } = useWebRTCBridge({
    participantStreams,
    setParticipantStreams,
    setParticipantList
  });

  // FASE 3 & 4: Novos hooks para correção completa
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

  // CORREÇÃO 3: Hook para auto-handshake do host
  useAutoHandshake({
    isHost,
    sessionId,
    onHandshakeRequest: (participantId: string) => {
      console.log('🤝 CRÍTICO: Iniciando handshake automático com', participantId);
      handleParticipantJoin(participantId);
    }
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

  // Set up WebRTC callbacks with cache clearing e debug
  useEffect(() => {
    console.log('🔧 WEBRTC DEBUG: ===== CONFIGURANDO CALLBACKS =====');
    console.log('🔧 WEBRTC DEBUG: SessionId:', sessionId);
    console.log('🔧 WEBRTC DEBUG: IsHost:', isHost);
    
    // FASE 5: Logs críticos de validação
    if (isHost) {
      console.log('✅ CRITICAL SUCCESS: Host role confirmed - IsHost: true');
    } else {
      console.log('❌ CRITICAL ERROR: Host role incorrect - IsHost: false');
    }
    
    // FASE 2: Implementar window.hostStreamCallback ANTES dos handlers WebRTC
    if (isHost && typeof window !== 'undefined') {
      console.log('📡 CRITICAL: Registering window.hostStreamCallback FIRST');
      window.hostStreamCallback = (participantId: string, stream: MediaStream) => {
        console.log('🎥 HOST CALLBACK: Stream received from participant:', participantId);
        // CORREÇÃO: Atualizar estado central diretamente  
        setParticipantStreams(prev => ({ ...prev, [participantId]: stream }));
        // Transferir para popup via hook existente
        transferStreamToTransmission(participantId, stream);
      };
      
      // FASE 3: Log critical validation
      import('@/utils/webrtc/ProtocolValidationLogger').then(({ ProtocolValidationLogger }) => {
        ProtocolValidationLogger.logHostCallbackRegistration(true);
        ProtocolValidationLogger.runFullValidation();
      });
    }
    
    // Clear cache on session change
    if (sessionId) {
      console.log('🧹 WEBRTC DEBUG: Limpando cache para nova sessão');
      clearConnectionCache();
      clearDeviceCache();
    }
    
    console.log('🔧 WEBRTC DEBUG: Registrando enhancedHandleParticipantStream');
    setStreamCallback(enhancedHandleParticipantStream);
    
    console.log('🔧 WEBRTC DEBUG: Registrando handleParticipantJoin');
    setParticipantJoinCallback(handleParticipantJoin);
    
    console.log('✅ WEBRTC DEBUG: Callbacks WebRTC registrados com sucesso');
    
    // Debug do estado atual
    debugCurrentState();
    
    return () => {
      console.log('🧹 WEBRTC DEBUG: Limpando callbacks WebRTC');
      if (typeof window !== 'undefined') {
        window.hostStreamCallback = undefined;
      }
    };
  }, [sessionId, handleParticipantJoin, debugCurrentState, isHost]);

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
    transferStreamToTransmission,
    
    // FASE 3 & 4: Novos métodos de debug e controle
    debugConnectionBridge,
    debugAutoRetry,
    forceRetry,
    scheduleRetry
  };
};
