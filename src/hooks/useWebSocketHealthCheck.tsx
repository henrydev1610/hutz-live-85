import { useEffect, useState } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

export const useWebSocketHealthCheck = () => {
  const [isHealthy, setIsHealthy] = useState(false);
  const [lastPing, setLastPing] = useState<number>(0);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let pongTimeout: NodeJS.Timeout;

    const setupHealthCheck = () => {
      // Ping a cada 5 segundos
      pingInterval = setInterval(() => {
        if (unifiedWebSocketService.isReady()) {
          console.log('🏓 HEALTH: Sending ping');
          const pingTime = Date.now();
          
          unifiedWebSocketService.emit('ping', { timestamp: pingTime });
          
          // Timeout de 3 segundos para resposta
          pongTimeout = setTimeout(() => {
            console.warn('⚠️ HEALTH: Pong timeout - reconectando');
            setIsHealthy(false);
            toast.warning('Conexão instável, reconectando...');
            unifiedWebSocketService.reconnect();
          }, 3000);
        }
      }, 5000);

      // Listener para pong
      unifiedWebSocketService.on('pong', (data: { timestamp: number }) => {
        const latency = Date.now() - data.timestamp;
        console.log(`✅ HEALTH: Pong recebido - latência ${latency}ms`);
        setIsHealthy(true);
        setLastPing(latency);
        
        if (pongTimeout) {
          clearTimeout(pongTimeout);
        }
      });
    };

    setupHealthCheck();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (pongTimeout) clearTimeout(pongTimeout);
    };
  }, []);

  return { isHealthy, lastPing };
};
