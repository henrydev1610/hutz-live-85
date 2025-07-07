
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import signalingService from '@/services/WebSocketSignalingService';

export const useParticipantConnection = (sessionId: string | undefined, participantId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const connectToSession = useCallback(async (stream?: MediaStream) => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    console.log('🎯 MOBILE: Starting connection process');
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      console.log('🔌 MOBILE: Testing signaling connection');
      await signalingService.connect();
      
      const signalingReady = signalingService.isReady();
      const fallbackStreaming = signalingService.isFallbackStreamingEnabled();
      
      console.log('📡 MOBILE: Signaling status:', {
        ready: signalingReady,
        fallbackMode: signalingService.isFallbackMode(),
        fallbackStreaming: fallbackStreaming
      });

      console.log('🔗 MOBILE: Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log('✅ MOBILE: WebRTC initialized successfully');
      
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ MOBILE: Connection completed successfully');
      
      // Show different success message based on connection type
      if (fallbackStreaming) {
        toast.success('Conectado em modo de compatibilidade - transmissão ativa!');
      } else if (signalingReady) {
        toast.success('Conectado à sessão com sucesso!');
      } else {
        toast.success('Conectado em modo fallback - transmissão funcionando!');
      }
      
    } catch (error) {
      console.error('❌ MOBILE: Connection failed:', error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('websocket') || error.message.includes('socket')) {
          errorMessage = 'Conexão WebSocket instável - tentando modo de compatibilidade';
        } else if (error.message.includes('media') || error.message.includes('getUserMedia')) {
          errorMessage = 'Erro ao acessar câmera/microfone. Verifique as permissões do navegador';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Erro na conexão WebRTC. Tente reconectar';
        }
      }
      
      setError(errorMessage);
      
      // On mobile, try to continue with fallback streaming
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        console.log('🚀 MOBILE: Attempting fallback streaming after error');
        setTimeout(() => {
          if (signalingService.isFallbackStreamingEnabled()) {
            setIsConnected(true);
            setConnectionStatus('connected');
            setError(null);
            toast.success('Conectado em modo de compatibilidade móvel!');
          } else {
            toast.error('Falha na conexão. Tente reconectar.');
          }
        }, 3000);
      } else {
        toast.error('Falha na conexão. Tente reconectar.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId]);

  const disconnectFromSession = useCallback(() => {
    try {
      cleanupWebRTC();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão');
    } catch (error) {
      console.error('❌ MOBILE: Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    connectionStatus,
    error,
    connectToSession,
    disconnectFromSession
  };
};
