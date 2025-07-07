
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import mobileWebSocketService from '@/services/MobileWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';

export const useMobileConnection = (sessionId: string | undefined, participantId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const connectToSession = useCallback(async (stream?: MediaStream) => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    if (!isMobile) {
      console.log('📱 Not mobile device, skipping mobile connection');
      return;
    }

    console.log('📱 Starting MOBILE-SPECIFIC connection process');
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // FORÇA conexão WebSocket no mobile
      console.log('🔌 MOBILE: Forcing WebSocket connection');
      await mobileWebSocketService.connect();
      
      if (!mobileWebSocketService.isReady()) {
        throw new Error('Mobile WebSocket connection failed');
      }

      console.log('✅ MOBILE: WebSocket connected successfully');
      
      // Inicializar WebRTC após WebSocket conectar
      console.log('🔗 MOBILE: Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log('✅ MOBILE: WebRTC initialized successfully');
      
      setIsConnected(true);
      setConnectionStatus('connected');
      toast.success('📱 Conectado via mobile WebSocket!');
      
    } catch (error) {
      console.error('❌ MOBILE: Connection failed:', error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão mobile';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error(`Falha na conexão mobile: ${errorMessage}`);
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId, isMobile]);

  const disconnectFromSession = useCallback(() => {
    if (!isMobile) return;
    
    try {
      cleanupWebRTC();
      mobileWebSocketService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão mobile');
    } catch (error) {
      console.error('❌ MOBILE: Error disconnecting:', error);
      toast.error('Erro ao desconectar mobile');
    }
  }, [isMobile]);

  return {
    isConnected,
    isConnecting,
    connectionStatus,
    error,
    connectToSession,
    disconnectFromSession,
    isMobile
  };
};
