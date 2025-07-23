
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { useIsMobile } from '@/hooks/use-mobile';
import { getEnvironmentInfo, validateURLConsistency } from '@/utils/connectionUtils';
import { webRTCDebugger } from '@/utils/webrtc/WebRTCDebugger';

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
    
    // CRITICAL: Log initial connection state
    webRTCDebugger.logEvent(
      sessionId,
      participantId,
      false,
      isMobile,
      'WEBSOCKET',
      'CONNECTION_ATTEMPT_START',
      { 
        hasStream: !!stream,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length,
        audioTracks: stream?.getAudioTracks().length
      }
    );
    
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

    // FASE 2: Enhanced retry configuration based on mobile/network
    const maxRetries = isMobile ? 10 : 7;
    const connectionMetrics = {
      startTime: Date.now(),
      attempts: 0,
      networkQuality: envInfo.urlMapping ? 'detected' : 'unknown'
    };
    
    let retryCount = 0;
    
    const attemptConnection = async (): Promise<void> => {
      connectionMetrics.attempts++;
      retryCount++;
      
      try {
        console.log(`🔄 ENHANCED Connection attempt ${retryCount}/${maxRetries} for participant ${participantId}`);
        console.log(`📊 CONNECTION METRICS:`, {
          attempt: retryCount,
          elapsedTime: Date.now() - connectionMetrics.startTime,
          mobile: isMobile,
          environment: envInfo.isLovable ? 'lovable' : envInfo.isLocalhost ? 'local' : 'production'
        });
        
        // CRITICAL: Log WebSocket connection attempt
        webRTCDebugger.logEvent(
          sessionId,
          participantId,
          false,
          isMobile,
          'WEBSOCKET',
          'WEBSOCKET_CONNECTION_ATTEMPT',
          { attempt: retryCount, maxRetries }
        );
        
        // Setup enhanced callbacks primeiro
        unifiedWebSocketService.setCallbacks({
          onConnected: () => {
            console.log('🔗 PARTICIPANT CONNECTION: WebSocket connected successfully');
            webRTCDebugger.logWebSocketConnection(sessionId, participantId, false, isMobile, true);
            setConnectionStatus('connected');
          },
          onDisconnected: () => {
            console.log('🔗 PARTICIPANT CONNECTION: WebSocket disconnected');
            webRTCDebugger.logWebSocketConnection(sessionId, participantId, false, isMobile, false);
            setConnectionStatus('disconnected');
            setIsConnected(false);
          },
          onConnectionFailed: (error) => {
            console.error('🔗 PARTICIPANT CONNECTION: WebSocket connection failed:', error);
            webRTCDebugger.logCriticalFailure(sessionId, participantId, false, isMobile, 'WEBSOCKET', error);
            setConnectionStatus('failed');
            setError('Falha na conexão WebSocket');
          }
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
        
        // CRITICAL: Log room join success
        webRTCDebugger.logRoomJoin(sessionId, participantId, false, isMobile, true);

        // FASE 2: Additional stabilization for mobile
        const webrtcDelay = isMobile ? 3000 : 1500;
        console.log(`⏱️ WEBRTC PREP: Waiting ${webrtcDelay}ms before WebRTC initialization`);
        await new Promise(resolve => setTimeout(resolve, webrtcDelay));

        // Etapa 3: Conectar WebRTC com timeouts otimizados
        console.log(`🔗 PARTICIPANT CONNECTION: Initializing WebRTC (attempt ${retryCount})`);
        
        // CRITICAL FIX: Ensure stream is passed correctly to WebRTC
        if (stream) {
          console.log(`🎥 CRITICAL: Stream being passed to WebRTC:`, {
            streamId: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            readyState: stream.getTracks().map(t => t.readyState),
            videoSettings: stream.getVideoTracks()[0]?.getSettings()
          });
          
          // CRITICAL: Log stream validation
          webRTCDebugger.logStreamSent(sessionId, participantId, false, isMobile, 'host', stream);
        } else {
          console.warn(`⚠️ CRITICAL: No stream being passed to WebRTC - this will cause handshake failure`);
          webRTCDebugger.logCriticalFailure(
            sessionId, 
            participantId, 
            false, 
            isMobile, 
            'WEBRTC', 
            new Error('No stream provided to WebRTC')
          );
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
          
          // CRITICAL: Log stream received
          webRTCDebugger.logStreamReceived(sessionId, participantId, false, isMobile, pId, incomingStream);
        });
        
        webrtc.setOnParticipantJoinCallback((pId: string) => {
          console.log(`👤 PARTICIPANT CONNECTION: Participant joined: ${pId}`);
          webRTCDebugger.logEvent(
            sessionId,
            participantId,
            false,
            isMobile,
            'WEBRTC',
            'PARTICIPANT_JOINED',
            { participantId: pId }
          );
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
          
          // CRITICAL: Notify stream started - THIS IS THE KEY TRIGGER
          console.log(`🚨 CRITICAL: About to notify stream started for ${participantId}`);
          webRTCDebugger.logStreamNotification(sessionId, participantId, false, isMobile, {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            videoSettings: stream.getVideoTracks()[0]?.getSettings()
          });
          
          // This should trigger the host to start the handshake
          unifiedWebSocketService.notifyStreamStarted(participantId, {
            streamId: stream.id,
            trackCount: stream.getTracks().length,
            hasVideo: stream.getVideoTracks().length > 0,
            hasAudio: stream.getAudioTracks().length > 0,
            isMobile,
            connectionType: 'participant',
            videoSettings: stream.getVideoTracks()[0]?.getSettings()
          });
          
          console.log(`🎯 CRITICAL: Stream notification sent to host - handshake should start now`);
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
        
        // CRITICAL: Log connection failure
        webRTCDebugger.logCriticalFailure(
          sessionId,
          participantId,
          false,
          isMobile,
          'WEBSOCKET',
          error as Error
        );
        
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
