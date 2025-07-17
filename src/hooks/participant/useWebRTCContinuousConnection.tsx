import { useEffect, useRef, useCallback } from 'react';
import { getWebRTCConnectionState } from '@/utils/webrtc';
import { toast } from 'sonner';

interface WebRTCContinuousConnectionProps {
  sessionId: string | undefined;
  participantId: string;
  isConnected: boolean;
  connectionStatus: string;
  stream: MediaStream | null;
  connectToSession: (stream?: MediaStream | null) => Promise<void>;
  isMobile: boolean;
}

export const useWebRTCContinuousConnection = ({
  sessionId,
  participantId,
  isConnected,
  connectionStatus,
  stream,
  connectToSession,
  isMobile
}: WebRTCContinuousConnectionProps) => {
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);

  // Função para verificar saúde da conexão WebRTC
  const checkWebRTCHealth = useCallback(() => {
    const webrtcState = getWebRTCConnectionState();
    
    console.log(`🏥 CONTINUOUS: WebRTC Health Check`, {
      websocket: webrtcState.websocket,
      webrtc: webrtcState.webrtc,
      overall: webrtcState.overall,
      isConnected,
      connectionStatus
    });

    // Se WebSocket conectado mas WebRTC desconectado, iniciar reconexão
    if (webrtcState.websocket === 'connected' && 
        webrtcState.webrtc === 'disconnected' && 
        !isReconnectingRef.current) {
      
      console.log(`🔄 CONTINUOUS: WebRTC disconnected, initiating auto-reconnect`);
      initiateReconnection();
    }
  }, [isConnected, connectionStatus]);

  // Função para iniciar processo de reconexão
  const initiateReconnection = useCallback(async () => {
    if (isReconnectingRef.current || !sessionId) return;
    
    isReconnectingRef.current = true;
    reconnectAttemptsRef.current++;
    
    console.log(`🔄 CONTINUOUS: Starting reconnection attempt ${reconnectAttemptsRef.current}`);
    
    try {
      // Delay baseado no número de tentativas e dispositivo móvel
      const baseDelay = isMobile ? 3000 : 2000;
      const delay = Math.min(baseDelay * reconnectAttemptsRef.current, isMobile ? 15000 : 10000);
      
      console.log(`⏱️ CONTINUOUS: Waiting ${delay}ms before reconnection...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Tentar reconectar
      await connectToSession(stream);
      
      // Reset contador em caso de sucesso
      reconnectAttemptsRef.current = 0;
      console.log(`✅ CONTINUOUS: Reconnection successful`);
      
    } catch (error) {
      console.error(`❌ CONTINUOUS: Reconnection attempt ${reconnectAttemptsRef.current} failed:`, error);
      
      // Limitar tentativas consecutivas
      if (reconnectAttemptsRef.current >= (isMobile ? 10 : 7)) {
        console.log(`🛑 CONTINUOUS: Max reconnection attempts reached`);
        toast.error('Falha na reconexão automática. Tente reconectar manualmente.');
        reconnectAttemptsRef.current = 0;
      } else {
        // Agendar próxima tentativa
        const nextAttemptDelay = isMobile ? 8000 : 5000;
        reconnectTimeoutRef.current = setTimeout(() => {
          initiateReconnection();
        }, nextAttemptDelay);
      }
    } finally {
      isReconnectingRef.current = false;
    }
  }, [sessionId, stream, connectToSession, isMobile]);

  // Força reconexão manual
  const forceReconnect = useCallback(async () => {
    console.log(`🔧 CONTINUOUS: Force reconnect requested`);
    
    // Cancelar reconexões automáticas
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset estado
    isReconnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    // Iniciar reconexão imediata
    await initiateReconnection();
  }, [initiateReconnection]);

  // Configurar monitoramento contínuo
  useEffect(() => {
    if (!sessionId || !participantId) return;

    console.log(`🔄 CONTINUOUS: Starting health monitoring for ${participantId}`);
    
    // Check inicial após delay
    const initialDelay = setTimeout(() => {
      checkWebRTCHealth();
    }, 2000);

    // Health check a cada 3 segundos (mais frequente no mobile)
    const interval = isMobile ? 3000 : 4000;
    healthCheckIntervalRef.current = setInterval(checkWebRTCHealth, interval);

    return () => {
      clearTimeout(initialDelay);
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [sessionId, participantId, checkWebRTCHealth, isMobile]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      isReconnectingRef.current = false;
    };
  }, []);

  // Reset contador quando conexão é bem-sucedida
  useEffect(() => {
    if (isConnected && connectionStatus === 'connected') {
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }
  }, [isConnected, connectionStatus]);

  return {
    forceReconnect,
    isReconnecting: isReconnectingRef.current,
    reconnectAttempts: reconnectAttemptsRef.current
  };
};