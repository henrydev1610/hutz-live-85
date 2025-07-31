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
  const maxRetries = 5;

  const executeRetry = useCallback(async (participantId: string, strategy: 'soft' | 'hard' = 'soft') => {
    const currentAttempts = retryAttempts.current.get(participantId) || 0;
    
    if (currentAttempts >= maxRetries) {
      console.error(`❌ FASE 4: Max retries (${maxRetries}) atingido para ${participantId}`);
      return false;
    }

    retryAttempts.current.set(participantId, currentAttempts + 1);
    console.log(`🔄 FASE 4: Retry ${currentAttempts + 1}/${maxRetries} para ${participantId} (${strategy})`);

    try {
      if (strategy === 'hard') {
        // Hard retry: recriar conexão WebRTC completamente
        console.log(`🔥 FASE 4: Hard retry - recriando WebRTC para ${participantId}`);
        
        // Limpar estado existente
        const event = new CustomEvent('force-webrtc-reset', {
          detail: { participantId }
        });
        window.dispatchEvent(event);
        
        // Aguardar limpeza
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reinicializar
        const retryEvent = new CustomEvent('force-webrtc-reinit', {
          detail: { participantId, sessionId }
        });
        window.dispatchEvent(retryEvent);
        
      } else {
        // Soft retry: tentar reestabelecer conexão existente
        console.log(`🔄 FASE 4: Soft retry - reestabelecendo conexão para ${participantId}`);
        
        const retryEvent = new CustomEvent('force-webrtc-retry', {
          detail: { participantId }
        });
        window.dispatchEvent(retryEvent);
      }

      return true;
    } catch (error) {
      console.error(`❌ FASE 4: Erro no retry para ${participantId}:`, error);
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
    const hasStream = !!participantStreams[participantId];
    const participant = participantList.find(p => p.id === participantId);
    const isActive = participant?.active;

    console.log(`🔍 FASE 4: Monitorando ${participantId}:`, {
      hasStream,
      isActive,
      streamId: participantStreams[participantId]?.id
    });

    // Se participante está ativo mas não tem stream
    if (isActive && !hasStream) {
      const timeSinceJoin = participant?.joinedAt ? Date.now() - participant.joinedAt : 0;
      
      // Dar tempo para conexão normal (30 segundos)
      if (timeSinceJoin > 30000) {
        console.warn(`⚠️ FASE 4: Participante ${participantId} ativo há ${Math.round(timeSinceJoin/1000)}s sem stream`);
        scheduleRetry(participantId, 'soft', 2000);
      }
    }

    // Se stream existe mas está inativo
    if (hasStream) {
      const stream = participantStreams[participantId];
      const isStreamActive = stream.active && stream.getTracks().some(t => t.readyState === 'live');
      
      if (!isStreamActive) {
        console.warn(`⚠️ FASE 4: Stream ${stream.id} para ${participantId} está inativo`);
        scheduleRetry(participantId, 'hard', 5000);
      }
    }
  }, [participantStreams, participantList, scheduleRetry]);

  useEffect(() => {
    console.log('🤖 FASE 4: Configurando Auto-Retry System');

    // Monitor periódico de conexões
    const monitorInterval = setInterval(() => {
      participantList.forEach(participant => {
        if (participant.active) {
          monitorConnection(participant.id);
        }
      });
    }, 10000); // Verificar a cada 10 segundos

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