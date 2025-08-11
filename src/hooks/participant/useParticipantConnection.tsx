
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';
import { getEnvironmentInfo, validateURLConsistency } from '@/utils/connectionUtils';

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

    console.log(`🔗 PARTICIPANT CONNECTION: Starting enhanced connection process for ${participantId}`);
    console.log(`📱 PARTICIPANT CONNECTION: Mobile device: ${isMobile}`);
    console.log(`🎥 PARTICIPANT CONNECTION: Has stream: ${!!stream}`);
    
    // FASE 4: Debug and environment validation
    const envInfo = getEnvironmentInfo();
    const urlConsistent = validateURLConsistency();
    
    console.log(`🌍 CONNECTION ENVIRONMENT:`, envInfo);
    console.log(`🔍 URL CONSISTENCY: ${urlConsistent ? 'VALID' : 'INVALID'}`);
    
    if (!urlConsistent) {
      console.warn('⚠️ URL inconsistency detected - this may cause connection issues');
    }
    
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    // ✅ Emitir stream-started para o host ser notificado
    if (stream) {
      console.log('📡 Emitindo stream-started para o host');
      
      // Aguardar conexão WebSocket antes de emitir
      try {
        // Emitir stream-started após conectar ao WebSocket
        setTimeout(() => {
          unifiedWebSocketService.emit('stream-started', {
            participantId,
            roomId: sessionId,
            streamInfo: {
              streamId: stream.id,
              hasVideo: stream.getVideoTracks().length > 0,
              hasAudio: stream.getAudioTracks().length > 0
            }
          });
        }, 3000); // Aguardar 3s para WebSocket estar estável
      } catch (error) {
        console.warn('⚠️ Erro ao configurar emit stream-started:', error);
      }
    }


   

    // FASE 4: QUEBRA DE RETRY LOOP - Circuit breaker rígido
    const maxRetries = isMobile ? 3 : 2; // REDUZIDO drasticamente
    const connectionMetrics = {
      startTime: Date.now(),
      attempts: 0,
      networkQuality: envInfo.urlMapping ? 'detected' : 'unknown',
      lastAttemptTime: 0
    };
    
    let retryCount = 0;
    const DEBOUNCE_MINIMUM = 5000; // 5s mínimo entre tentativas
    
    const attemptConnection = async (): Promise<void> => {
      // FASE 4: DEBOUNCE CHECK - evitar retry muito frequente
      const now = Date.now();
      if (connectionMetrics.lastAttemptTime > 0 && (now - connectionMetrics.lastAttemptTime) < DEBOUNCE_MINIMUM) {
        const waitTime = DEBOUNCE_MINIMUM - (now - connectionMetrics.lastAttemptTime);
        console.log(`⏸️ FASE 4: DEBOUNCE - aguardando ${waitTime}ms antes da próxima tentativa`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      connectionMetrics.attempts++;
      connectionMetrics.lastAttemptTime = Date.now();
      retryCount++;
      
      // FASE 4: TIMEOUT ABSOLUTO - 30s máximo total
      if ((Date.now() - connectionMetrics.startTime) > 30000) {
        throw new Error('TIMEOUT: Connection attempts exceeded 30 seconds total time');
      }
      
      try {
        console.log(`🔄 FASE 4: CONTROLLED Connection attempt ${retryCount}/${maxRetries} for ${participantId}`);
        console.log(`📊 FASE 4: METRICS:`, {
          attempt: retryCount,
          elapsedTime: Date.now() - connectionMetrics.startTime,
          lastAttemptGap: connectionMetrics.lastAttemptTime - (connectionMetrics.attempts > 1 ? connectionMetrics.lastAttemptTime - DEBOUNCE_MINIMUM : 0),
          mobile: isMobile
        });
        
        // Setup enhanced callbacks primeiro
        unifiedWebSocketService.setCallbacks({
          onConnected: () => {
            console.log('🔗Participante conectado com sucesso!');
            setConnectionStatus('connected');
          },
          onDisconnected: () => {
            console.log('🔗 PARTICIPANT CONNECTION: WebSocket disconnectado');
            setConnectionStatus('disconnected');
            setIsConnected(false);
          },
          onConnectionFailed: (error) => {
            console.error('🔗 PARTICIPANT CONNECTION: WebSocket connection failed:', error);
            setConnectionStatus('failed');
            setError('Falha na conexão WebSocket');
          },
          onStreamStarted(participantId, streamInfo) {
            console.log(`🎥 PARTICIPANT CONNECTION: Stream iniciado por:  ${participantId}:`, streamInfo);
            // Atualizar estado do participante com o stream recebido
        
          },
        });

        // Etapa 1: Conectar WebSocket com timeouts otimizados
        console.log(`🔗 PARTICIPANT CONNECTION: Connecting WebSocket (attempt ${retryCount})`);
        const wsStartTime = Date.now();
        
        await unifiedWebSocketService.connect();
        
        const wsConnectTime = Date.now() - wsStartTime;
        console.log(`✅ PARTICIPANT CONNECTION: WebSocket connected in ${wsConnectTime}ms`);
        
        if (!unifiedWebSocketService.isReady()) {
          throw new Error('WebSocket connection failed - not ready');
        }

        // FASE 2: Progressive stabilization delays
        const stabilizationDelay = isMobile ? 2000 : 1000;
        console.log(`⏱️ STABILIZATION: Waiting ${stabilizationDelay}ms for connection to stabilize`);
        await new Promise(resolve => setTimeout(resolve, stabilizationDelay));

        // Etapa 2: Join room com retry e health check
        console.log(`🔗 PARTICIPANT CONNECTION: Joining room (attempt ${retryCount})`);
        const joinStartTime = Date.now();
        
        await unifiedWebSocketService.joinRoom(sessionId, participantId);
        
        const joinTime = Date.now() - joinStartTime;
        console.log(`✅ PARTICIPANT CONNECTION: Joined room in ${joinTime}ms`);

        // FASE 2: Additional stabilization for mobile
        const webrtcDelay = isMobile ? 3000 : 1500;
        console.log(`⏱️ WEBRTC PREP: Waiting ${webrtcDelay}ms before WebRTC initialization`);
        await new Promise(resolve => setTimeout(resolve, webrtcDelay));

        // Etapa 3: Conectar WebRTC com timeouts otimizados
        console.log(`🔗 PARTICIPANT CONNECTION: Initializing WebRTC (attempt ${retryCount})`);
        
        // FASE 2: CRITICAL FIX - Auto-handshake após stream ready
        if (stream) {
          console.log(`🎥 FASE 2 FIX: Stream sendo passado para WebRTC:`, {
            streamId: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            readyState: stream.getTracks().map(t => t.readyState)
          });
          
          // FASE 2: Configurar auto-handshake listener
          const handleStreamReady = (event: CustomEvent) => {
            const { participantId: eventParticipantId, stream: eventStream } = event.detail;
            if (eventParticipantId === participantId && eventStream?.id === stream.id) {
              console.log(`🤝 FASE 2 FIX: Auto-handshake ativado para ${participantId}`);
              // Forçar inicialização do handshake
              setTimeout(() => {
                initiateCallWithRetry('host-default', 3);
              }, 1000);
            }
          };
          
          window.addEventListener('participant-stream-ready', handleStreamReady as EventListener);
          
          // Cleanup listener quando conexão for estabelecida
          const connectionEstablished = () => {
            window.removeEventListener('participant-stream-ready', handleStreamReady as EventListener);
          };
          window.addEventListener('webrtc-connection-established', connectionEstablished);
          
        } else {
          console.warn(`⚠️ FASE 2 FIX: Sem stream - handshake pode falhar`);
        }
        
        const webrtcStartTime = Date.now();
        const { webrtc } = await initParticipantWebRTC(sessionId, participantId, stream);
        
        const webrtcTime = Date.now() - webrtcStartTime;
        console.log(`✅ PARTICIPANT CONNECTION: WebRTC initialized in ${webrtcTime}ms`);
        
        // Setup WebRTC callbacks with enhanced logging
        webrtc.setOnStreamCallback((pId: string, incomingStream: MediaStream) => {
          console.log(`🎥 PARTICIPANT CONNECTION: Stream received from ${pId}:`, {
            streamId: incomingStream.id,
            active: incomingStream.active,
            tracks: incomingStream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState
            })),
            connectionTime: Date.now() - connectionMetrics.startTime
          });
        });
        
        webrtc.setOnParticipantJoinCallback((pId: string) => {
          console.log(`👤 PARTICIPANT CONNECTION: Participant joined: ${pId}`);
        });
        
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
        
        const totalConnectionTime = Date.now() - connectionMetrics.startTime;
        console.log(`🎉 CONNECTION SUCCESS: Total connection time: ${totalConnectionTime}ms`);
        
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // FASE 4: Enhanced success feedback
        if (stream) {
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          
          if (hasVideo && hasAudio) {
            toast.success(`📱 Conectado com vídeo e áudio! (${Math.round(totalConnectionTime/1000)}s)`);
          } else if (hasVideo) {
            toast.success(`📱 Conectado com vídeo! (${Math.round(totalConnectionTime/1000)}s)`);
          } else if (hasAudio) {
            toast.success(`📱 Conectado com áudio! (${Math.round(totalConnectionTime/1000)}s)`);
          } else {
            toast.success(`📱 Conectado (modo degradado)! (${Math.round(totalConnectionTime/1000)}s)`);
          }
        } else {
          toast.success(`📱 Conectado (sem mídia)! (${Math.round(totalConnectionTime/1000)}s)`);
        }
        
      } catch (error) {
        console.error(`❌ Connection attempt ${retryCount} failed:`, error);
        
        if (retryCount < maxRetries) {
          // FASE 3: Enhanced cleanup and retry logic
          try {
            console.log(`🧹 CLEANUP: Cleaning up before retry attempt ${retryCount + 1}`);
            unifiedWebSocketService.disconnect();
            
            // Additional cleanup for mobile
            if (isMobile) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (cleanupError) {
            console.warn('⚠️ Error during cleanup:', cleanupError);
          }
          
          // FASE 3: Exponential backoff with network awareness
          const baseDelay = isMobile ? 3000 : 2000;
          const maxDelay = isMobile ? 60000 : 45000;
          const networkMultiplier = envInfo.isLocalhost ? 1 : 1.5; // Slower for remote connections
          const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1) * networkMultiplier, maxDelay);
          
          console.log(`🔄 ENHANCED RETRY: Attempt ${retryCount + 1}/${maxRetries} in ${Math.round(delay/1000)}s`);
          console.log(`📊 RETRY METRICS: Base: ${baseDelay}ms, Network: ${networkMultiplier}x, Final: ${delay}ms`);
          
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
      const totalTime = Date.now() - connectionMetrics.startTime;
      console.error(`❌ All connection attempts failed after ${Math.round(totalTime/1000)}s:`, error);
      
      setConnectionStatus('failed');
      
      // FASE 4: Enhanced error reporting
      let errorMessage = `Erro na conexão após ${maxRetries} tentativas (${Math.round(totalTime/1000)}s)`;
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = `Timeout na conexão: ${error.message}`;
        } else if (error.message.includes('WebSocket')) {
          errorMessage = 'Falha na conexão WebSocket';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Falha na conexão de vídeo';
        } else if (error.message.includes('circuit')) {
          errorMessage = 'Conexão bloqueada por instabilidade';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      toast.error(`📱 ${errorMessage}`);
      
      // Log final diagnostics
      console.log(`📊 FINAL CONNECTION METRICS:`, {
        totalAttempts: connectionMetrics.attempts,
        totalTime: totalTime,
        environment: envInfo,
        urlConsistent,
        mobile: isMobile
      });
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

  // Métodos para detecção de host e handshake automático
  const getHostId = useCallback(() => {
    try {
      // Implementação simples que retorna um host ID genérico
      // Na implementação real, isso seria obtido via WebSocket listeners
      console.log('🔍 GETHOST: Attempting to detect host ID');
      
      // Retornar um ID padrão de host para permitir que o handshake seja iniciado
      // O WebRTC manager irá descobrir o host real via sinalização
      return 'host-default';
    } catch (error) {
      console.warn('⚠️ GETHOST: Error getting host ID:', error);
      return null;
    }
  }, []);

  const initiateCallWithRetry = useCallback(async (hostId: string, retries: number = 3) => {
    console.log(`📞 WEBRTC HANDSHAKE: Initiating call to host ${hostId} (${retries} retries)`);
    
    try {
      // Usar initParticipantWebRTC para re-inicializar e forçar handshake
      console.log(`🤝 WEBRTC HANDSHAKE: Re-initializing WebRTC to force handshake`);
      
      if (sessionId) {
        // Re-inicializar WebRTC forçando uma nova conexão que irá disparar o handshake
        await initParticipantWebRTC(sessionId, participantId);
        console.log(`✅ WEBRTC HANDSHAKE: WebRTC re-initialized successfully`);
        return true;
      } else {
        console.error('❌ WEBRTC HANDSHAKE: No session ID available');
        return false;
      }
    } catch (error) {
      console.error(`❌ WEBRTC HANDSHAKE: Failed to initiate call to host ${hostId}:`, error);
      
      // Retry logic
      if (retries > 1) {
        console.log(`🔄 WEBRTC HANDSHAKE: Retrying call to host ${hostId} (${retries - 1} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return initiateCallWithRetry(hostId, retries - 1);
      }
      
      return false;
    }
  }, [sessionId, participantId]);

  return {
    isConnected,
    isConnecting,
    connectionStatus,
    error,
    connectToSession,
    disconnectFromSession,
    isMobile,
    getHostId,
    initiateCallWithRetry
  };
};
