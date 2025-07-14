import { useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseConnectionRecoveryProps {
  sessionId: string | null;
  onReconnect: () => void;
}

export const useConnectionRecovery = ({ sessionId, onReconnect }: UseConnectionRecoveryProps) => {
  const { toast } = useToast();
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryAttemptsRef = useRef(0);
  const maxRecoveryAttempts = 3;

  const triggerRecovery = useCallback(async () => {
    if (!sessionId) {
      console.error('❌ RECOVERY: No session ID available for recovery');
      return;
    }

    if (recoveryAttemptsRef.current >= maxRecoveryAttempts) {
      console.error('❌ RECOVERY: Max recovery attempts reached');
      toast({
        title: "Falha na Conexão",
        description: "Máximo de tentativas de reconexão atingido. Recarregue a página.",
        variant: "destructive"
      });
      return;
    }

    recoveryAttemptsRef.current++;
    console.log(`🔄 RECOVERY: Attempting recovery ${recoveryAttemptsRef.current}/${maxRecoveryAttempts}`);

    try {
      // Clear any existing timeout
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }

      // Add delay before recovery
      await new Promise(resolve => setTimeout(resolve, 2000 * recoveryAttemptsRef.current));

      // Trigger reconnection
      onReconnect();

      // Show recovery toast
      toast({
        title: "Tentando Reconectar",
        description: `Tentativa ${recoveryAttemptsRef.current} de ${maxRecoveryAttempts}`,
      });

      // Reset attempts on successful connection (after delay)
      recoveryTimeoutRef.current = setTimeout(() => {
        console.log('✅ RECOVERY: Connection stable, resetting attempts');
        recoveryAttemptsRef.current = 0;
      }, 10000);

    } catch (error) {
      console.error('❌ RECOVERY: Recovery attempt failed:', error);
      
      // Schedule next attempt
      if (recoveryAttemptsRef.current < maxRecoveryAttempts) {
        recoveryTimeoutRef.current = setTimeout(() => {
          triggerRecovery();
        }, 3000 * recoveryAttemptsRef.current);
      }
    }
  }, [sessionId, onReconnect, toast]);

  const resetRecovery = useCallback(() => {
    console.log('🔄 RECOVERY: Resetting recovery state');
    recoveryAttemptsRef.current = 0;
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  return {
    triggerRecovery,
    resetRecovery,
    recoveryAttempts: recoveryAttemptsRef.current,
    maxRecoveryAttempts
  };
};