import { useState, useEffect, useCallback } from 'react';

type ParticipantStatus = 'waiting' | 'connecting' | 'connected' | 'with-video' | 'disconnected';

interface UseRealTimeStatusProps {
  participantId: string;
  hasVideo: boolean;
  active: boolean;
  stream?: MediaStream | null;
}

export const useRealTimeStatus = ({ 
  participantId, 
  hasVideo, 
  active, 
  stream 
}: UseRealTimeStatusProps) => {
  const [status, setStatus] = useState<ParticipantStatus>('waiting');
  const [connectionTime, setConnectionTime] = useState<number | null>(null);

  // FASE 5: STATUS VISUAL EM TEMPO REAL
  const updateStatus = useCallback((newStatus: ParticipantStatus) => {
    console.log(`📊 FASE 5: STATUS UPDATE - ${participantId} mudou para:`, newStatus);
    setStatus(newStatus);
    
    if (newStatus === 'connected' || newStatus === 'with-video') {
      setConnectionTime(Date.now());
    }
  }, [participantId]);

  // Monitorar mudanças de estado do participante
  useEffect(() => {
    if (!active) {
      updateStatus('waiting');
    } else if (active && !stream) {
      updateStatus('connecting');
    } else if (active && stream && !hasVideo) {
      updateStatus('connected');
    } else if (active && stream && hasVideo) {
      updateStatus('with-video');
    }
  }, [active, stream, hasVideo, updateStatus]);

  // Listener para eventos de conexão WebRTC
  useEffect(() => {
    const handleConnectionEvent = (event: CustomEvent) => {
      const { participantId: eventParticipantId, type } = event.detail;
      
      if (eventParticipantId === participantId) {
        switch (type) {
          case 'webrtc-connecting':
            updateStatus('connecting');
            break;
          case 'webrtc-connected':
            updateStatus('connected');
            break;
          case 'stream-ready':
            updateStatus('with-video');
            break;
          case 'webrtc-disconnected':
            updateStatus('disconnected');
            break;
        }
      }
    };

    window.addEventListener('participant-status-change', handleConnectionEvent as EventListener);
    
    return () => {
      window.removeEventListener('participant-status-change', handleConnectionEvent as EventListener);
    };
  }, [participantId, updateStatus]);

  // Heartbeat para manter status atualizado
  useEffect(() => {
    if (status === 'with-video' && stream) {
      const heartbeatInterval = setInterval(() => {
        // Verificar se o stream ainda está ativo
        if (!stream.active || stream.getTracks().length === 0) {
          updateStatus('disconnected');
        }
      }, 5000); // Check a cada 5 segundos

      return () => clearInterval(heartbeatInterval);
    }
  }, [status, stream, updateStatus]);

  const getStatusColor = () => {
    switch (status) {
      case 'waiting': return 'text-gray-400';
      case 'connecting': return 'text-yellow-400';
      case 'connected': return 'text-blue-400';
      case 'with-video': return 'text-green-400';
      case 'disconnected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'waiting': return 'Aguardando';
      case 'connecting': return 'Conectando...';
      case 'connected': return 'Conectado';
      case 'with-video': return 'Com Vídeo';
      case 'disconnected': return 'Desconectado';
      default: return 'Aguardando';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'waiting': return '⏳';
      case 'connecting': return '🔄';
      case 'connected': return '✅';
      case 'with-video': return '🎥';
      case 'disconnected': return '❌';
      default: return '⏳';
    }
  };

  return {
    status,
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    statusIcon: getStatusIcon(),
    connectionTime,
    isConnected: status === 'connected' || status === 'with-video',
    hasActiveVideo: status === 'with-video'
  };
};