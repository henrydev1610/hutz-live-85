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

// PLANO: Detectar ambiente para timeouts diferenciados
const isDesktopEnvironment = !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);
const isCorporateNetwork = window.location.protocol === 'https:' && 
  (window.location.hostname.includes('.corp') || 
   window.location.hostname.includes('.local') ||
   navigator.userAgent.includes('Corporate'));

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: isDesktopEnvironment ? 4 : 3,     // PLANO: Desktop mais tolerante
  recoveryTimeout: isDesktopEnvironment ? 30000 : 15000,  // PLANO: 30s desktop, 15s mobile  
  monitorInterval: isDesktopEnvironment ? 10000 : 5000,   // PLANO: Monitor menos frequente desktop
  connectionTimeout: isDesktopEnvironment ? 15000 : 8000  // PLANO: 15s desktop, 8s mobile
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

  // PLANO: Registrar falha com backoff exponencial
  const recordFailure = useCallback((reason?: string) => {
    const now = Date.now();
    const newFailureCount = state.failureCount + 1;
    
    // PLANO: Distinguir tipos de falha para tratamento adequado
    const isNetworkFailure = reason?.includes('network') || reason?.includes('timeout');
    const isConfigFailure = reason?.includes('credential') || reason?.includes('ice-server');
    
    console.warn(`🔥 [CIRCUIT] WebRTC failure recorded (${newFailureCount}/${fullConfig.failureThreshold}) [${isDesktopEnvironment ? 'DESKTOP' : 'MOBILE'}]: ${reason || 'Unknown'}`);
    
    if (newFailureCount >= fullConfig.failureThreshold) {
      // PLANO: Backoff exponencial baseado no número de falhas
      const baseTimeout = fullConfig.recoveryTimeout;
      const exponentialTimeout = Math.min(baseTimeout * Math.pow(1.5, newFailureCount - fullConfig.failureThreshold), 120000); // Max 2min
      const nextRetry = now + exponentialTimeout;
      
      setState({
        isOpen: true,
        failureCount: newFailureCount,
        lastFailureTime: now,
        nextRetryTime: nextRetry,
        state: 'open'
      });

      const timeoutSeconds = Math.ceil(exponentialTimeout / 1000);
      console.error(`🚫 [CIRCUIT] Circuit breaker OPENED - blocking WebRTC connections for ${timeoutSeconds}s (backoff: ${newFailureCount - fullConfig.failureThreshold + 1})`);
      
      const deviceType = isDesktopEnvironment ? 'Desktop' : 'Mobile';
      const networkType = isCorporateNetwork ? 'Corporativa' : 'Pública';
      toast.error(`🚫 ${deviceType} WebRTC instável (${networkType}) - aguardando ${timeoutSeconds}s`, { duration: 8000 });

      // PLANO: Auto-recovery com timeout escalonado
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        console.log('🔄 [CIRCUIT] Attempting recovery - switching to half-open');
        setState(prev => ({ ...prev, state: 'half-open' }));
        
        // PLANO: Toast para recuperação
        if (isDesktopEnvironment) {
          toast.info('🔄 Desktop WebRTC: Tentando reconexão...', { duration: 3000 });
        }
      }, exponentialTimeout);
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