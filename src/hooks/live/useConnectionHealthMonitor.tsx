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

  // ETAPA 4: Monitor de saúde menos agressivo
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
    
    // Determinar qualidade da conexão com timings mais lenientes
    if (hasParticipants && hasActiveStreams && timeSinceLastActivity < 60000) { // Aumentado para 60s
      health.quality = 'good';
      failureCount.current = 0;
    } else if (hasParticipants && timeSinceLastActivity < 120000) { // Aumentado para 120s
      health.quality = 'poor';
      failureCount.current++;
    } else {
      health.quality = 'failed';
      failureCount.current++;
    }
    
    // Alertas de saúde menos agressivos
    if (isHost) {
      // Só alertar após falhas consistentes por mais tempo
      if (health.quality === 'failed' && failureCount.current >= 5) { // Aumentado threshold
        toast({
          title: "⚠️ Problema de Conexão",
          description: "Nenhum participante conectado há mais de 2 minutos",
          variant: "destructive"
        });
      } else if (health.quality === 'poor' && failureCount.current >= 4) { // Aumentado threshold
        toast({
          title: "📶 Conexão Instável",
          description: "Participante conectado mas sem stream ativo há mais de 1 minuto",
          variant: "destructive"
        });
      }
    }
    
    // Log detalhado menos frequente
    if (now % 60000 < 5000) { // A cada 60s em vez de 30s
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

  // Iniciar monitoramento
  useEffect(() => {
    if (!sessionId) return;
    
    console.log('🩺 HEALTH MONITOR: Iniciando monitoramento');
    
    monitorInterval.current = setInterval(() => {
      checkConnectionHealth();
    }, 30000); // Check a cada 30s (menos agressivo)
    
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