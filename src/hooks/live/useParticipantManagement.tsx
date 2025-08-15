
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { hostWebRTCManager } from '@/utils/webrtc/HostWebRTCManager';
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
  
  // FASE 4: Sistema simplificado - apenas gerenciar lista de participantes

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

  const { transferStreamToTransmission } = useParticipantAutoSelection({
    participantList,
    setParticipantList,
    participantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // FASE 4: Simplified participant join - apenas gerenciar lista
  const handleParticipantJoin = (participantId: string) => {
    console.log('👤 SIMPLIFIED: Participant join para:', participantId);
    originalHandleParticipantJoin(participantId);
  };

  // FASE 4: Simplified stream handler - direto
  const handleParticipantStream = (participantId: string, stream: MediaStream) => {
    console.log('📹 SIMPLIFIED: Stream recebido para:', participantId);
    
    // Update participant streams directly
    setParticipantStreams(prev => ({ ...prev, [participantId]: stream }));
    
    // Update participant list to mark as having video
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (!exists) {
        return [...prev, {
          id: participantId,
          name: `Mobile-${participantId.slice(-4)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: prev.length === 0,
          hasVideo: true,
          isMobile: true
        }];
      }
      return prev.map(p => 
        p.id === participantId 
          ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
          : p
      );
    });

    // Update transmission
    updateTransmissionParticipants();
  };

  // FASE 4: Initialize Host WebRTC Manager
  useEffect(() => {
    if (isHost && sessionId) {
      console.log('🖥️ FASE 4: Inicializando Host WebRTC Manager para:', sessionId);
      
      hostWebRTCManager.initializeAsHost(sessionId)
        .then(() => {
          console.log('✅ FASE 4: Host WebRTC Manager inicializado com sucesso');
        })
        .catch((error) => {
          console.error('❌ FASE 4: Falha ao inicializar Host WebRTC Manager:', error);
        });

      // Setup global stream callback for transmission window
      if (typeof window !== 'undefined') {
        if (!window.__mlStreams__) {
          window.__mlStreams__ = new Map();
        }
        
        window.hostStreamCallback = (participantId: string, stream: MediaStream) => {
          console.log('🎯 HOST-CALLBACK: Stream recebido para:', participantId);
          window.__mlStreams__.set(participantId, stream);
          handleParticipantStream(participantId, stream);
        };
        
        window.getParticipantStream = (participantId: string) => {
          return window.__mlStreams__?.get(participantId) ?? null;
        };
      }
    }

    return () => {
      if (isHost) {
        console.log('🧹 FASE 4: Limpando Host WebRTC Manager');
        hostWebRTCManager.cleanup();
      }
    };
  }, [isHost, sessionId]);

  // FASE 4: Listen for video stream events from HostWebRTCManager
  useEffect(() => {
    if (!isHost) return;

    const handleVideoStreamReady = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🎥 FASE 4: Video stream pronto de:', participantId);
      
      if (participantId && stream) {
        handleParticipantStream(participantId, stream);
      }
    };

    window.addEventListener('video-stream-ready', handleVideoStreamReady as EventListener);
    
    return () => {
      window.removeEventListener('video-stream-ready', handleVideoStreamReady as EventListener);
    };
  }, [isHost]);

  // FASE 4: Cache management only
  useEffect(() => {
    if (sessionId) {
      console.log('🧹 FASE 4: Limpando cache para nova sessão:', sessionId);
      clearConnectionCache();
      clearDeviceCache();
    }
  }, [sessionId]);

  const testConnection = () => {
    console.log('🧪 FASE 4: Testing connection...');
    
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
        console.log('✅ FASE 4: Test stream obtained');
        handleParticipantStream(testParticipant.id, stream);
        
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
          setParticipantStreams(prev => {
            const updated = { ...prev };
            delete updated[testParticipant.id];
            return updated;
          });
        }, 5000);
      })
      .catch(err => {
        console.error('❌ FASE 4: Test connection failed:', err);
      });
  };

  return {
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream,
    testConnection,
    transferStreamToTransmission
  };
};
