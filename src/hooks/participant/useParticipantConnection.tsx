
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import signalingService from '@/services/WebSocketSignalingService';
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

    console.log(`🔄 UNIFIED: Starting connection process (Mobile: ${isMobile})`);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Etapa 1: Conectar WebSocket
      console.log(`🔌 UNIFIED: Connecting WebSocket (Mobile: ${isMobile})`);
      await signalingService.connect();
      
      if (!signalingService.isReady()) {
        throw new Error('WebSocket connection failed');
      }
      console.log(`✅ UNIFIED: WebSocket connected (Mobile: ${isMobile})`);

      // Etapa 2: Conectar WebRTC
      console.log(`🔗 UNIFIED: Initializing WebRTC (Mobile: ${isMobile})`);
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log(`✅ UNIFIED: WebRTC initialized (Mobile: ${isMobile})`);
      
      setIsConnected(true);
      setConnectionStatus('connected');
      
      if (isMobile) {
        toast.success('📱 Mobile conectado com sucesso!');
      } else {
        toast.success('🖥️ Desktop conectado com sucesso!');
      }
      
    } catch (error) {
      console.error(`❌ UNIFIED: Connection failed (Mobile: ${isMobile}):`, error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      if (isMobile) {
        toast.error('📱 Falha na conexão mobile. Verifique sua internet.');
      } else {
        toast.error('🖥️ Falha na conexão. Tente novamente.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId, isMobile]);

  const disconnectFromSession = useCallback(() => {
    console.log(`🔌 UNIFIED: Disconnecting (Mobile: ${isMobile})`);
    
    try {
      cleanupWebRTC();
      signalingService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão');
    } catch (error) {
      console.error(`❌ UNIFIED: Error disconnecting (Mobile: ${isMobile}):`, error);
      toast.error('Erro ao desconectar');
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
