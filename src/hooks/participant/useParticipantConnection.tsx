
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
  const [connectionInProgress, setConnectionInProgress] = useState(false); // FASE 2: Evitar race conditions
  const isMobile = useIsMobile();

  const connectToSession = useCallback(async (stream?: MediaStream | null) => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    // FASE 1: Evitar múltiplas tentativas simultâneas
    if (connectionInProgress) {
      console.log('⚠️ FASE 1: CONNECTION ALREADY IN PROGRESS, skipping...');
      return;
    }

    console.log(`🔗 FASE 1: Starting connection process for ${participantId}`);
    console.log(`📱 FASE 1: Mobile device: ${isMobile}`);
    console.log(`🎥 FASE 1: Has stream: ${!!stream}`);
    
    setConnectionInProgress(true);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    let retryCount = 0;
    const maxRetries = isMobile ? 7 : 5; // Mais tentativas no mobile
    
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

        // Etapa 1: Conectar WebSocket com timeout maior no mobile
        console.log(`🔗 PARTICIPANT CONNECTION: Connecting WebSocket (attempt ${retryCount + 1})`);
        const wsTimeout = isMobile ? 15000 : 10000;
        
        await Promise.race([
          unifiedWebSocketService.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`WebSocket timeout after ${wsTimeout}ms`)), wsTimeout)
          )
        ]);
        
        if (!unifiedWebSocketService.isReady()) {
          throw new Error('WebSocket connection failed - not ready');
        }
        console.log(`✅ PARTICIPANT CONNECTION: WebSocket connected`);

        // Aguardar estabilização da conexão WebSocket
        await new Promise(resolve => setTimeout(resolve, isMobile ? 1000 : 500));

        // Etapa 2: Join room com timeout e retry
        console.log(`🔗 PARTICIPANT CONNECTION: Joining room (attempt ${retryCount + 1})`);
        const joinTimeout = isMobile ? 60000 : 45000; // Aumentado para 60s mobile, 45s desktop
        
        await Promise.race([
          unifiedWebSocketService.joinRoom(sessionId, participantId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Join room timeout after ${joinTimeout}ms`)), joinTimeout)
          )
        ]);
        console.log(`✅ PARTICIPANT CONNECTION: Joined room successfully`);

        // Aguardar mais tempo para estabilização no mobile
        await new Promise(resolve => setTimeout(resolve, isMobile ? 2000 : 1000));

        // FASE 1: Conectar WebRTC com aguardo de estabilização
        console.log(`🔗 FASE 1: Initializing WebRTC (attempt ${retryCount + 1})`);
        
        const webrtcTimeout = isMobile ? 45000 : 30000; // Aumentado para 45s mobile
        const webRTCResult = await Promise.race([
          initParticipantWebRTC(sessionId, participantId, stream || undefined),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`WebRTC timeout after ${webrtcTimeout}ms`)), webrtcTimeout)
          )
        ]);
        
        const { webrtc: webRTCManager } = webRTCResult;
        
        // FASE 1: Aguardar WebRTC estar completamente pronto antes de prosseguir
        console.log(`⏳ FASE 1: Waiting for WebRTC readiness...`);
        let webRTCReady = false;
        let readyAttempts = 0;
        const maxReadyAttempts = isMobile ? 20 : 15; // 20s mobile, 15s desktop
        
        while (!webRTCReady && readyAttempts < maxReadyAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          readyAttempts++;
          
          // Verificar se o WebRTC manager está pronto para operar
          if (webRTCManager && typeof webRTCManager.setOutgoingStream === 'function') {
            console.log(`✅ FASE 1: WebRTC manager ready after ${readyAttempts}s`);
            webRTCReady = true;
          } else {
            console.log(`⏳ FASE 1: Waiting for WebRTC readiness... (${readyAttempts}/${maxReadyAttempts})`);
          }
        }
        
        if (!webRTCReady) {
          throw new Error(`WebRTC manager not ready after ${maxReadyAttempts}s`);
        }
        
        // Setup WebRTC callbacks
        webRTCManager.setOnStreamCallback((pId: string, incomingStream: MediaStream) => {
          console.log(`🎥 FASE 1: Stream received from ${pId}:`, {
            streamId: incomingStream.id,
            active: incomingStream.active,
            tracks: incomingStream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState
            }))
          });
        });
        
        webRTCManager.setOnParticipantJoinCallback((pId: string) => {
          console.log(`👤 FASE 1: Participant joined: ${pId}`);
        });
        
        console.log(`✅ FASE 1: WebRTC initialized and ready!`);
        
        // Verificar se o stream local foi enviado corretamente
        if (stream) {
          console.log(`🎥 PARTICIPANT CONNECTION: Local stream details:`, {
            streamId: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            tracks: stream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
              muted: t.muted
            }))
          });
        }
        
        setIsConnected(true);
        setConnectionStatus('connected');
        
        if (stream) {
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          
          if (hasVideo && hasAudio) {
            toast.success('📱 Conectado com vídeo e áudio!');
          } else if (hasVideo) {
            toast.success('📱 Conectado com vídeo!');
          } else if (hasAudio) {
            toast.success('📱 Conectado com áudio!');
          } else {
            toast.success('📱 Conectado (modo degradado)!');
          }
        } else {
          toast.success('📱 Conectado (sem mídia)!');
        }
        
      } catch (error) {
        console.error(`❌ Connection attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Cleanup antes de retry com proteção contra null
          try {
            if (unifiedWebSocketService && typeof unifiedWebSocketService.disconnect === 'function') {
              unifiedWebSocketService.disconnect();
            } else {
              console.warn('⚠️ WebSocket service not available for cleanup');
            }
          } catch (cleanupError) {
            console.warn('⚠️ Error during cleanup:', cleanupError);
          }
          
          // Exponential backoff com máximo maior no mobile
          const baseDelay = isMobile ? 2000 : 1000;
          const maxDelay = isMobile ? 45000 : 30000;
          const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
          
          console.log(`🔄 Retrying connection in ${delay}ms... (attempt ${retryCount}/${maxRetries})`);
          toast.warning(`Tentativa ${retryCount}/${maxRetries} falhou. Reagendando em ${Math.round(delay/1000)}s...`);
          
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
        if (error.message.includes('timeout')) {
          errorMessage = `Timeout na conexão: ${error.message}`;
        } else if (error.message.includes('WebSocket')) {
          errorMessage = 'Falha na conexão WebSocket';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Falha na conexão de vídeo';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      toast.error(`📱 ${errorMessage}`);
    } finally {
      setIsConnecting(false);
      setConnectionInProgress(false); // FASE 2: Liberar flag de conexão em progresso
    }
  }, [sessionId, participantId, isMobile, connectionInProgress]);

  const disconnectFromSession = useCallback(() => {
    console.log(`🔗 PARTICIPANT CONNECTION: Disconnecting`);
    
    try {
      cleanupWebRTC();
      
      // Verificar se o serviço WebSocket está disponível antes de desconectar
      if (unifiedWebSocketService && typeof unifiedWebSocketService.disconnect === 'function') {
        unifiedWebSocketService.disconnect();
      } else {
        console.warn('⚠️ PARTICIPANT CONNECTION: WebSocket service not available for disconnect');
      }
      
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
    isMobile,
    connectionInProgress // FASE 2: Expor flag de conexão em progresso
  };
};
