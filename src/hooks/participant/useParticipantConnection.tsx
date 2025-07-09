
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';

export const useParticipantConnection = (sessionId: string | undefined, participantId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const connectToSession = useCallback(async (stream?: MediaStream | null) => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    console.log(`🔗 PARTICIPANT CONNECTION: Starting connection process`);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Setup callbacks primeiro
      unifiedWebSocketService.setCallbacks({
        onConnected: () => {
          console.log('🔗 PARTICIPANT CONNECTION: WebSocket connected successfully');
          setConnectionStatus('connected');
        },
        onDisconnected: () => {
          console.log('🔗 PARTICIPANT CONNECTION: WebSocket disconnected');
          setConnectionStatus('disconnected');
          setIsConnected(false);
        },
        onConnectionFailed: (error) => {
          console.error('🔗 PARTICIPANT CONNECTION: WebSocket connection failed:', error);
          setConnectionStatus('failed');
          setError('Falha na conexão WebSocket');
        }
      });

      // Etapa 1: Conectar WebSocket
      console.log(`🔗 PARTICIPANT CONNECTION: Connecting WebSocket`);
      await unifiedWebSocketService.connect();
      
      if (!unifiedWebSocketService.isReady()) {
        throw new Error('WebSocket connection failed');
      }
      console.log(`✅ PARTICIPANT CONNECTION: WebSocket connected`);

      // Etapa 2: Join room
      console.log(`🔗 PARTICIPANT CONNECTION: Joining room`);
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      console.log(`✅ PARTICIPANT CONNECTION: Joined room`);

      // Etapa 3: Conectar WebRTC (permitir sem stream)
      console.log(`🔗 PARTICIPANT CONNECTION: Initializing WebRTC`);
      if (stream) {
        console.log(`🔗 PARTICIPANT CONNECTION: Connecting with media stream`);
        await initParticipantWebRTC(sessionId, participantId, stream);
        toast.success('📱 Conectado com mídia!');
      } else {
        console.log(`🔗 PARTICIPANT CONNECTION: Connecting in degraded mode (no media)`);
        await initParticipantWebRTC(sessionId, participantId);
        toast.success('📱 Conectado (modo degradado)!');
      }
      console.log(`✅ PARTICIPANT CONNECTION: WebRTC initialized`);
      
      setIsConnected(true);
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error(`❌ PARTICIPANT CONNECTION: Connection failed:`, error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error('📱 Falha na conexão. Tentando reconectar...');
      
      // Retry with exponential backoff
      setTimeout(() => {
        if (!isConnected) {
          console.log('🔄 PARTICIPANT CONNECTION: Retrying connection...');
          connectToSession(stream);
        }
      }, 3000);
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId, isConnected]);

  const disconnectFromSession = useCallback(() => {
    console.log(`🔗 PARTICIPANT CONNECTION: Disconnecting`);
    
    try {
      cleanupWebRTC();
      unifiedWebSocketService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão');
    } catch (error) {
      console.error(`❌ PARTICIPANT CONNECTION: Error disconnecting:`, error);
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
