
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

    console.log(`🔗 PARTICIPANT CONNECTION: Starting connection process for ${participantId}`);
    console.log(`📱 PARTICIPANT CONNECTION: Mobile device: ${isMobile}`);
    console.log(`🎥 PARTICIPANT CONNECTION: Has stream: ${!!stream}`);
    
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    let retryCount = 0;
    const maxRetries = isMobile ? 4 : 3; // Reduced retries to avoid conflicts
    
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
        const joinTimeout = isMobile ? 20000 : 15000;
        
        await Promise.race([
          unifiedWebSocketService.joinRoom(sessionId, participantId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Join room timeout after ${joinTimeout}ms`)), joinTimeout)
          )
        ]);
        console.log(`✅ PARTICIPANT CONNECTION: Joined room successfully`);

        // Aguardar mais tempo para estabilização no mobile
        await new Promise(resolve => setTimeout(resolve, isMobile ? 2000 : 1000));

        // Etapa 3: Conectar WebRTC com configurações específicas para mobile
        console.log(`🔗 PARTICIPANT CONNECTION: Initializing WebRTC (attempt ${retryCount + 1})`);
        
        const webrtcTimeout = isMobile ? 30000 : 20000;
        const { webrtc } = await Promise.race([
          initParticipantWebRTC(sessionId, participantId, stream || undefined),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`WebRTC timeout after ${webrtcTimeout}ms`)), webrtcTimeout)
          )
        ]);
        
        // Setup WebRTC callbacks
        webrtc.setOnStreamCallback((pId: string, incomingStream: MediaStream) => {
          console.log(`🎥 PARTICIPANT CONNECTION: Stream received from ${pId}:`, {
            streamId: incomingStream.id,
            active: incomingStream.active,
            tracks: incomingStream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState
            }))
          });
        });
        
        webrtc.setOnParticipantJoinCallback((pId: string) => {
          console.log(`👤 PARTICIPANT CONNECTION: Participant joined: ${pId}`);
        });
        
        console.log(`✅ PARTICIPANT CONNECTION: WebRTC initialized successfully`);
        
        // Verify local stream transmission
        if (stream) {
          console.log(`🎥 PARTICIPANT CONNECTION: Local stream sent to WebRTC:`, {
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
          
          // Verify that tracks were added to WebRTC
          setTimeout(() => {
            const manager = require('@/utils/webrtc').getWebRTCManager();
            if (manager) {
              const connections = manager.getPeerConnections();
              console.log(`🔍 PARTICIPANT CONNECTION: WebRTC peer connections:`, connections.size);
              connections.forEach((pc, peerId) => {
                const senders = pc.getSenders();
                console.log(`📡 PARTICIPANT CONNECTION: Peer ${peerId} has ${senders.length} senders`);
                senders.forEach((sender, index) => {
                  if (sender.track) {
                    console.log(`  Sender ${index}: ${sender.track.kind} track (${sender.track.readyState})`);
                  }
                });
              });
            }
          }, 2000);
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
          // Cleanup antes de retry
          try {
            unifiedWebSocketService.disconnect();
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
    }
  }, [sessionId, participantId, isMobile]);

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
