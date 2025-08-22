// FASE 1 & 2: Hook para inicialização WebRTC com diagnóstico TURN automático
import { useState, useEffect, useCallback } from 'react';
import { turnConnectivityService } from '@/services/TurnConnectivityService';
import { useWebRTCCircuitBreaker } from './useWebRTCCircuitBreaker';
import { initHostWebRTC, initParticipantWebRTC } from '@/utils/webrtc';
import { toast } from 'sonner';

interface WebRTCInitializationState {
  isInitializing: boolean;
  isReady: boolean;
  turnStatus: 'unknown' | 'healthy' | 'degraded' | 'failed';
  error: string | null;
  hasRunInitialDiagnostic: boolean;
}

interface UseWebRTCInitializationProps {
  sessionId: string;
  participantId?: string;
  isHost: boolean;
  stream?: MediaStream;
  autoInit?: boolean;
}

export const useWebRTCInitialization = ({
  sessionId,
  participantId,
  isHost,
  stream,
  autoInit = true
}: UseWebRTCInitializationProps) => {
  const [state, setState] = useState<WebRTCInitializationState>({
    isInitializing: false,
    isReady: false,
    turnStatus: 'unknown',
    error: null,
    hasRunInitialDiagnostic: false
  });

  const circuitBreaker = useWebRTCCircuitBreaker({
    failureThreshold: 2,    // FASE 2: Mais sensível a falhas
    recoveryTimeout: 8000,  // FASE 2: Recovery mais rápido
    connectionTimeout: 5000 // FASE 2: Timeout otimizado
  });

  // FASE 1: Diagnóstico TURN automático na inicialização
  const runTurnDiagnostic = useCallback(async () => {
    if (state.hasRunInitialDiagnostic) return;

    console.log('🧊 [INIT] Running automatic TURN diagnostic...');
    setState(prev => ({ ...prev, isInitializing: true }));

    try {
      const diagnostic = await turnConnectivityService.runDiagnostic(true);
      setState(prev => ({
        ...prev,
        turnStatus: diagnostic.overallHealth,
        hasRunInitialDiagnostic: true
      }));

      // FASE 1: Toast baseado no resultado
      if (diagnostic.overallHealth === 'failed') {
        toast.warning('⚠️ TURN servers não funcionando - conexões NAT podem falhar', { duration: 5000 });
      } else if (diagnostic.overallHealth === 'degraded') {
        toast.info(`⚠️ Apenas ${diagnostic.workingServers.length} servidores TURN funcionando`);
      } else {
        console.log('✅ [INIT] TURN servers healthy, proceeding with WebRTC init');
      }
    } catch (error) {
      console.error('🧊 [INIT] TURN diagnostic failed:', error);
      setState(prev => ({
        ...prev,
        turnStatus: 'failed',
        hasRunInitialDiagnostic: true,
        error: 'TURN diagnostic failed'
      }));
    }
  }, [state.hasRunInitialDiagnostic]);

  // FASE 2: Inicialização WebRTC com circuit breaker
  const initializeWebRTC = useCallback(async () => {
    if (!circuitBreaker.canAttemptConnection) {
      const waitTime = Math.ceil(circuitBreaker.timeUntilRetry / 1000);
      toast.error(`🚫 WebRTC bloqueado por ${waitTime}s devido a falhas repetidas`);
      return;
    }

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      await circuitBreaker.executeWithCircuitBreaker(async () => {
        console.log(`🚀 [INIT] Initializing WebRTC - Host: ${isHost}`);
        
        if (isHost) {
          const result = await initHostWebRTC(sessionId);
          return result.webrtc;
        } else {
          if (!participantId) throw new Error('Participant ID required');
          const result = await initParticipantWebRTC(sessionId, participantId, stream);
          return result.webrtc;
        }
      }, 'WebRTC Initialization');

      setState(prev => ({
        ...prev,
        isReady: true,
        isInitializing: false,
        error: null
      }));

      console.log('✅ [INIT] WebRTC initialized successfully');
      toast.success('✅ WebRTC conectado com sucesso');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [INIT] WebRTC initialization failed:', errorMessage);
      
      setState(prev => ({
        ...prev,
        isInitializing: false,
        isReady: false,
        error: errorMessage
      }));

      // FASE 2: Toast específico baseado no tipo de erro
      if (errorMessage.includes('timeout')) {
        toast.error('⏱️ WebRTC timeout - servidor TURN pode estar travado');
      } else if (errorMessage.includes('Circuit breaker')) {
        toast.error('🚫 WebRTC temporariamente bloqueado devido a falhas');
      } else {
        toast.error(`❌ Falha na conexão WebRTC: ${errorMessage}`);
      }
    }
  }, [sessionId, participantId, isHost, stream, circuitBreaker]);

  // FASE 1: Auto-inicialização com diagnóstico TURN
  useEffect(() => {
    if (autoInit && sessionId && !state.isReady && !state.isInitializing) {
      const initSequence = async () => {
        // FASE 1: Primeiro, diagnostic TURN
        await runTurnDiagnostic();
        
        // FASE 2: Depois, inicializar WebRTC com circuit breaker
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeno delay
        await initializeWebRTC();
      };

      initSequence();
    }
  }, [autoInit, sessionId, state.isReady, state.isInitializing, runTurnDiagnostic, initializeWebRTC]);

  // FASE 2: Force retry com reset do circuit breaker
  const forceRetry = useCallback(async () => {
    console.log('🔄 [INIT] Force retry requested');
    circuitBreaker.forceReset();
    setState(prev => ({
      ...prev,
      isReady: false,
      error: null,
      hasRunInitialDiagnostic: false
    }));
    
    // Re-run diagnostic and init
    await runTurnDiagnostic();
    await initializeWebRTC();
  }, [circuitBreaker.forceReset, runTurnDiagnostic, initializeWebRTC]);

  return {
    // Estado
    isInitializing: state.isInitializing,
    isReady: state.isReady,
    turnStatus: state.turnStatus,
    error: state.error,
    hasRunInitialDiagnostic: state.hasRunInitialDiagnostic,
    
    // Circuit breaker info
    circuitBreakerState: circuitBreaker.state,
    canAttemptConnection: circuitBreaker.canAttemptConnection,
    timeUntilRetry: circuitBreaker.timeUntilRetry,
    
    // Ações
    initializeWebRTC,
    forceRetry,
    runTurnDiagnostic
  };
};