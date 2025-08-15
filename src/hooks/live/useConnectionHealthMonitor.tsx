import { useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface ConnectionHealth {
  webrtcReady: boolean;
  participantConnected: boolean;
  streamActive: boolean;
  lastActivity: number;
  quality: 'good' | 'poor' | 'failed';
}

interface UseConnectionHealthMonitorProps {
  sessionId: string | null;
  participantStreams: { [id: string]: MediaStream };
  participantList: any[];
  isHost?: boolean;
}

export const useConnectionHealthMonitor = ({
  sessionId,
  participantStreams,
  participantList,
  isHost = false
}: UseConnectionHealthMonitorProps) => {
  const healthRef = useRef<ConnectionHealth>({
    webrtcReady: false,
    participantConnected: false,
    streamActive: false,
    lastActivity: Date.now(),
    quality: 'good'
  });
  
  const monitorInterval = useRef<NodeJS.Timeout | null>(null);
  const failureCount = useRef(0);

  // ETAPA 4: Monitor de saúde da conexão
  const checkConnectionHealth = useCallback(() => {
    const health = healthRef.current;
    const now = Date.now();
    
    // Verificar participantes conectados
    const hasParticipants = participantList.length > 0;
    const hasActiveStreams = Object.keys(participantStreams).length > 0;
    const timeSinceLastActivity = now - health.lastActivity;
    
    // Atualizar métricas
    health.participantConnected = hasParticipants;
    health.streamActive = hasActiveStreams;
    
    // Determinar qualidade da conexão
    if (hasParticipants && hasActiveStreams && timeSinceLastActivity < 30000) {
      health.quality = 'good';
      failureCount.current = 0;
    } else if (hasParticipants && timeSinceLastActivity < 60000) {
      health.quality = 'poor';
      failureCount.current++;
    } else {
      health.quality = 'failed';
      failureCount.current++;
    }
    
    // Alertas de saúde
    if (isHost) {
      if (health.quality === 'failed' && failureCount.current >= 3) {
        toast({
          title: "⚠️ Problema de Conexão",
          description: "Nenhum participante conectado há mais de 1 minuto",
          variant: "destructive"
        });
      } else if (health.quality === 'poor' && failureCount.current >= 2) {
        toast({
          title: "📶 Conexão Instável",
          description: "Participante conectado mas sem stream ativo",
          variant: "destructive"
        });
      }
    }
    
    // Log detalhado a cada 30s
    if (now % 30000 < 5000) {
      console.log('📊 HEALTH MONITOR:', {
        quality: health.quality,
        participantConnected: health.participantConnected,
        streamActive: health.streamActive,
        timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000) + 's',
        failureCount: failureCount.current,
        participantCount: participantList.length,
        streamCount: Object.keys(participantStreams).length
      });
    }
    
    return health;
  }, [participantStreams, participantList, isHost]);

  // ETAPA 4: Forçar recovery em caso de falha
  const forceConnectionRecovery = useCallback(() => {
    console.log('🔄 HEALTH MONITOR: Forçando recovery da conexão');
    
    // Limpar estados
    failureCount.current = 0;
    healthRef.current.lastActivity = Date.now();
    
    // Disparar evento de recovery
    window.dispatchEvent(new CustomEvent('force-connection-recovery', {
      detail: { timestamp: Date.now(), reason: 'health-monitor' }
    }));
    
    toast({
      title: "🔄 Tentando Reconectar",
      description: "Forçando recovery da conexão WebRTC",
    });
  }, []);

  // Atualizar atividade quando streams mudam
  useEffect(() => {
    if (Object.keys(participantStreams).length > 0) {
      healthRef.current.lastActivity = Date.now();
    }
  }, [participantStreams]);

  // FASE 3: Iniciar monitoramento apenas quando WebRTC está pronto
  useEffect(() => {
    if (!sessionId) return;
    
    // Verificar se WebRTC manager existe antes de iniciar monitoramento
    import('@/utils/webrtc').then(({ getWebRTCManager }) => {
      const manager = getWebRTCManager();
      
      if (!manager) {
        console.log('🩺 HEALTH MONITOR: Aguardando WebRTC manager...');
        // Retry em 2s se manager não estiver pronto
        const retryTimeout = setTimeout(() => {
          const managerRetry = getWebRTCManager();
          if (managerRetry) {
            console.log('🩺 HEALTH MONITOR: WebRTC manager detectado, iniciando monitoramento');
            startMonitoring();
          } else {
            console.log('🩺 HEALTH MONITOR: WebRTC manager ainda não disponível, aguardando...');
          }
        }, 2000);
        
        return () => clearTimeout(retryTimeout);
      } else {
        console.log('🩺 HEALTH MONITOR: WebRTC manager disponível, iniciando monitoramento');
        startMonitoring();
      }
    });
    
    function startMonitoring() {
      monitorInterval.current = setInterval(() => {
        checkConnectionHealth();
      }, 10000); // Check a cada 10s
    }
    
    return () => {
      if (monitorInterval.current) {
        clearInterval(monitorInterval.current);
      }
    };
  }, [sessionId, checkConnectionHealth]);

  return {
    getConnectionHealth: () => healthRef.current,
    forceConnectionRecovery,
    checkConnectionHealth
  };
};