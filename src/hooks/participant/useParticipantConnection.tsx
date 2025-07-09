
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

    let retryCount = 0;
    const maxRetries = 5;
    
    const attemptConnection = async (): Promise<void> => {
      try {
        console.log(`🔄 Connection attempt ${retryCount + 1}/${maxRetries} for participant ${participantId}`);
        
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
        const { webrtc } = await initParticipantWebRTC(sessionId, participantId, stream || undefined);
        
        // Setup WebRTC callbacks
        webrtc.setOnStreamCallback((pId: string, stream: MediaStream) => {
          console.log(`🎥 Stream received from ${pId}:`, stream);
          // Handle incoming stream
        });
        
        webrtc.setOnParticipantJoinCallback((pId: string) => {
          console.log(`👤 Participant joined: ${pId}`);
          // Handle participant join
        });
        
        console.log(`✅ PARTICIPANT CONNECTION: WebRTC initialized`);
        
        setIsConnected(true);
        setConnectionStatus('connected');
        
        if (stream) {
          toast.success('📱 Conectado com mídia!');
        } else {
          toast.success('📱 Conectado (modo degradado)!');
        }
        
      } catch (error) {
        console.error(`❌ Connection attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff with max 30s
          console.log(`🔄 Retrying connection in ${delay}ms... (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptConnection();
        } else {
          throw error;
        }
      }
    };

    try {
      await attemptConnection();
    } catch (error) {
      console.error(`❌ All connection attempts failed:`, error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão após múltiplas tentativas';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error('📱 Falha na conexão após múltiplas tentativas');
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId]);

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
