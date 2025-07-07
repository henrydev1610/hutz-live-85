
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import mobileSignalingService from '@/services/MobileWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';

export const useParticipantConnection = (sessionId: string | undefined, participantId: string) => {
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

    console.log(`📱 MOBILE CONNECTION: Starting connection process`);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Setup callbacks primeiro
      mobileSignalingService.setCallbacks({
        onConnected: () => {
          console.log('📱 MOBILE CONNECTION: WebSocket connected successfully');
          setConnectionStatus('connected');
        },
        onConnectionFailed: (error) => {
          console.error('📱 MOBILE CONNECTION: WebSocket connection failed:', error);
          setConnectionStatus('failed');
          setError('Falha na conexão WebSocket');
        }
      });

      // Etapa 1: Conectar WebSocket mobile
      console.log(`📱 MOBILE CONNECTION: Connecting WebSocket`);
      await mobileSignalingService.connect();
      
      if (!mobileSignalingService.isReady()) {
        throw new Error('Mobile WebSocket connection failed');
      }
      console.log(`✅ MOBILE CONNECTION: WebSocket connected`);

      // Etapa 2: Join room
      console.log(`📱 MOBILE CONNECTION: Joining room`);
      await mobileSignalingService.joinRoom(sessionId, participantId);
      console.log(`✅ MOBILE CONNECTION: Joined room`);

      // Etapa 3: Conectar WebRTC
      console.log(`📱 MOBILE CONNECTION: Initializing WebRTC`);
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log(`✅ MOBILE CONNECTION: WebRTC initialized`);
      
      setIsConnected(true);
      setConnectionStatus('connected');
      toast.success('📱 Mobile conectado com sucesso!');
      
    } catch (error) {
      console.error(`❌ MOBILE CONNECTION: Connection failed:`, error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão mobile';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error('📱 Falha na conexão mobile. Verifique sua internet.');
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId]);

  const disconnectFromSession = useCallback(() => {
    console.log(`📱 MOBILE CONNECTION: Disconnecting`);
    
    try {
      cleanupWebRTC();
      mobileSignalingService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão');
    } catch (error) {
      console.error(`❌ MOBILE CONNECTION: Error disconnecting:`, error);
      toast.error('Erro ao desconectar');
    }
  }, []);

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
