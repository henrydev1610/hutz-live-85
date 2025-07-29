import { useEffect, useRef } from 'react';
import { useTimerManager } from './useTimerManager';

interface UseStableConnectionProps {
  isConnecting: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: () => void;
}

export const useStableConnection = ({
  isConnecting,
  maxRetries = 2,
  retryDelay = 10000,
  onRetry
}: UseStableConnectionProps) => {
  const retryCountRef = useRef(0);
  const lastRetryRef = useRef(0);
  const { addTimer, clearAll } = useTimerManager();

  const attemptRetry = () => {
    const now = Date.now();
    
    // Debounce: não tentar novamente se a última tentativa foi muito recente
    if (now - lastRetryRef.current < retryDelay) {
      console.log('🚫 STABLE CONNECTION: Retry debounced');
      return;
    }

    if (retryCountRef.current >= maxRetries) {
      console.log('🛑 STABLE CONNECTION: Max retries reached');
      return;
    }

    retryCountRef.current++;
    lastRetryRef.current = now;
    
    console.log(`🔄 STABLE CONNECTION: Retry attempt ${retryCountRef.current}/${maxRetries}`);
    
    const timeout = setTimeout(() => {
      onRetry?.();
    }, retryDelay);
    
    addTimer(timeout);
  };

  const resetRetryCount = () => {
    retryCountRef.current = 0;
    lastRetryRef.current = 0;
    clearAll();
  };

  useEffect(() => {
    return () => {
      clearAll();
    };
  }, [clearAll]);

  return {
    attemptRetry,
    resetRetryCount,
    retryCount: retryCountRef.current,
    canRetry: retryCountRef.current < maxRetries
  };
};