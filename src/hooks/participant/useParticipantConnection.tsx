
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

    console.log('🎯 PARTICIPANT: Starting connection process');
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Test signaling connection first
      console.log('🔌 PARTICIPANT: Testing signaling connection');
      await signalingService.connect();
      
      const signalingReady = signalingService.isReady();
      console.log('📡 Signaling ready:', signalingReady);
      
      if (!signalingReady) {
        console.warn('⚠️ Signaling not ready, but continuing...');
      }

      // Initialize WebRTC connection
      console.log('🔗 PARTICIPANT: Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId, participantId, stream);
      console.log('✅ PARTICIPANT: WebRTC initialized successfully');
      
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ PARTICIPANT: Connection completed successfully');
      
      toast.success('Conectado à sessão com sucesso!');
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Connection failed:', error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('websocket') || error.message.includes('socket')) {
          errorMessage = 'Erro de conexão WebSocket. Verifique se o servidor está rodando em localhost:3001';
        } else if (error.message.includes('media') || error.message.includes('getUserMedia')) {
          errorMessage = 'Erro ao acessar câmera/microfone. Verifique as permissões do navegador';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Erro na conexão WebRTC. Tente reconectar';
        }
      }
      
      setError(errorMessage);
      toast.error('Falha na conexão. Tente reconectar.');
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
      console.error('❌ PARTICIPANT: Error disconnecting:', error);
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
