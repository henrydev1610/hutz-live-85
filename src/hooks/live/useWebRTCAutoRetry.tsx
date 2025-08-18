import { useEffect, useCallback, useRef } from 'react';

interface UseWebRTCAutoRetryProps {
  sessionId: string | undefined;
  participantStreams: {[id: string]: MediaStream};
  participantList: any[];
}

/**
 * FASE 4: Hook para Auto-Retry Inteligente
 * Implementa retry automático quando conexões WebRTC falham
 */
export const useWebRTCAutoRetry = ({
  sessionId,
  participantStreams,
  participantList
}: UseWebRTCAutoRetryProps) => {
  const retryAttempts = useRef(new Map<string, number>());
  const retryTimeouts = useRef(new Map<string, NodeJS.Timeout>());
  const lastConnectionAttempt = useRef(new Map<string, number>());
  const circuitBreaker = useRef(new Map<string, boolean>());
  const maxRetries = 3; // Reduzido para evitar loops
  const GRACE_PERIOD = 45000; // 45s antes do primeiro retry

  const executeRetry = useCallback(async (participantId: string, strategy: 'soft' | 'hard' = 'soft') => {
    const currentAttempts = retryAttempts.current.get(participantId) || 0;
    const lastAttempt = lastConnectionAttempt.current.get(participantId) || 0;
    const now = Date.now();
    
    // Circuit breaker: bloquear se muitos retries
    if (circuitBreaker.current.get(participantId)) {
      console.warn(`🚫 RETRY BLOQUEADO: Circuit breaker ativo para ${participantId}`);
      return false;
    }
    
    // Grace period: aguardar antes do primeiro retry
    if (currentAttempts === 0 && (now - lastAttempt) < GRACE_PERIOD) {
      const remaining = Math.round((GRACE_PERIOD - (now - lastAttempt)) / 1000);
      console.log(`⏳ GRACE PERIOD: Aguardando ${remaining}s antes do retry para ${participantId}`);
      return false;
    }
    
    if (currentAttempts >= maxRetries) {
      console.error(`❌ AUTO-RETRY: Max retries (${maxRetries}) atingido para ${participantId} - ativando circuit breaker`);
      circuitBreaker.current.set(participantId, true);
      
      // Reset circuit breaker após 5 minutos
      setTimeout(() => {
        circuitBreaker.current.set(participantId, false);
        retryAttempts.current.set(participantId, 0);
        console.log(`🔄 CIRCUIT BREAKER: Reset para ${participantId} após 5min`);
      }, 300000);
      
      return false;
    }

    retryAttempts.current.set(participantId, currentAttempts + 1);
    console.log(`🔄 AUTO-RETRY: Tentativa ${currentAttempts + 1}/${maxRetries} para ${participantId} (${strategy})`);

    try {
      if (strategy === 'hard') {
        console.log(`🔥 AUTO-RETRY: Hard retry - reset completo para ${participantId}`);
        
        const event = new CustomEvent('force-webrtc-reset', {
          detail: { participantId }
        });
        window.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryEvent = new CustomEvent('force-webrtc-reinit', {
          detail: { participantId, sessionId }
        });
        window.dispatchEvent(retryEvent);
        
      } else {
        console.log(`🔄 AUTO-RETRY: Soft retry para ${participantId}`);
        
        const retryEvent = new CustomEvent('force-webrtc-retry', {
          detail: { participantId }
        });
        window.dispatchEvent(retryEvent);
      }

      return true;
    } catch (error) {
      console.error(`❌ AUTO-RETRY: Erro no retry para ${participantId}:`, error);
      return false;
    }
  }, [sessionId, maxRetries]);

  const scheduleRetry = useCallback((participantId: string, strategy: 'soft' | 'hard' = 'soft', delay: number = 3000) => {
    // Limpar timeout existente
    const existingTimeout = retryTimeouts.current.get(participantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    console.log(`⏰ FASE 4: Agendando ${strategy} retry para ${participantId} em ${delay}ms`);
    
    const timeout = setTimeout(() => {
      executeRetry(participantId, strategy);
      retryTimeouts.current.delete(participantId);
    }, delay);

    retryTimeouts.current.set(participantId, timeout);
  }, [executeRetry]);

  const monitorConnection = useCallback((participantId: string) => {
    // Skip monitoring se circuit breaker ativo
    if (circuitBreaker.current.get(participantId)) {
      return;
    }
    
    const hasStream = !!participantStreams[participantId];
    const participant = participantList.find(p => p.id === participantId);
    const isActive = participant?.active;
    const lastAttempt = lastConnectionAttempt.current.get(participantId) || 0;
    const timeSinceLastAttempt = Date.now() - lastAttempt;

    console.log(`🔍 AUTO-RETRY: Monitorando ${participantId}:`, {
      hasStream,
      isActive,
      timeSinceLastAttempt: Math.round(timeSinceLastAttempt/1000),
      gracePeriod: GRACE_PERIOD/1000,
      streamId: participantStreams[participantId]?.id
    });

    // Registrar tentativa de conexão inicial
    if (isActive && lastAttempt === 0) {
      lastConnectionAttempt.current.set(participantId, Date.now());
      console.log(`🎯 AUTO-RETRY: Registrando conexão inicial para ${participantId}`);
      return;
    }

    // Aguardar grace period antes de qualquer retry
    if (timeSinceLastAttempt < GRACE_PERIOD) {
      const remaining = Math.round((GRACE_PERIOD - timeSinceLastAttempt) / 1000);
      console.log(`⏳ AUTO-RETRY: Grace period ativo para ${participantId} (${remaining}s restantes)`);
      return;
    }

    // Se participante está ativo mas não tem stream após grace period
    if (isActive && !hasStream) {
      const timeSinceJoin = participant?.joinedAt ? Date.now() - participant.joinedAt : 0;
      
      if (timeSinceJoin > GRACE_PERIOD) {
        console.warn(`⚠️ AUTO-RETRY: ${participantId} sem stream após grace period`);
        scheduleRetry(participantId, 'soft', 5000);
      }
    }

    // Se stream existe mas está inativo
    if (hasStream) {
      const stream = participantStreams[participantId];
      const isStreamActive = stream.active && stream.getTracks().some(t => t.readyState === 'live');
      
      if (!isStreamActive) {
        console.warn(`⚠️ AUTO-RETRY: Stream inativo para ${participantId}`);
        scheduleRetry(participantId, 'hard', 10000);
      }
    }
  }, [participantStreams, participantList, scheduleRetry]);

  useEffect(() => {
    console.log('🤖 FASE 4: Configurando Auto-Retry System');

    // Monitor periódico menos agressivo
    const monitorInterval = setInterval(() => {
      participantList.forEach(participant => {
        if (participant.active) {
          monitorConnection(participant.id);
        }
      });
    }, 20000); // Verificar a cada 20 segundos (menos agressivo)

    // Listeners para falhas de conexão
    const handleConnectionFailure = (event: CustomEvent) => {
      const { participantId, state } = event.detail;
      if (state === 'failed') {
        console.error(`🚨 FASE 4: Conexão falhou para ${participantId}`);
        scheduleRetry(participantId, 'hard', 1000);
      }
    };

    const handleStreamMissing = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.error(`🚨 FASE 4: Stream ausente para ${participantId}`);
      scheduleRetry(participantId, 'soft', 2000);
    };

    const handleForceRetry = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log(`🔄 FASE 4: Retry forçado solicitado para ${participantId}`);
      executeRetry(participantId, 'soft');
    };

    // Registrar listeners
    window.addEventListener('webrtc-state-change', handleConnectionFailure as EventListener);
    window.addEventListener('stream-missing-error', handleStreamMissing as EventListener);
    window.addEventListener('force-webrtc-retry', handleForceRetry as EventListener);

    return () => {
      console.log('🧹 FASE 4: Limpando Auto-Retry System');
      clearInterval(monitorInterval);
      
      // Limpar todos os timeouts
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
      retryTimeouts.current.clear();
      retryAttempts.current.clear();
      
      // Remover listeners
      window.removeEventListener('webrtc-state-change', handleConnectionFailure as EventListener);
      window.removeEventListener('stream-missing-error', handleStreamMissing as EventListener);
      window.removeEventListener('force-webrtc-retry', handleForceRetry as EventListener);
    };
  }, [participantList, monitorConnection, scheduleRetry, executeRetry]);

  // Método para debug
  const debugAutoRetry = () => {
    console.log('🔍 FASE 4 DEBUG:', {
      retryAttempts: Array.from(retryAttempts.current.entries()),
      activeTimeouts: retryTimeouts.current.size,
      monitoredParticipants: participantList.filter(p => p.active).length
    });
  };

  return { 
    debugAutoRetry,
    forceRetry: executeRetry,
    scheduleRetry
  };
};