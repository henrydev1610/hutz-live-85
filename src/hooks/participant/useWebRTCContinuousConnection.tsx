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

  // ENHANCED: Função para verificar saúde da conexão WebRTC com detecção melhorada
  const checkWebRTCHealth = useCallback(() => {
    const webrtcState = getWebRTCConnectionState();
    
    console.log(`🏥 CONTINUOUS: Enhanced WebRTC Health Check`, {
      websocket: webrtcState.websocket,
      webrtc: webrtcState.webrtc,
      overall: webrtcState.overall,
      isConnected,
      connectionStatus,
      hasStream: !!stream,
      streamTracks: stream?.getTracks().length || 0
    });

    // CRITICAL: Detectar múltiplos cenários de falha
    const needsReconnection = (
      // WebSocket OK mas WebRTC falhou
      (webrtcState.websocket === 'connected' && webrtcState.webrtc === 'disconnected') ||
      // WebSocket OK mas WebRTC falhou completamente
      (webrtcState.websocket === 'connected' && webrtcState.webrtc === 'failed') ||
      // Overall state indica falha mesmo com WebSocket OK
      (webrtcState.websocket === 'connected' && webrtcState.overall === 'failed') ||
      // Participante não conectado apesar de WebSocket funcionar
      (webrtcState.websocket === 'connected' && !isConnected && connectionStatus !== 'connecting')
    );

    if (needsReconnection && !isReconnectingRef.current) {
      console.log(`🔄 CONTINUOUS: Connection issue detected, initiating auto-reconnect`, {
        reason: webrtcState.websocket === 'connected' && webrtcState.webrtc === 'disconnected' ? 'WebRTC disconnected' :
                webrtcState.websocket === 'connected' && webrtcState.webrtc === 'failed' ? 'WebRTC failed' :
                webrtcState.websocket === 'connected' && webrtcState.overall === 'failed' ? 'Overall failed' :
                'Participant not connected'
      });
      initiateReconnection();
    }

    // DIAGNOSTIC: Log quando tudo está funcionando
    if (webrtcState.websocket === 'connected' && webrtcState.webrtc === 'connected') {
      console.log(`✅ CONTINUOUS: All connections healthy`);
    }
  }, [isConnected, connectionStatus, stream]);

  // ENHANCED: Função para iniciar processo de reconexão com fallback robusto
  const initiateReconnection = useCallback(async () => {
    if (isReconnectingRef.current || !sessionId) return;
    
    isReconnectingRef.current = true;
    reconnectAttemptsRef.current++;
    
    console.log(`🔄 CONTINUOUS: Starting enhanced reconnection attempt ${reconnectAttemptsRef.current}`);
    
    try {
      // ENHANCED: Delay mais agressivo para mobile
      const baseDelay = isMobile ? 2000 : 1500;
      const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1), isMobile ? 12000 : 8000);
      
      console.log(`⏱️ CONTINUOUS: Waiting ${delay}ms before reconnection...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // CRITICAL: Enhanced reconnection with stream validation
      console.log(`🔥 CONTINUOUS: Attempting reconnection with stream validation...`);
      
      if (stream && stream.getTracks().length > 0) {
        console.log(`📹 CONTINUOUS: Using existing stream with ${stream.getTracks().length} tracks`);
        await connectToSession(stream);
      } else {
        console.log(`⚠️ CONTINUOUS: No valid stream, connecting without media`);
        await connectToSession();
      }
      
      // Reset contador em caso de sucesso
      reconnectAttemptsRef.current = 0;
      console.log(`✅ CONTINUOUS: Enhanced reconnection successful`);
      
    } catch (error) {
      console.error(`❌ CONTINUOUS: Enhanced reconnection attempt ${reconnectAttemptsRef.current} failed:`, error);
      
      // ENHANCED: Limitar tentativas com fallback estratégico
      const maxAttempts = isMobile ? 12 : 8;
      if (reconnectAttemptsRef.current >= maxAttempts) {
        console.log(`🛑 CONTINUOUS: Max reconnection attempts (${maxAttempts}) reached`);
        toast.error('Falha na reconexão automática. Tente reconectar manualmente.');
        reconnectAttemptsRef.current = 0;
      } else {
        // ENHANCED: Delay progressivo mais inteligente
        const nextAttemptDelay = isMobile ? 5000 + (reconnectAttemptsRef.current * 1000) : 3000 + (reconnectAttemptsRef.current * 500);
        console.log(`⏰ CONTINUOUS: Scheduling next attempt in ${nextAttemptDelay}ms...`);
        
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

    // ENHANCED: Health check mais agressivo para mobile
    const interval = isMobile ? 2000 : 3000; // Mais frequente para detectar falhas rapidamente
    console.log(`🏥 CONTINUOUS: Starting health monitoring with ${interval}ms intervals`);
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