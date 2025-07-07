
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

    console.log(`🎯 Starting connection process (Mobile: ${/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)})`);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      console.log('🔌 Testing signaling connection with enhanced settings');
      await signalingService.connect();
      
      const signalingReady = signalingService.isReady();
      const fallbackStreaming = signalingService.isFallbackStreamingEnabled();
      const connectionMetrics = signalingService.getConnectionMetrics();
      
      console.log('📡 Connection status:', {
        ready: signalingReady,
        fallbackMode: signalingService.isFallbackMode(),
        fallbackStreaming: fallbackStreaming,
        connectionStatus: signalingService.getConnectionStatus(),
        metrics: connectionMetrics
      });

      console.log('🔗 Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log('✅ WebRTC initialized successfully');
      
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ Connection completed successfully');
      
      // Show success message based on actual connection type
      const finalStatus = signalingService.getConnectionStatus();
      if (finalStatus === 'connected') {
        toast.success('Conectado à sessão com WebSocket!');
      } else if (finalStatus === 'fallback-streaming') {
        toast.success('Conectado em modo de compatibilidade - transmissão ativa!');
      } else {
        toast.success('Conectado à sessão!');
      }
      
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('websocket') || error.message.includes('socket')) {
          errorMessage = 'Conexão WebSocket instável - usando modo de compatibilidade';
        } else if (error.message.includes('media') || error.message.includes('getUserMedia')) {
          errorMessage = 'Erro ao acessar câmera/microfone. Verifique as permissões do navegador';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Erro na conexão WebRTC. Tente reconectar';
        }
      }
      
      setError(errorMessage);
      
      // Try fallback after connection failure
      console.log('🚀 Attempting fallback streaming after error');
      setTimeout(() => {
        if (signalingService.isFallbackStreamingEnabled()) {
          setIsConnected(true);
          setConnectionStatus('connected');
          setError(null);
          toast.success('Conectado em modo de compatibilidade!');
        } else {
          toast.error('Falha na conexão. Tente reconectar.');
        }
      }, 2000);
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
      console.error('❌ Error disconnecting:', error);
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
