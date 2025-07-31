import { useRef, useCallback } from 'react';

interface UseTransmissionWindowDebounceProps {
  delay?: number;
}

export const useTransmissionWindowDebounce = ({ delay = 1000 }: UseTransmissionWindowDebounceProps = {}) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  const debouncedUpdate = useCallback((updateFunction: () => void, forceUpdate: boolean = false) => {
    const now = Date.now();
    
    // FASE 5: Debounce para evitar loops infinitos
    if (!forceUpdate && isUpdatingRef.current) {
      console.log('🚫 TRANSMISSION DEBOUNCE: Update em progresso, ignorando...');
      return;
    }
    
    if (!forceUpdate && (now - lastUpdateRef.current) < delay) {
      console.log('🚫 TRANSMISSION DEBOUNCE: Update muito recente, ignorando...');
      return;
    }

    // Limpar timeout existente
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log('⏱️ TRANSMISSION DEBOUNCE: Agendando update...');
    
    timeoutRef.current = setTimeout(() => {
      if (isUpdatingRef.current && !forceUpdate) {
        console.log('🚫 TRANSMISSION DEBOUNCE: Update ainda em progresso, cancelando...');
        return;
      }
      
      isUpdatingRef.current = true;
      lastUpdateRef.current = now;
      
      console.log('✅ TRANSMISSION DEBOUNCE: Executando update');
      
      try {
        updateFunction();
      } catch (error) {
        console.error('❌ TRANSMISSION DEBOUNCE: Erro durante update:', error);
      } finally {
        isUpdatingRef.current = false;
      }
    }, delay);
  }, [delay]);

  const forceUpdate = useCallback((updateFunction: () => void) => {
    console.log('🔄 TRANSMISSION DEBOUNCE: Force update solicitado');
    debouncedUpdate(updateFunction, true);
  }, [debouncedUpdate]);

  const cancelUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('🧹 TRANSMISSION DEBOUNCE: Update cancelado');
    }
  }, []);

  const isUpdatePending = useCallback(() => {
    return timeoutRef.current !== null || isUpdatingRef.current;
  }, []);

  return {
    debouncedUpdate,
    forceUpdate,
    cancelUpdate,
    isUpdatePending
  };
};