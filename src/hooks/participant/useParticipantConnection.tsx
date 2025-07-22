
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  getEnvironmentInfo, 
  validateURLConsistency, 
  validateRoom,
  createRoomIfNeeded 
} from '@/utils/connectionUtils';

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

    console.log(`🚀 ENHANCED CONNECTION: Starting for participant ${participantId} in room ${sessionId}`);
    console.log(`📱 DEVICE TYPE: ${isMobile ? 'Mobile' : 'Desktop'}`);
    console.log(`🎥 STREAM STATUS: ${stream ? 'Available' : 'Not available'}`);
    
    // FASE 5: Validação de ambiente e URLs
    const envInfo = getEnvironmentInfo();
    validateURLConsistency();
    
    console.log(`🌍 CONNECTION ENVIRONMENT:`, envInfo);
    
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    // FASE 3: Configuração de retry melhorada
    const maxRetries = isMobile ? 8 : 5;
    const connectionMetrics = {
      startTime: Date.now(),
      attempts: 0,
      roomValidationSuccess: false,
      roomCreationSuccess: false,
      wsConnectSuccess: false,
      roomJoinSuccess: false,
      webrtcInitSuccess: false
    };
    
    let retryCount = 0;
    
    const attemptConnection = async (): Promise<void> => {
      connectionMetrics.attempts++;
      retryCount++;
      
      try {
        console.log(`🔄 Connection attempt ${retryCount}/${maxRetries}`);
        
        // FASE 3: Validar sala ANTES de conectar
        console.log(`🔍 ROOM VALIDATION: Checking if room ${sessionId} exists before connecting`);
        const roomExists = await validateRoom(sessionId);
        connectionMetrics.roomValidationSuccess = roomExists;
        
        if (!roomExists) {
          console.log(`⚠️ ROOM VALIDATION: Room ${sessionId} not found, attempting to create`);
          const roomCreated = await createRoomIfNeeded(sessionId);
          connectionMetrics.roomCreationSuccess = roomCreated;
          
          if (!roomCreated) {
            toast.warning(`Sala ${sessionId} não encontrada e não foi possível criar. Tentando conectar mesmo assim.`);
          } else {
            toast.success(`Sala ${sessionId} criada com sucesso.`);
          }
        } else {
          console.log(`✅ ROOM VALIDATION: Room ${sessionId} exists`);
        }
        
        // Setup enhanced callbacks
        unifiedWebSocketService.setCallbacks({
          onConnected: () => {
            console.log('🔗 WebSocket conectado com sucesso');
            connectionMetrics.wsConnectSuccess = true;
            setConnectionStatus('connected');
          },
          onDisconnected: () => {
            console.log('🔌 WebSocket desconectado');
            setConnectionStatus('disconnected');
            setIsConnected(false);
          },
          onConnectionFailed: (error) => {
            console.error('❌ WebSocket connection failed:', error);
            setConnectionStatus('failed');
            setError('Falha na conexão WebSocket');
          }
        });

        // FASE 1: Conectar WebSocket com timeouts otimizados
        console.log(`🔗 Conectando WebSocket (tentativa ${retryCount})`);
        const wsStartTime = Date.now();
        
        await unifiedWebSocketService.connect();
        
        const wsConnectTime = Date.now() - wsStartTime;
        console.log(`✅ WebSocket conectado em ${wsConnectTime}ms`);
        connectionMetrics.wsConnectSuccess = true;
        
        if (!unifiedWebSocketService.isReady()) {
          throw new Error('WebSocket connection failed - not ready');
        }

        // FASE 3: Estabilização progressiva
        const stabilizationDelay = isMobile ? 1500 : 1000;
        console.log(`⏱️ Aguardando ${stabilizationDelay}ms para estabilização`);
        await new Promise(resolve => setTimeout(resolve, stabilizationDelay));

        // FASE 1: Join room com retry e health check
        console.log(`🏠 Entrando na sala ${sessionId} (tentativa ${retryCount})`);
        const joinStartTime = Date.now();
        
        await unifiedWebSocketService.joinRoom(sessionId, participantId);
        
        const joinTime = Date.now() - joinStartTime;
        console.log(`✅ Entrou na sala em ${joinTime}ms`);
        connectionMetrics.roomJoinSuccess = true;

        // FASE 3: Estabilização adicional para mobile
        const webrtcDelay = isMobile ? 2000 : 1000;
        console.log(`⏱️ Aguardando ${webrtcDelay}ms antes de iniciar WebRTC`);
        await new Promise(resolve => setTimeout(resolve, webrtcDelay));

        // FASE 4: Validar stream antes de iniciar WebRTC
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          console.log(`🎥 STREAM VALIDATION: ${videoTracks.length} video tracks, active: ${stream.active}`);
          
          if (videoTracks.length > 0) {
            const videoSettings = videoTracks[0].getSettings();
            console.log('📊 VIDEO SETTINGS:', {
              width: videoSettings.width,
              height: videoSettings.height,
              frameRate: videoSettings.frameRate,
              facingMode: videoSettings.facingMode
            });
          } else {
            console.warn('⚠️ STREAM VALIDATION: No video tracks found');
          }
        } else {
          console.warn('⚠️ STREAM VALIDATION: No stream available');
        }

        // FASE 1: Inicializar WebRTC com stream validado
        console.log(`🔗 Inicializando WebRTC`);
        const webrtcStartTime = Date.now();
        
        const { webrtc } = await initParticipantWebRTC(sessionId, participantId, stream || undefined);
        
        const webrtcTime = Date.now() - webrtcStartTime;
        console.log(`✅ WebRTC inicializado em ${webrtcTime}ms`);
        connectionMetrics.webrtcInitSuccess = true;
        
        // FASE 4: Enhanced callbacks
        webrtc.setOnStreamCallback((pId: string, incomingStream: MediaStream) => {
          console.log(`🎥 Stream recebido de ${pId}:`, {
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
          console.log(`👤 Participante entrou: ${pId}`);
        });
        
        // FASE 4: Log de stream local
        if (stream) {
          console.log(`🎥 STREAM LOCAL DETAILS:`, {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            tracks: stream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
              muted: t.muted,
              label: t.label
            }))
          });
        }
        
        // FASE 5: Relatório completo de métricas
        const totalConnectionTime = Date.now() - connectionMetrics.startTime;
        console.log(`🎉 CONEXÃO BEM-SUCEDIDA em ${totalConnectionTime}ms com métricas:`, connectionMetrics);
        
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // FASE 5: Feedback aprimorado
        if (stream) {
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          
          if (hasVideo && hasAudio) {
            toast.success(`Conectado com vídeo e áudio! (${Math.round(totalConnectionTime/1000)}s)`);
          } else if (hasVideo) {
            toast.success(`Conectado apenas com vídeo! (${Math.round(totalConnectionTime/1000)}s)`);
          } else if (hasAudio) {
            toast.success(`Conectado apenas com áudio! (${Math.round(totalConnectionTime/1000)}s)`);
          } else {
            toast.success(`Conectado sem mídia! (${Math.round(totalConnectionTime/1000)}s)`);
          }
        } else {
          toast.success(`Conectado sem mídia! (${Math.round(totalConnectionTime/1000)}s)`);
        }
        
      } catch (error) {
        console.error(`❌ Tentativa ${retryCount} falhou:`, error);
        
        if (retryCount < maxRetries) {
          // FASE 3: Limpeza e retry
          try {
            console.log(`🧹 Limpando antes da tentativa ${retryCount + 1}`);
            unifiedWebSocketService.disconnect();
            
            if (isMobile) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (cleanupError) {
            console.warn('⚠️ Erro durante limpeza:', cleanupError);
          }
          
          // FASE 3: Backoff exponencial
          const baseDelay = isMobile ? 3000 : 2000;
          const delay = Math.min(baseDelay * Math.pow(1.5, retryCount - 1), 15000);
          
          console.log(`🔄 Nova tentativa ${retryCount + 1}/${maxRetries} em ${Math.round(delay/1000)}s`);
          
          toast.warning(`Tentativa ${retryCount}/${maxRetries} falhou. Nova tentativa em ${Math.round(delay/1000)}s...`);
          
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
      console.error(`❌ Todas as tentativas falharam após ${Math.round(totalTime/1000)}s:`, error);
      
      setConnectionStatus('failed');
      
      // FASE 5: Relatório detalhado de erro
      let errorMessage = `Erro na conexão após ${maxRetries} tentativas (${Math.round(totalTime/1000)}s)`;
      
      if (error instanceof Error) {
        if (error.message.includes('Not in room')) {
          errorMessage = 'Erro: Sala não encontrada ou não está pronta para conexão';
          
          // FASE 3: Tentar criar sala em último caso
          toast.warning('Tentando criar sala como último recurso...');
          
          try {
            const created = await createRoomIfNeeded(sessionId);
            if (created) {
              toast.success('Sala criada com sucesso! Tente conectar novamente.');
              errorMessage += ' (Sala criada, tente novamente)';
            }
          } catch (e) {
            console.error('Falha ao criar sala de emergência:', e);
          }
        } else if (error.message.includes('timeout')) {
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
      toast.error(`${errorMessage}`);
      
      // FASE 5: Diagnóstico final
      console.log(`📊 DIAGNÓSTICO FINAL:`, {
        totalTentativas: connectionMetrics.attempts,
        tempoTotal: totalTime,
        ambiente: envInfo,
        mobile: isMobile,
        métricas: connectionMetrics,
        erro: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, participantId, isMobile]);

  const disconnectFromSession = useCallback(() => {
    console.log(`🔌 Desconectando da sessão ${sessionId}`);
    
    try {
      cleanupWebRTC();
      unifiedWebSocketService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast.success('Desconectado da sessão');
    } catch (error) {
      console.error(`❌ Erro ao desconectar:`, error);
      toast.error('Erro ao desconectar');
    }
  }, [sessionId]);

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
