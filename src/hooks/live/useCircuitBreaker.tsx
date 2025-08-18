import { useRef } from 'react';

interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_RESET_TIMEOUT = 60000; // 1 minute

export const useCircuitBreaker = (
  threshold: number = DEFAULT_THRESHOLD,
  timeout: number = DEFAULT_TIMEOUT
) => {
  const state = useRef<Map<string, CircuitBreakerState>>(new Map());

  const getState = (key: string): CircuitBreakerState => {
    if (!state.current.has(key)) {
      state.current.set(key, {
        isOpen: false,
        failures: 0,
        lastFailure: 0,
        lastSuccess: Date.now()
      });
    }
    return state.current.get(key)!;
  };

  const canExecute = (key: string): boolean => {
    const breaker = getState(key);
    const now = Date.now();

    // Se circuit está aberto, verificar se deve resetar
    if (breaker.isOpen) {
      if (now - breaker.lastFailure > timeout) {
        console.log(`🔄 CIRCUIT BREAKER: Tentando reset para ${key} após ${Math.round((now - breaker.lastFailure)/1000)}s`);
        breaker.isOpen = false;
        breaker.failures = 0;
        return true;
      }
      console.log(`🚫 CIRCUIT BREAKER: Bloqueado para ${key} (${Math.round((timeout - (now - breaker.lastFailure))/1000)}s restantes)`);
      return false;
    }

    return true;
  };

  const recordSuccess = (key: string): void => {
    const breaker = getState(key);
    breaker.failures = 0;
    breaker.lastSuccess = Date.now();
    breaker.isOpen = false;
    
    console.log(`✅ CIRCUIT BREAKER: Sucesso registrado para ${key} - resetando contador`);
  };

  const recordFailure = (key: string): void => {
    const breaker = getState(key);
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= threshold) {
      breaker.isOpen = true;
      console.error(`🚫 CIRCUIT BREAKER: Aberto para ${key} após ${breaker.failures} falhas - bloqueando por ${Math.round(timeout/1000)}s`);
      
      // Auto-reset após timeout
      setTimeout(() => {
        if (state.current.has(key)) {
          const currentBreaker = state.current.get(key)!;
          if (currentBreaker.isOpen) {
            console.log(`🔄 CIRCUIT BREAKER: Auto-reset para ${key} após timeout`);
            currentBreaker.isOpen = false;
            currentBreaker.failures = 0;
          }
        }
      }, timeout);
    } else {
      console.warn(`⚠️ CIRCUIT BREAKER: Falha ${breaker.failures}/${threshold} para ${key}`);
    }
  };

  const getStatus = (key: string) => {
    const breaker = getState(key);
    return {
      isOpen: breaker.isOpen,
      failures: breaker.failures,
      canExecute: canExecute(key),
      timeSinceLastFailure: breaker.lastFailure ? Date.now() - breaker.lastFailure : null
    };
  };

  const reset = (key: string): void => {
    state.current.delete(key);
    console.log(`🔄 CIRCUIT BREAKER: Reset manual para ${key}`);
  };

  const resetAll = (): void => {
    const keys = Array.from(state.current.keys());
    state.current.clear();
    console.log(`🔄 CIRCUIT BREAKER: Reset manual para todas as chaves:`, keys);
  };

  return {
    canExecute,
    recordSuccess,
    recordFailure,
    getStatus,
    reset,
    resetAll
  };
};