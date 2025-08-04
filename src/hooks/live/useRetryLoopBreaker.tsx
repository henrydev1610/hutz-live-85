import { useRef, useCallback } from 'react';

interface RetryState {
  attempts: number;
  lastAttempt: number;
  isBlocked: boolean;
  reason?: string;
}

interface RetryLimits {
  maxAttempts: number;
  timeWindow: number;
  blockDuration: number;
  minInterval: number;
}

export const useRetryLoopBreaker = () => {
  const retryStates = useRef<Map<string, RetryState>>(new Map());
  
  const defaultLimits: RetryLimits = {
    maxAttempts: 3,
    timeWindow: 30000, // 30s
    blockDuration: 60000, // 1 min block
    minInterval: 5000 // 5s entre tentativas
  };

  const shouldAllowRetry = useCallback((key: string, limits: Partial<RetryLimits> = {}): boolean => {
    const config = { ...defaultLimits, ...limits };
    const state = retryStates.current.get(key);
    const now = Date.now();
    
    if (!state) {
      retryStates.current.set(key, {
        attempts: 0,
        lastAttempt: 0,
        isBlocked: false
      });
      return true;
    }
    
    // Verificar se ainda está bloqueado
    if (state.isBlocked && (now - state.lastAttempt) < config.blockDuration) {
      console.log(`🚫 RETRY BREAKER: ${key} ainda bloqueado por ${Math.round((config.blockDuration - (now - state.lastAttempt)) / 1000)}s`);
      return false;
    }
    
    // Reset block se passou do tempo
    if (state.isBlocked && (now - state.lastAttempt) >= config.blockDuration) {
      console.log(`✅ RETRY BREAKER: ${key} desbloqueado após timeout`);
      state.isBlocked = false;
      state.attempts = 0;
    }
    
    // Verificar intervalo mínimo
    if ((now - state.lastAttempt) < config.minInterval) {
      console.log(`⏸️ RETRY BREAKER: ${key} precisa aguardar ${Math.round((config.minInterval - (now - state.lastAttempt)) / 1000)}s`);
      return false;
    }
    
    // Verificar limite de tentativas
    if (state.attempts >= config.maxAttempts) {
      console.log(`🚫 RETRY BREAKER: ${key} bloqueado - ${state.attempts} tentativas em ${config.timeWindow}ms`);
      state.isBlocked = true;
      state.reason = `Max attempts (${config.maxAttempts}) reached`;
      return false;
    }
    
    return true;
  }, [defaultLimits]);

  const recordAttempt = useCallback((key: string): void => {
    const state = retryStates.current.get(key) || {
      attempts: 0,
      lastAttempt: 0,
      isBlocked: false
    };
    
    state.attempts++;
    state.lastAttempt = Date.now();
    
    retryStates.current.set(key, state);
    
    console.log(`📊 RETRY BREAKER: ${key} tentativa ${state.attempts} registrada`);
  }, []);

  const resetAttempts = useCallback((key: string): void => {
    const state = retryStates.current.get(key);
    if (state) {
      state.attempts = 0;
      state.isBlocked = false;
      state.reason = undefined;
      console.log(`♻️ RETRY BREAKER: ${key} resetado com sucesso`);
    }
  }, []);

  const getRetryStatus = useCallback((key: string): RetryState | null => {
    return retryStates.current.get(key) || null;
  }, []);

  const clearAll = useCallback((): void => {
    retryStates.current.clear();
    console.log(`🧹 RETRY BREAKER: Todos os estados limpos`);
  }, []);

  return {
    shouldAllowRetry,
    recordAttempt,
    resetAttempts,
    getRetryStatus,
    clearAll
  };
};