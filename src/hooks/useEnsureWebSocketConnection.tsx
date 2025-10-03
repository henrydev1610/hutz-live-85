import { useEffect, useCallback } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

interface UseEnsureWebSocketConnectionOptions {
  onConnected?: () => void;
  onFailed?: (error: string) => void;
  maxRetries?: number;
}

export const useEnsureWebSocketConnection = ({
  onConnected,
  onFailed,
  maxRetries = 5
}: UseEnsureWebSocketConnectionOptions = {}) => {

  const ensureConnection = useCallback(async (): Promise<boolean> => {
    console.log('🔌 ENSURE-WS: Starting connection verification');

    // Se já está conectado, retorna sucesso
    if (unifiedWebSocketService.isReady()) {
      console.log('✅ ENSURE-WS: Already connected');
      onConnected?.();
      return true;
    }

    // Tentar conectar com retries
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      console.log(`🔄 ENSURE-WS: Connection attempt ${attempt}/${maxRetries}`);

      try {
        await unifiedWebSocketService.connect();
        
        // Aguardar confirmação de conexão
        const connected = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          const checkInterval = setInterval(() => {
            if (unifiedWebSocketService.isReady()) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve(true);
            }
          }, 100);
        });

        if (connected) {
          console.log(`✅ ENSURE-WS: Connected successfully on attempt ${attempt}`);
          toast.success('Conectado ao servidor!');
          onConnected?.();
          return true;
        }

        console.warn(`⚠️ ENSURE-WS: Connection timeout on attempt ${attempt}`);
      } catch (error) {
        console.error(`❌ ENSURE-WS: Connection error on attempt ${attempt}:`, error);
      }

      // Aguardar antes de retry (backoff exponencial)
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        console.log(`⏱️ ENSURE-WS: Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error('❌ ENSURE-WS: All connection attempts failed');
    const errorMsg = `Falha ao conectar após ${maxRetries} tentativas`;
    toast.error(errorMsg);
    onFailed?.(errorMsg);
    return false;
  }, [onConnected, onFailed, maxRetries]);

  return { ensureConnection };
};
