import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import { useMeteredIntegration } from '@/hooks/live/useMeteredIntegration';
import { useMeteredParticipant } from '@/hooks/participant/useMeteredParticipant';

// Importar handshake do participante para registrar listeners
import '@/webrtc/handshake/ParticipantHandshake';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import StreamDebugPanel from '@/utils/debug/StreamDebugPanel';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { clearConnectionCache, validateURLConsistency } from '@/utils/connectionUtils';
import { clearDeviceCache, validateMobileCameraCapabilities } from '@/utils/media/deviceDetection';
import { streamLogger } from '@/utils/debug/StreamLogger';
import { initParticipantWebRTC } from '@/utils/webrtc';
import { toast } from 'sonner';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting MOBILE-FORCED render with ENHANCED camera validation');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Função para validar saúde do stream
  const validateStreamHealth = (stream: MediaStream): boolean => {
    if (!stream || !stream.active) return false;
    
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live' && t.enabled);
    const liveAudioTracks = audioTracks.filter(t => t.readyState === 'live' && t.enabled);
    
    return liveVideoTracks.length > 0; // Pelo menos um track de vídeo ativo
  };
  
  // Função para monitorar transmissão do stream 
  const setupStreamTransmissionMonitoring = (stream: MediaStream, pId: string) => {
    console.log(`PART-TRANSMISSION-MONITOR-START {participantId=${pId}, streamId=${stream.id}}`);
    
    // Monitorar tracks individuais
    stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.log(`PART-TRACK-ENDED {participantId=${pId}, trackKind=${track.kind}, trackId=${track.id}}`);
        toast.warning(`Track ${track.kind} finalizado`);
      });
      
      track.addEventListener('mute', () => {
        console.log(`PART-TRACK-MUTED {participantId=${pId}, trackKind=${track.kind}}`);
      });
      
      track.addEventListener('unmute', () => {
        console.log(`PART-TRACK-UNMUTED {participantId=${pId}, trackKind=${track.kind}}`);
      });
    });
    
    // Health check periódico
    const healthInterval = setInterval(() => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log(`PART-STREAM-HEALTH {participantId=${pId}, videoReady=${videoTrack.readyState}, trackState=${videoTrack.readyState}, muted=${videoTrack.muted}, enabled=${videoTrack.enabled}}`);
      } else {
        console.log(`PART-STREAM-HEALTH {participantId=${pId}, videoReady=no-track}`);
        clearInterval(healthInterval);
      }
    }, 3000);
    
    // Limpar quando stream for removido
    setTimeout(() => clearInterval(healthInterval), 60000); // 1 minuto máximo
  };
  
  // ENHANCED: Mobile-only guard with FORCE OVERRIDE support
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  console.log('🎯 PARTICIPANT PAGE: Enhanced mobile guard:', { isMobile, isValidated, isBlocked });
  
  // FASE 1: ESTABILIZAR participantId - usar sessionStorage para persistir entre re-renderizações
  const [participantId] = useState(() => {
    const storageKey = `participantId-${sessionId}`;
    const existingId = sessionStorage.getItem(storageKey);
    
    if (existingId) {
      console.log(`✅ FASE 1: Reusing existing participantId: ${existingId}`);
      return existingId;
    }
    
    const newId = `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, newId);
    console.log(`🆕 FASE 1: Created new stable participantId: ${newId}`);
    return newId;
  });
  
  // FASE 1: Monitoramento de estabilidade com useEffect
  useEffect(() => {
    // Detectar mudança de participantId para a mesma sessão
    const storageKey = `participantId-${sessionId}`;
    const storedId = sessionStorage.getItem(storageKey);
    
    if (storedId && storedId !== participantId) {
      console.error(`🚨 FASE 1: participantId INSTABILITY DETECTED!`);
      console.error(`Stored: ${storedId}`);
      console.error(`Current: ${participantId}`);
      console.error(`SessionId: ${sessionId}`);
      
      toast.error('⚠️ Detectada instabilidade no ID do participante');
      
      // Emit event para componentes se ajustarem
      window.dispatchEvent(new CustomEvent('participant-id-stability-breach', {
        detail: {
          oldId: participantId,
          stableId: storedId,
          sessionId
        }
      }));
    }
  }, [participantId, sessionId]);
  
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  // PROPAGAÇÃO: participantId único passado para todos os hooks
  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia(participantId);
  
  // CORREÇÃO FASE 1: Detecção simplificada e exclusiva Metered vs WebSocket
  const meteredConfig = useMeteredIntegration();
  const urlParams = new URLSearchParams(window.location.search);
  const isMeteredRoute = window.location.pathname.includes('/participant/metered/');
  const forceMetered = urlParams.get('useMetered') === 'true';
  
  // DECISÃO EXCLUSIVA: Metered OU WebSocket, nunca ambos
  const useMeteredForThisSession = meteredConfig.useMetered && (isMeteredRoute || forceMetered);
  const useWebSocketForThisSession = !useMeteredForThisSession; // Exclusivo
  
  console.log('🔧 PARTICIPANT PAGE: EXCLUSIVE connection method detection', {
    isMeteredRoute,
    forceMetered,
    useMeteredForThisSession,
    useWebSocketForThisSession,
    pathname: window.location.pathname,
    sessionId,
    meteredEnabled: meteredConfig.useMetered
  });
  
  // Extrair room name da URL se for rota Metered
  const roomNameFromPath = isMeteredRoute ? 
    window.location.pathname.split('/participant/metered/')[1] : 
    `${meteredConfig.roomNamePrefix}${sessionId || ''}`;
  
  // CORREÇÃO: Só inicializar Metered se realmente for usar
  const meteredParticipant = useMeteredParticipant({
    roomName: useMeteredForThisSession ? roomNameFromPath : '', // Vazio desabilita o hook
    accountDomain: useMeteredForThisSession ? meteredConfig.accountDomain : '', 
    onConnectionChange: (connected: boolean) => {
      console.log('✅ Metered connection status:', connected);
      if (connected) {
        toast.success('🎯 Conectado via Metered Rooms');
        // Desabilitar tentativas WebSocket quando Metered conectar
        console.log('🚫 Metered conectado - desabilitando WebSocket');
      }
    }
  });

  // Enhanced URL consistency validation with mobile override detection
  useEffect(() => {
    console.log('🔍 PARTICIPANT PAGE: Enhanced URL validation with FORCE OVERRIDE detection');
    
    // Log page initialization
    streamLogger.log(
      'STREAM_START' as any,
      participantId,
      isMobile,
      isMobile ? 'mobile' : 'desktop',
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'PAGE_INIT',
      'Participant page initialized',
      { sessionId, userAgent: navigator.userAgent }
    );
    
    clearConnectionCache();
    clearDeviceCache();
    
    const isConsistent = validateURLConsistency();
    if (!isConsistent) {
      console.warn('⚠️ PARTICIPANT PAGE: URL inconsistency detected - could affect camera');
      streamLogger.log(
        'VALIDATION' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'URL_VALIDATION',
        'URL inconsistency detected',
        { currentUrl: window.location.href }
      );
    }
    
    // FASE 1: Enhanced parameter detection and storage
    const urlParams = new URLSearchParams(window.location.search);
    const forceMobile = urlParams.get('forceMobile') === 'true' || urlParams.get('mobile') === 'true';
    const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
    const hasCameraParam = urlParams.get('camera') === 'environment' || urlParams.get('camera') === 'user';
    const isParticipantRoute = window.location.pathname.includes('/participant/');
    
    // Store all mobile indicators
    if (forceMobile || hasQRParam || hasCameraParam || isParticipantRoute) {
      sessionStorage.setItem('accessedViaQR', 'true');
      sessionStorage.setItem('forcedMobile', 'true');
      sessionStorage.setItem('mobileValidated', 'true');
      
      console.log('✅ PARTICIPANT PAGE: Mobile FORCE OVERRIDE activated and stored');
      console.log('✅ Override indicators:', {
        forceMobile,
        hasQRParam,
        hasCameraParam,
        isParticipantRoute,
        cameraMode: urlParams.get('camera')
      });
      
      streamLogger.log(
        'VALIDATION' as any,
        participantId,
        true, // Force mobile
        'mobile',
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'MOBILE_OVERRIDE',
        'Mobile force override activated',
        { forceMobile, hasQRParam, hasCameraParam, isParticipantRoute }
      );
      
      toast.success('📱 Modo móvel forçado - câmera do celular será ativada');
    }
    
    // Enhanced environment logging
    console.log('🌐 PARTICIPANT PAGE: Enhanced environment check:', {
      currentURL: window.location.href,
      expectedDomain: 'hutz-live-85.onrender.com',
      isDomainCorrect: window.location.href.includes('hutz-live-85.onrender.com'),
      forceParameters: {
        forceMobile,
        hasQR: hasQRParam,
        hasCameraParam,
        cameraMode: urlParams.get('camera'),
        isParticipantRoute
      },
      mobileOverrideActive: forceMobile || hasQRParam || hasCameraParam || isParticipantRoute
    });
    
    // Check for debug mode
    const debugMode = urlParams.get('debug') === 'true';
    if (debugMode) {
      setShowDebugPanel(true);
      streamLogger.log(
        'VALIDATION' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'DEBUG_MODE',
        'Debug mode activated'
      );
    }
    
  }, [participantId, isMobile]);

  // Monitor signaling service status
  useEffect(() => {
    const checkSignalingStatus = () => {
      const status = unifiedWebSocketService.getConnectionStatus();
      setSignalingStatus(status);
    };

    const interval = setInterval(checkSignalingStatus, 1000);
    checkSignalingStatus();

    return () => clearInterval(interval);
  }, []);

  // CORREÇÃO FASE 2: Initialize media baseado no método de conexão EXCLUSIVO
  useEffect(() => {
    if (!isValidated || isBlocked || !sessionId) {
      console.log('🚫 PARTICIPANT PAGE: Skipping auto-connect - mobile validation failed');
      return;
    }
    
    console.log('🚀 PARTICIPANT PAGE: EXCLUSIVE route load for session:', sessionId);
    console.log('📋 CONNECTION METHOD:', {
      useMetered: useMeteredForThisSession,
      useWebSocket: useWebSocketForThisSession,
      method: useMeteredForThisSession ? 'METERED_ONLY' : 'WEBSOCKET_ONLY'
    });
    
    streamLogger.log(
      'STREAM_START' as any,
      participantId,
      isMobile,
      isMobile ? 'mobile' : 'desktop',
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'AUTO_CONNECT',
      'Auto-connecting to mobile session',
      { sessionId }
    );
    
    autoConnectToMobileSession().catch(error => {
      console.error('❌ PARTICIPANT: Failed to auto-connect mobile session:', error);
      streamLogger.logStreamError(participantId, isMobile, isMobile ? 'mobile' : 'desktop', error as Error, 0);
      toast.error('Falha ao conectar câmera móvel automaticamente');
    });
    
    return () => {
      try {
        media.cleanup();
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
        streamLogger.logStreamError(participantId, isMobile, isMobile ? 'mobile' : 'desktop', error as Error, 0);
      }
    };
  }, [sessionId, isValidated, isBlocked, participantId, isMobile, useMeteredForThisSession, useWebSocketForThisSession]);

  const autoConnectToMobileSession = async () => {
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    try {
      console.log('📱 PARTICIPANT: Starting MOBILE-FORCED auto-connection with camera validation');
      console.log('🎯 Metered Integration:', meteredConfig);
      
      streamLogger.log(
        'STREAM_START' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'AUTO_CONNECT_MOBILE',
        'Starting mobile auto-connection with validation'
      );

      // Verificar se deve usar Metered
      if (useMeteredForThisSession) {
        console.log('🎯 Usando Metered Rooms para participante...');
        console.log('🏢 Room Name:', roomNameFromPath);
        console.log('🔗 Account Domain:', meteredConfig.accountDomain);
        await meteredParticipant.connectAndPublish();
        return;
      }
      
      // FASE 3: Validate mobile camera capabilities first (fluxo tradicional)
      const hasValidCamera = await validateMobileCameraCapabilities();
      if (hasValidCamera) {
        console.log('✅ PARTICIPANT: Mobile camera capabilities validated');
        streamLogger.logValidation(participantId, isMobile, deviceType, true, {
          reason: 'mobile_camera_capabilities_validated'
        });
        toast.success('📱 Câmera móvel validada - iniciando conexão');
      } else {
        console.log('⚠️ PARTICIPANT: Camera validation inconclusive - proceeding anyway');
        streamLogger.logValidation(participantId, isMobile, deviceType, false, {
          reason: 'camera_validation_inconclusive',
          action: 'proceeding_anyway'
        });
        toast.warning('⚠️ Validação de câmera inconclusiva - tentando conectar');
      }
      
      // SINGLE MEDIA INITIALIZATION - Get stream once and reuse
      console.log('📱 PARTICIPANT: Initializing camera stream...');
      const stream = await media.initializeMedia();
      
      // Validar stream após obtenção
      if (stream) {
        const isStreamValid = validateStreamHealth(stream);
        console.log(`PART-STREAM-VALIDATION {valid=${isStreamValid}, streamId=${stream.id}}`);
        
        if (!isStreamValid) {
          console.warn('⚠️ PARTICIPANT: Stream health validation failed');
          toast.warning('⚠️ Stream obtido mas com problemas de saúde');
        }
        
        // CRITICAL: Set this stream globally for handshake reuse
        (window as any).__participantSharedStream = stream;
        console.log('✅ PARTICIPANT: Stream shared globally for handshake reuse');
      }
      
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          console.log('📱 PARTICIPANT: Mobile camera stream verified:', {
            facingMode: settings.facingMode,
            width: settings.width,
            height: settings.height,
            deviceId: settings.deviceId?.substring(0, 20),
            isMobileCamera: settings.facingMode === 'environment' || settings.facingMode === 'user',
            isForced: sessionStorage.getItem('forcedMobile') === 'true'
          });
          
          streamLogger.logValidation(participantId, isMobile, deviceType, true, {
            reason: 'mobile_camera_stream_verified',
            settings
          });
          
          // Validate we got mobile camera
          if (settings.facingMode) {
            console.log('✅ PARTICIPANT: MOBILE CAMERA CONFIRMED with facingMode:', settings.facingMode);
            toast.success(`📱 Câmera ${settings.facingMode === 'environment' ? 'traseira' : 'frontal'} ativada!`);
            
            // Store confirmed mobile camera
            sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
            
            streamLogger.logValidation(participantId, isMobile, deviceType, true, {
              reason: 'mobile_camera_confirmed',
              facingMode: settings.facingMode
            });
          } else {
            console.warn('⚠️ PARTICIPANT: Camera may not be mobile - no facingMode detected');
            toast.warning('⚠️ Câmera ativada mas tipo não confirmado');
            
            streamLogger.logValidation(participantId, isMobile, deviceType, false, {
              reason: 'no_facing_mode_detected',
              warning: true
            });
          }
        }
      } else {
        console.warn('⚠️ PARTICIPANT: No stream obtained - entering degraded mode');
        streamLogger.log(
          'STREAM_ERROR' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0, errorType: 'NO_STREAM_DEGRADED' },
          undefined,
          'AUTO_CONNECT_MOBILE',
          'No stream obtained - entering degraded mode'
        );
        toast.error('❌ Falha ao obter stream da câmera - modo degradado');
      }
      
      // Connect sempre, mesmo em modo degradado
      await connection.connectToSession(stream);
      
      // CORREÇÃO FASE 3: Condicionalmente inicializar WebRTC apenas se não for Metered
      if (useWebSocketForThisSession && stream) {
        console.log('🔗 PARTICIPANT: Iniciando WebRTC handshake (modo WebSocket)...');
        
        // FASE 2: Enhanced stream validation and mobile browser compatibility
        console.log('🔍 [PART] Enhanced stream validation before WebRTC handshake');
        
        // Validate stream is ready for WebRTC
        const trackStates = stream.getTracks().map(track => ({
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        }));
        
        console.log('📊 [PART] Stream tracks before WebRTC:', trackStates);
        
        // Mobile Browser Compatibility Check
        console.log('📱 [PART] Mobile browser compatibility check');
        
        const userAgent = navigator.userAgent;
        const isMobileBrowser = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
        const isChrome = /Chrome/i.test(userAgent);
        const isFirefox = /Firefox/i.test(userAgent);
        
        console.log(`📱 [PART] Browser detection:`, {
          isMobileBrowser,
          isSafari,
          isChrome,
          isFirefox,
          userAgent: userAgent.substring(0, 100)
        });
        
        streamLogger.logValidation(participantId, isMobile, deviceType, true, {
          reason: 'browser_compatibility_check',
          browserInfo: { isMobileBrowser, isSafari, isChrome, isFirefox }
        });
        
        // Adicionar delay extra para Safari móvel
        if (isSafari && isMobileBrowser) {
          console.log('🦁 [PART] Safari móvel detectado - delay adicional');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Dispatch stream ready event
        window.dispatchEvent(new CustomEvent('participant-stream-ready', {
          detail: {
            participantId,
            stream,
            validated: true, // CORREÇÃO: sempre true após validação
            browserCompatible: isMobileBrowser
          }
        }));
        
        // Monitoring do stream durante transmissão
        setupStreamTransmissionMonitoring(stream, participantId);
        
        console.log('🤝 [PART] Disparando WebRTC handshake...');
        
        // FASE 2: Ensure WebRTC gets stable stream
        try {
          const { webrtc } = await initParticipantWebRTC(sessionId, participantId, stream);
          
          console.log('🎉 [PART] WebRTC handshake completed successfully');
          
          streamLogger.log(
            'STREAM_CONNECTED' as any,
            participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: Date.now() - (window as any).__connectionStartTime || 0 },
            stream,
            'WEBRTC_HANDSHAKE',
            'WebRTC handshake completed successfully'
          );
          
          // Setup callbacks for enhanced monitoring
          webrtc.setOnStreamCallback((pId: string, incomingStream: MediaStream) => {
            console.log(`🎥 [PART] Stream received from ${pId}`);
            streamLogger.log(
              'STREAM_RECEIVED' as any,
              participantId,
              isMobile,
              deviceType,
              { timestamp: Date.now(), duration: 0 },
              incomingStream,
              'WEBRTC_CALLBACK',
              `Stream received from ${pId}`
            );
          });
          
          webrtc.setOnParticipantJoinCallback((pId: string) => {
            console.log(`👤 [PART] Participant joined: ${pId}`);
          });
          
          toast.success('🤝 Handshake WebRTC concluído com sucesso!');
          
        } catch (handshakeError) {
          console.error('❌ [PART] WebRTC handshake failed:', handshakeError);
          streamLogger.logStreamError(participantId, isMobile, deviceType, handshakeError as Error, 0);
          toast.error('❌ Falha no handshake WebRTC');
          throw handshakeError;
        }
      } else if (useMeteredForThisSession) {
        console.log('✅ PARTICIPANT: Usando APENAS Metered - WebRTC tradicional desabilitado');
        toast.success('🎯 Conectado via Metered Rooms apenas');
      } else {
        console.log('⚠️ PARTICIPANT: Nenhum método de conexão ativo');
        toast.warning('⚠️ Método de conexão não definido');
      }
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Auto-connect failed:', error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      toast.error('❌ Falha na conexão automática');
    }
  };

  // CORREÇÃO FASE 4: Handle connect apenas se for WebSocket (não Metered)
  const handleConnect = async () => {
    console.log('🔗 PARTICIPANT: Manual connect initiated');
    
    // Verificar se foi bloqueado ou deve usar Metered
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Access blocked - returning');
      toast.error('❌ Acesso não autorizado para este dispositivo');
      return;
    }
    
    if (useMeteredForThisSession) {
      console.log('🎯 PARTICIPANT: Connecting via Metered instead of WebSocket...');
      try {
        await meteredParticipant.connectAndPublish();
        toast.success('🎯 Conectado via Metered Rooms');
      } catch (error) {
        console.error('❌ PARTICIPANT: Metered connection failed:', error);
        toast.error('❌ Falha na conexão Metered');
      }
      return;
    }
    
    // WebSocket connection logic
    try {
      console.log('📱 PARTICIPANT: Starting WebSocket connection initialization');
      
      // Initialize stream if not already available
      let stream = media.localStream;
      if (!stream) {
        console.log('🎥 PARTICIPANT: No existing stream - initializing media');
        stream = await media.initializeMedia();
      }
      
      if (stream && validateStreamHealth(stream)) {
        console.log('✅ PARTICIPANT: Stream validated - proceeding with connection');
        await connection.connectToSession(stream);
        
        streamLogger.log(
          'STREAM_CONNECTED' as any,
          participantId,
          isMobile,
          isMobile ? 'mobile' : 'desktop',
          { timestamp: Date.now(), duration: 0 },
          stream,
          'MANUAL_CONNECT',
          'Manual connection completed successfully'
        );
        
        toast.success('📱 Conectado com sucesso!');
      } else {
        console.warn('⚠️ PARTICIPANT: Stream validation failed - attempting degraded connection');
        await connection.connectToSession(null);
        
        streamLogger.log(
          'STREAM_ERROR' as any,
          participantId,
          isMobile,
          isMobile ? 'mobile' : 'desktop',
          { timestamp: Date.now(), duration: 0, errorType: 'DEGRADED_CONNECTION' },
          undefined,
          'MANUAL_CONNECT',
          'Manual connection attempted without valid stream'
        );
        
        toast.warning('⚠️ Conectado em modo degradado - sem vídeo');
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
      streamLogger.logStreamError(participantId, isMobile, isMobile ? 'mobile' : 'desktop', error as Error, 0);
      toast.error('❌ Falha na conexão manual');
    }
  };

  // CORREÇÃO FASE 5: Retry media apenas se for WebSocket
  const handleRetryMedia = async () => {
    console.log('🔄 PARTICIPANT: Retry media initiated');
    
    if (useMeteredForThisSession) {
      console.log('🎯 PARTICIPANT: Retying Metered connection...');
      try {
        await meteredParticipant.republish();
        toast.success('🔄 Reconexão Metered realizada');
      } catch (error) {
        console.error('❌ PARTICIPANT: Metered retry failed:', error);
        toast.error('❌ Falha na reconexão Metered');
      }
      return;
    }
    
    // WebSocket retry logic
    try {
      console.log('🔄 PARTICIPANT: Clearing media cache and re-initializing');
      
      // Clear any cached media state
      media.cleanup();
      clearDeviceCache();
      
      streamLogger.log(
        'STREAM_RETRY' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'MEDIA_RETRY',
        'Media retry initiated - clearing cache'
      );
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Re-initialize media
      console.log('🎥 PARTICIPANT: Re-initializing media stream');
      const stream = await media.initializeMedia();
      
      if (stream && validateStreamHealth(stream)) {
        console.log('✅ PARTICIPANT: Media re-initialized successfully');
        
        // Try to reconnect with new stream
        await connection.connectToSession(stream);
        
        streamLogger.log(
          'STREAM_RETRY_SUCCESS' as any,
          participantId,
          isMobile,
          isMobile ? 'mobile' : 'desktop',
          { timestamp: Date.now(), duration: 0 },
          stream,
          'MEDIA_RETRY',
          'Media retry successful - reconnected'
        );
        
        toast.success('🔄 Mídia reinicializada e reconectada!');
      } else {
        console.warn('⚠️ PARTICIPANT: Media retry failed - no valid stream');
        streamLogger.log(
          'STREAM_RETRY_FAILED' as any,
          participantId,
          isMobile,
          isMobile ? 'mobile' : 'desktop',
          { timestamp: Date.now(), duration: 0, errorType: 'NO_VALID_STREAM' },
          undefined,
          'MEDIA_RETRY',
          'Media retry failed - no valid stream obtained'
        );
        
        toast.error('❌ Falha ao reinicializar mídia');
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Media retry failed:', error);
      streamLogger.logStreamError(participantId, isMobile, isMobile ? 'mobile' : 'desktop', error as Error, 0);
      toast.error('❌ Falha na reinicialização da mídia');
    }
  };

  // Loading screen while mobile validation is in progress
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-white mt-4">Validando dispositivo móvel...</p>
        </div>
      </div>
    );
  }

  // Blocked screen
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-black flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">
            🚫 Acesso Restrito
          </h1>
          <p className="text-red-200 mb-6">
            Esta página está restrita a dispositivos móveis. Por favor, acesse através do seu smartphone ou tablet.
          </p>
          <p className="text-red-300 text-sm">
            Se você está usando um dispositivo móvel e ainda vê esta mensagem, tente escanear o QR code novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        <ParticipantHeader 
          sessionId={sessionId || ''} 
          participantId={participantId}
        />
        
        <ParticipantErrorDisplay
          error={connection.error}
          isConnecting={connection.isConnecting}
          onRetryConnect={handleConnect}
          onRetryMedia={handleRetryMedia}
        />
        
        <ParticipantConnectionStatus
          isConnected={connection.isConnected}
          isConnecting={connection.isConnecting}
          connectionStatus={connection.connectionStatus}
          signalingStatus={signalingStatus}
        />
        
        <ParticipantVideoPreview
          stream={media.localStream}
          participantId={participantId}
          isLoading={media.isInitializing}
          error={media.mediaError}
        />
        
        <ParticipantControls
          isConnected={connection.isConnected}
          isConnecting={connection.isConnecting}
          onConnect={handleConnect}
          stream={media.localStream}
          participantId={participantId}
        />
        
        <ParticipantInstructions />
        
        {/* Enhanced Mobile Status Debug */}
        {showDebugPanel && (
          <div className="mt-4 p-3 bg-green-500/10 rounded border border-green-500/20">
            <p className="text-green-300 text-xs">
              📱 Status: {isMobile ? '✅ Móvel' : '❌ Desktop'} | 
              Validado: {isValidated ? '✅' : '❌'} | 
              Bloqueado: {isBlocked ? '❌' : '✅'}
            </p>
            <p className="text-green-200 text-xs mt-1">
              🎯 ParticipantId: {participantId.substring(0, 20)}...
            </p>
            <p className="text-green-200 text-xs mt-1">
              📹 Câmera: {media.localStream ? 
                        `✅ ${media.localStream.getVideoTracks().length} tracks` : 
                        '❌ Sem stream'}
            </p>
            <p className="text-green-200 text-xs mt-1">
              🔄 Modo Câmera: {
                        media.localStream?.getVideoTracks()[0]?.getSettings()?.facingMode || 
                        'Detectando...'}
            </p>
            <p className="text-green-100 text-xs mt-1">
              🔧 Forçado: {sessionStorage.getItem('forcedMobile') === 'true' ? 'SIM' : 'NÃO'}
            </p>
            <p className="text-green-100 text-xs mt-1">
              🎯 Método: {useMeteredForThisSession ? 'METERED' : 'WEBSOCKET'}
            </p>
          </div>
        )}
        
        {/* Enhanced URL Debug Info */}
        <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <p className="text-blue-300 text-xs">
            🌐 URL: {window.location.href.includes('hutz-live-85.onrender.com') ? '✅ Produção' : '⚠️ Desenvolvimento'}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            🔧 Parâmetros: {new URLSearchParams(window.location.search).toString() || 'Nenhum'}
          </p>
          <p className="text-blue-100 text-xs mt-1">
            🐛 Debug: 
            <button 
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="ml-1 text-blue-400 hover:text-blue-300 underline"
            >
              {showDebugPanel ? 'Fechar' : 'Abrir'} Painel
            </button>
          </p>
        </div>
      </div>
      
      {/* Debug Panel */}
      <StreamDebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </div>
  );
};

export default ParticipantPage;