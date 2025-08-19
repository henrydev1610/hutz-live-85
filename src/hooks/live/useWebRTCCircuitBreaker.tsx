// FASE 2: Hook para circuit breaker WebRTC com timeouts otimizados
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
  state: 'closed' | 'open' | 'half-open';
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // Quantas falhas antes de abrir
  recoveryTimeout: number;       // Tempo antes de tentar novamente (ms)
  monitorInterval: number;       // Intervalo de monitoramento (ms)
  connectionTimeout: number;     // Timeout para conexões WebRTC (ms)
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,           // FASE 2: 3 falhas para abrir (reduzido)
  recoveryTimeout: 10000,        // FASE 2: 10s recovery (reduzido de 30s)
  monitorInterval: 5000,         // FASE 2: 5s monitor (reduzido)
  connectionTimeout: 5000        // FASE 2: 5s timeout (reduzido de 15s)
};

export const useWebRTCCircuitBreaker = (config: Partial<CircuitBreakerConfig> = {}) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<CircuitBreakerState>({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextRetryTime: 0,
    state: 'closed'
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const monitorRef = useRef<NodeJS.Timeout | null>(null);

  // FASE 2: Registrar falha e abrir circuit se necessário
  const recordFailure = useCallback((reason?: string) => {
    const now = Date.now();
    const newFailureCount = state.failureCount + 1;
    
    console.warn(`🔥 [CIRCUIT] WebRTC failure recorded (${newFailureCount}/${fullConfig.failureThreshold}): ${reason || 'Unknown'}`);
    
    if (newFailureCount >= fullConfig.failureThreshold) {
      const nextRetry = now + fullConfig.recoveryTimeout;
      
      setState({
        isOpen: true,
        failureCount: newFailureCount,
        lastFailureTime: now,
        nextRetryTime: nextRetry,
        state: 'open'
      });

      console.error(`🚫 [CIRCUIT] Circuit breaker OPENED - blocking WebRTC connections for ${fullConfig.recoveryTimeout/1000}s`);
      toast.error(`🚫 WebRTC travado detectado - aguardando ${fullConfig.recoveryTimeout/1000}s para retry`, { duration: 5000 });

      // FASE 2: Auto-recovery após timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        console.log('🔄 [CIRCUIT] Attempting recovery - switching to half-open');
        setState(prev => ({ ...prev, state: 'half-open' }));
      }, fullConfig.recoveryTimeout);
    } else {
      setState(prev => ({
        ...prev,
        failureCount: newFailureCount,
        lastFailureTime: now
      }));
    }
  }, [state.failureCount, fullConfig]);

  // FASE 2: Registrar sucesso e fechar circuit
  const recordSuccess = useCallback(() => {
    console.log('✅ [CIRCUIT] WebRTC success - resetting circuit breaker');
    setState({
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      state: 'closed'
    });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // FASE 2: Verificar se pode tentar conexão
  const canAttemptConnection = useCallback(() => {
    const now = Date.now();
    
    switch (state.state) {
      case 'closed':
        return true;
      case 'open':
        return now >= state.nextRetryTime;
      case 'half-open':
        return true; // Permitir uma tentativa em half-open
      default:
        return false;
    }
  }, [state]);

  // FASE 2: Wrapper para executar operação WebRTC com timeout
  const executeWithCircuitBreaker = useCallback(
    async (
      operation: () => Promise<any>,
      operationName: string = 'WebRTC Operation'
    ) => {
      if (!canAttemptConnection()) {
        const waitTime = Math.max(0, state.nextRetryTime - Date.now());
        throw new Error(`Circuit breaker is OPEN - wait ${Math.ceil(waitTime/1000)}s before retry`);
      }

      console.log(`🔄 [CIRCUIT] Executing ${operationName} with ${fullConfig.connectionTimeout}ms timeout`);
      
      try {
        // FASE 2: Aplicar timeout otimizado
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`${operationName} timeout after ${fullConfig.connectionTimeout}ms`)), fullConfig.connectionTimeout)
          )
        ]);

        recordSuccess();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        recordFailure(`${operationName}: ${errorMessage}`);
        throw error;
      }
    },
    [canAttemptConnection, state.nextRetryTime, fullConfig.connectionTimeout, recordSuccess, recordFailure]
  );

  // FASE 2: Force reset do circuit breaker
  const forceReset = useCallback(() => {
    console.log('🔥 [CIRCUIT] Force reset requested');
    setState({
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      state: 'closed'
    });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    toast.success('🔄 Circuit breaker reset - WebRTC reconnection enabled');
  }, []);

  // FASE 2: Monitoramento contínuo
  useEffect(() => {
    monitorRef.current = setInterval(() => {
      const now = Date.now();
      
      // Auto-reset se muito tempo sem falhas
      if (state.state === 'closed' && state.failureCount > 0) {
        const timeSinceLastFailure = now - state.lastFailureTime;
        if (timeSinceLastFailure > fullConfig.recoveryTimeout * 2) {
          console.log('🧹 [CIRCUIT] Auto-cleaning old failures');
          setState(prev => ({ ...prev, failureCount: 0 }));
        }
      }
    }, fullConfig.monitorInterval);

    return () => {
      if (monitorRef.current) clearInterval(monitorRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fullConfig, state]);

  return {
    state: state.state,
    isOpen: state.isOpen,
    failureCount: state.failureCount,
    canAttemptConnection: canAttemptConnection(),
    timeUntilRetry: Math.max(0, state.nextRetryTime - Date.now()),
    executeWithCircuitBreaker,
    recordFailure,
    recordSuccess,
    forceReset
  };
};