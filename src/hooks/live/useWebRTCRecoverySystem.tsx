// FASE 5: Sistema de Recuperação Automática para WebRTC
import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface RecoveryMetrics {
  videoElementsWithSrc: number;
  activeStreamElements: number;
  streamContainers: number;
  webrtcState: string;
  lastRecoveryAttempt: number;
  recoveryAttempts: number;
}

interface UseWebRTCRecoverySystemProps {
  isActive: boolean;
  onRecoveryNeeded: () => void;
  onForceReset: () => void;
}

export const useWebRTCRecoverySystem = ({
  isActive,
  onRecoveryNeeded,
  onForceReset
}: UseWebRTCRecoverySystemProps) => {
  const metricsRef = useRef<RecoveryMetrics>({
    videoElementsWithSrc: 0,
    activeStreamElements: 0,
    streamContainers: 0,
    webrtcState: 'disconnected',
    lastRecoveryAttempt: 0,
    recoveryAttempts: 0
  });
  
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckStateCountRef = useRef(0);

  // FASE 5: Coletar métricas do DOM e WebRTC
  const collectMetrics = useCallback((): RecoveryMetrics => {
    const videoElements = document.querySelectorAll('video');
    const videoElementsWithSrc = Array.from(videoElements).filter(v => v.srcObject).length;
    const activeStreamElements = Array.from(videoElements).filter(v => 
      v.srcObject && (v.srcObject as MediaStream).active
    ).length;
    const streamContainers = document.querySelectorAll('[id*="participant-video"]').length;
    
    // Verificar estado WebRTC global
    let webrtcState = 'disconnected';
    if (typeof window !== 'undefined') {
      const livePageDebug = (window as any).__livePageDebug;
      if (livePageDebug) {
        try {
          const connectionState = livePageDebug.getConnectionState?.();
          webrtcState = connectionState?.webrtc || 'unknown';
        } catch (error) {
          console.warn('⚠️ RECOVERY: Could not get WebRTC state:', error);
        }
      }
    }

    return {
      videoElementsWithSrc,
      activeStreamElements,
      streamContainers,
      webrtcState,
      lastRecoveryAttempt: metricsRef.current.lastRecoveryAttempt,
      recoveryAttempts: metricsRef.current.recoveryAttempts
    };
  }, []);

  // FASE 5: Detectar problemas que requerem recuperação
  const detectRecoveryNeeded = useCallback((metrics: RecoveryMetrics): boolean => {
    const now = Date.now();
    const timeSinceLastRecovery = now - metrics.lastRecoveryAttempt;
    
    // Não tentar recovery muito frequentemente
    if (timeSinceLastRecovery < 10000) { // 10s cooldown
      return false;
    }

    // PROBLEMA 1: Video elements sem srcObject por muito tempo
    const hasVideoContainers = metrics.streamContainers > 0;
    const hasNoVideoSrc = metrics.videoElementsWithSrc === 0;
    const isWebRTCStuck = metrics.webrtcState === 'connecting';
    
    if (hasVideoContainers && hasNoVideoSrc && isWebRTCStuck) {
      stuckStateCountRef.current++;
      console.warn(`🚨 RECOVERY: Stuck state detected (${stuckStateCountRef.current}/3):`, {
        containers: metrics.streamContainers,
        videoWithSrc: metrics.videoElementsWithSrc,
        webrtcState: metrics.webrtcState
      });
      
      // Trigger recovery após 3 detecções consecutivas (30s total)
      return stuckStateCountRef.current >= 3;
    }

    // PROBLEMA 2: WebRTC stuck em "connecting" por muito tempo
    if (isWebRTCStuck && timeSinceLastRecovery > 30000) { // 30s
      console.warn('🚨 RECOVERY: WebRTC stuck in connecting state for 30s');
      return true;
    }

    // Reset counter se situação melhorar
    if (metrics.videoElementsWithSrc > 0 || metrics.webrtcState === 'connected') {
      stuckStateCountRef.current = 0;
    }

    return false;
  }, []);

  // FASE 5: Executar recuperação gradual
  const executeRecovery = useCallback(async (metrics: RecoveryMetrics) => {
    const now = Date.now();
    const recoveryAttempt = metrics.recoveryAttempts + 1;
    
    console.log(`🔄 RECOVERY: Attempting recovery #${recoveryAttempt}`, metrics);
    
    metricsRef.current = {
      ...metrics,
      lastRecoveryAttempt: now,
      recoveryAttempts: recoveryAttempt
    };
    
    if (recoveryAttempt <= 2) {
      // TENTATIVAS 1-2: Recovery suave
      console.log('🔄 RECOVERY: Soft recovery - triggering stream refresh');
      toast.info('🔄 Tentando reconectar vídeo...', { duration: 3000 });
      onRecoveryNeeded();
      
    } else if (recoveryAttempt <= 4) {
      // TENTATIVAS 3-4: Recovery mais agressivo
      console.log('🔥 RECOVERY: Aggressive recovery - force reset');
      toast.warning('🔥 Forçando reset da conexão...', { duration: 4000 });
      onForceReset();
      
    } else {
      // TENTATIVA 5+: Reset completo
      console.log('🚨 RECOVERY: Complete reset - clearing everything');
      toast.error('🚨 Reset completo necessário - recarregue se persistir', { duration: 6000 });
      
      // Reset completo do sistema
      onForceReset();
      
      // Após múltiplas falhas, reduzir frequência de tentativas
      metricsRef.current.lastRecoveryAttempt = now + 30000; // +30s cooldown extra
    }
    
    stuckStateCountRef.current = 0; // Reset counter após recovery
  }, [onRecoveryNeeded, onForceReset]);

  // FASE 5: Loop principal de monitoramento
  const startRecoveryMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }

    console.log('🔍 RECOVERY: Starting monitoring system');
    
    monitoringIntervalRef.current = setInterval(() => {
      if (!isActive) return;
      
      try {
        const metrics = collectMetrics();
        
        // Log detalhado a cada 30s
        if (Date.now() % 30000 < 10000) { // Log aproximadamente a cada 30s
          console.log('📊 RECOVERY METRICS:', {
            videoWithSrc: metrics.videoElementsWithSrc,
            activeStreams: metrics.activeStreamElements,
            containers: metrics.streamContainers,
            webrtcState: metrics.webrtcState,
            recoveryAttempts: metrics.recoveryAttempts,
            stuckCount: stuckStateCountRef.current
          });
        }
        
        // Verificar se recovery é necessário
        if (detectRecoveryNeeded(metrics)) {
          executeRecovery(metrics);
        }
        
        metricsRef.current = { ...metricsRef.current, ...metrics };
      } catch (error) {
        console.error('❌ RECOVERY: Error during monitoring:', error);
      }
    }, 10000); // Check every 10 seconds
  }, [isActive, collectMetrics, detectRecoveryNeeded, executeRecovery]);

  const stopRecoveryMonitoring = useCallback(() => {
    console.log('🔍 RECOVERY: Stopping monitoring system');
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    stuckStateCountRef.current = 0;
  }, []);

  const forceRecovery = useCallback(() => {
    console.log('🔄 RECOVERY: Force recovery requested by user');
    const metrics = collectMetrics();
    executeRecovery(metrics);
  }, [collectMetrics, executeRecovery]);

  const getRecoveryStatus = useCallback(() => {
    return {
      isMonitoring: !!monitoringIntervalRef.current,
      metrics: metricsRef.current,
      stuckStateCount: stuckStateCountRef.current
    };
  }, []);

  // Auto-start/stop monitoring based on isActive
  useEffect(() => {
    if (isActive) {
      startRecoveryMonitoring();
    } else {
      stopRecoveryMonitoring();
    }

    return () => {
      stopRecoveryMonitoring();
    };
  }, [isActive, startRecoveryMonitoring, stopRecoveryMonitoring]);

  return {
    startRecoveryMonitoring,
    stopRecoveryMonitoring,
    forceRecovery,
    getRecoveryStatus
  };
};