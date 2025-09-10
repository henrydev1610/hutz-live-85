
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';

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

  // ROUTE LOAD: Initialize media immediately when route loads
  useEffect(() => {
    if (!isValidated || isBlocked || !sessionId) {
      console.log('🚫 PARTICIPANT PAGE: Skipping auto-connect - mobile validation failed');
      return;
    }
    
    console.log('🚀 PARTICIPANT PAGE: Route load - starting auto-connect for session:', sessionId);
    
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
  }, [sessionId, isValidated, isBlocked, participantId, isMobile]);

  const autoConnectToMobileSession = async () => {
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    try {
      console.log('📱 PARTICIPANT: Starting MOBILE-FORCED auto-connection with camera validation');
      
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
      
      // FASE 3: Validate mobile camera capabilities first
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
      
      // ÚNICO PONTO: notifyStreamStarted será chamado pelo UnifiedWebRTCManager
      
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
      
      // FASE 2: Aguardar preview ativo ANTES do WebRTC handshake
      console.log(`🎬 [PART] Waiting for preview to be active before WebRTC handshake`);
      
      const waitForActivePreview = async (): Promise<boolean> => {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⏰ [PART] Timeout waiting for preview - proceeding anyway');
            resolve(false);
          }, 5000); // 5s timeout

          const checkPreviewActive = () => {
            const previewVideo = document.querySelector('video[data-participant-id="local-preview"]') as HTMLVideoElement;
            
            if (previewVideo && previewVideo.srcObject && !previewVideo.paused) {
              console.log('✅ [PART] Preview is active and playing');
              clearTimeout(timeout);
              resolve(true);
              return;
            }
            
            setTimeout(checkPreviewActive, 200); // Check every 200ms
          };

          // Listen for preview active event
          const handlePreviewActive = () => {
            console.log('✅ [PART] Preview active event received');
            clearTimeout(timeout);
            window.removeEventListener('participant-preview-active', handlePreviewActive);
            resolve(true);
          };

          window.addEventListener('participant-preview-active', handlePreviewActive);
          checkPreviewActive(); // Start checking immediately
        });
      };

      const previewReady = await waitForActivePreview();
      
      if (previewReady) {
        console.log('✅ [PART] Preview confirmed active - starting WebRTC handshake');
      } else {
        console.warn('⚠️ [PART] Preview not confirmed active - proceeding with handshake anyway');
      }

      // HANDSHAKE: Único caminho limpo
      console.log(`🤝 [PART] Initiating WebRTC handshake with participantId: ${participantId}`);
      
      // Aguardar estabilização da conexão WebSocket
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const hostId = connection.getHostId();
        if (hostId && stream) {
          console.log(`🎯 [PART] Host detected: ${hostId}, starting handshake`);
          
          // PRE-WEBRTC STREAM VALIDATION
          const validateStreamForWebRTCLocal = async (stream: MediaStream): Promise<boolean> => {
            const videoTrack = stream.getVideoTracks()[0];
            if (!videoTrack) {
              console.error('❌ [VALIDATION] No video track available for WebRTC');
              return false;
            }

            // Check track state
            if (videoTrack.readyState !== 'live') {
              console.error('❌ [VALIDATION] Video track is not live:', videoTrack.readyState);
              return false;
            }

            // Check if track is muted (no frames)
            if (videoTrack.muted) {
              console.warn('⚠️ [VALIDATION] Video track is muted - attempting recovery');
              
              // Try to recover before WebRTC
              const recovered = await media.recoverVideoTrack?.('pre-webrtc validation failed');
              if (!recovered) {
                console.error('❌ [VALIDATION] Track recovery failed');
                return false;
              }
              
              // Validate recovered stream
              const newStream = (window as any).__participantSharedStream;
              const newVideoTrack = newStream?.getVideoTracks()[0];
              if (!newVideoTrack || newVideoTrack.muted) {
                console.error('❌ [VALIDATION] Recovered track still muted');
                return false;
              }
            }

            // CRITICAL: Validate track is NOT muted and producing frames
            console.log('⏳ [VALIDATION] Validating track health and frame production...');
            return new Promise(async (resolve) => {
              const videoTrack = stream.getVideoTracks()[0];
              
              // FIRST: Check if track is muted (immediate fail)
              if (videoTrack.muted) {
                console.error('❌ [VALIDATION] Track is MUTED - cannot proceed with WebRTC');
                resolve(false);
                return;
              }
              
              // SECOND: Check readyState
              if (videoTrack.readyState !== 'live') {
                console.error('❌ [VALIDATION] Track readyState is not live:', videoTrack.readyState);
                resolve(false);
                return;
              }
              
              // THIRD: Try to play video and check dimensions
              const video = document.createElement('video');
              video.srcObject = stream;
              video.muted = true;
              video.playsInline = true;
              
              const timeout = setTimeout(() => {
                console.warn('⚠️ [VALIDATION] Frame validation timeout');
                video.remove();
                resolve(false);
              }, 5000);

              video.onloadedmetadata = async () => {
                try {
                  // Force play to ensure frames are flowing
                  await video.play();
                  
                  const hasRealFrames = video.videoWidth > 2 && video.videoHeight > 2;
                  const isPlaying = !video.paused && !video.ended && video.readyState > 2;
                  
                  console.log(`📏 [VALIDATION] Video validation:`, {
                    dimensions: `${video.videoWidth}x${video.videoHeight}`,
                    hasRealFrames,
                    isPlaying,
                    trackMuted: videoTrack.muted,
                    trackEnabled: videoTrack.enabled,
                    trackReady: videoTrack.readyState
                  });
                  
                  clearTimeout(timeout);
                  video.remove();
                  
                  // Only pass if we have real frames AND track is not muted
                  const isValid = hasRealFrames && isPlaying && !videoTrack.muted && videoTrack.enabled;
                  resolve(isValid);
                  
                } catch (playError) {
                  console.error('❌ [VALIDATION] Failed to play video:', playError);
                  clearTimeout(timeout);
                  video.remove();
                  resolve(false);
                }
              };

              video.onerror = () => {
                console.error('❌ [VALIDATION] Video validation error');
                clearTimeout(timeout);
                video.remove();
                resolve(false);
              };
            });
          };

          // FASE 1-4: Enhanced validation and mobile compatibility
          const { validateStreamForWebRTC } = await import('@/utils/media/streamValidation');
          const { MobileBrowserCompatibility } = await import('@/utils/media/MobileBrowserCompatibility');
          
          console.log('🔍 FASE 1-4: Starting enhanced stream validation and compatibility checks');
          
          // FASE 3: Apply mobile browser compatibility
          const browserInfo = MobileBrowserCompatibility.detectBrowser();
          await MobileBrowserCompatibility.applyPreStreamWorkarounds(browserInfo, participantId);
          
          // FASE 3: Apply post-stream workarounds
          const compatibleStream = await MobileBrowserCompatibility.applyPostStreamWorkarounds(stream, browserInfo, participantId);
          
          // FASE 2: Enhanced validation with muted track support
          const isStreamValid = validateStreamForWebRTC(compatibleStream);
          if (!isStreamValid) {
            console.error('❌ [PART] Enhanced stream validation failed - attempting recovery');
            toast.error('❌ Validação de vídeo falhou - tentando recuperação...');
            
            // Try media retry and validate again
            await media.retryMediaInitialization();
            const retryStream = media.localStreamRef.current;
            if (retryStream) {
              const retryCompatibleStream = await MobileBrowserCompatibility.applyPostStreamWorkarounds(retryStream, browserInfo, participantId);
              const retryValid = validateStreamForWebRTC(retryCompatibleStream);
              if (!retryValid) {
                console.error('❌ [PART] Enhanced validation failed even after retry');
                toast.error('❌ Falha na recuperação do vídeo');
                return;
              }
              // Update global shared stream with validated retry stream
              (window as any).__participantSharedStream = retryCompatibleStream;
              
              // Use retry stream for WebRTC handshake
              const finalStream = retryStream;
              const { webrtc } = await initParticipantWebRTC(sessionId!, participantId, finalStream);
              if (webrtc) {
                webrtc.setLocalStream(finalStream);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await webrtc.connectToHost();
                console.log(`✅ [PART] Handshake completed with retry stream: ${participantId}`);
                toast.success('🤝 Handshake WebRTC iniciado com sucesso após retry!');
              }
              return;
            } else {
              return;
            }
          }

          console.log('✅ [VALIDATION] Stream validated successfully for WebRTC');
          const activeTracks = stream.getTracks().filter(t => t.readyState === 'live' && t.enabled);
          const videoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live' && t.enabled);
          
          console.log(`🔍 [PART] Track health check:`, {
            totalTracks: stream.getTracks().length,
            activeTracks: activeTracks.length,
            activeVideoTracks: videoTracks.length,
            trackDetails: stream.getTracks().map(t => ({
              kind: t.kind,
              readyState: t.readyState,
              enabled: t.enabled,
              muted: t.muted
            }))
          });
          
          if (activeTracks.length === 0) {
            console.warn(`⚠️ [PART] No active tracks in stream`);
            toast.warning('⚠️ Stream sem tracks ativos');
          } else if (videoTracks.length === 0) {
            console.warn(`⚠️ [PART] No active video tracks in stream`);
            toast.warning('⚠️ Stream sem vídeo ativo');
          } else {
            setupStreamTransmissionMonitoring(stream, participantId);
            console.log(`✅ [PART] Stream validated with ${videoTracks.length} video tracks ready for handshake`);
          }
          
          // FASE 4: AGUARDAR PREVIEW REPRODUZINDO ANTES DE WebRTC
          const videoElement = media.localVideoRef.current;
          if (videoElement) {
            // Verificar se preview está reproduzindo
            let previewReady = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              if (!videoElement.paused && videoElement.srcObject === stream) {
                previewReady = true;
                console.log(`✅ [PART] Preview confirmed playing after ${attempt + 1} checks`);
                break;
              }
              console.log(`⏳ [PART] Waiting for preview to play... attempt ${attempt + 1}/10`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (!previewReady) {
              console.warn('⚠️ [PART] Preview not playing, but proceeding with handshake');
            }
          }
          
          // ÚNICO CAMINHO: initParticipantWebRTC → setLocalStream → connectToHost
          const { webrtc } = await initParticipantWebRTC(sessionId!, participantId, stream);
          if (webrtc) {
            // Ensure the same stream is used consistently
            webrtc.setLocalStream(stream);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await webrtc.connectToHost();
            console.log(`✅ [PART] Handshake completed: ${participantId}`);
            toast.success('🤝 Handshake WebRTC iniciado com sucesso!');
          }
        } else if (!hostId) {
          console.warn(`⚠️ [PART] Host not detected for: ${participantId}`);
          toast.info('⏳ Aguardando host ficar disponível...');
        } else {
          console.warn(`⚠️ [PART] No stream available for handshake: ${participantId}`);
          toast.warning('⚠️ Sem stream disponível');
        }
      } catch (error) {
        console.error(`❌ [PART] Handshake failed for ${participantId}:`, error);
        toast.error(`❌ Falha no handshake: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    } catch (error) {
      console.error(`❌ [PART] Auto-connection failed for ${participantId}:`, error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha na conexão móvel: ${errorMsg}`);
    }
  };

  const handleConnect = async () => {
    if (isBlocked) {
      console.log(`🚫 [PART] Connection blocked for: ${participantId}`);
      streamLogger.log(
        'STREAM_ERROR' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0, errorType: 'CONNECTION_BLOCKED' },
        undefined,
        'CONNECT_MANUAL',
        'Connection blocked - mobile validation failed'
      );
      toast.error('🚫 Conexão bloqueada - dispositivo não validado como móvel');
      return;
    }
    
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    try {
      streamLogger.log(
        'STREAM_START' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'CONNECT_MANUAL',
        'Manual connection initiated'
      );
      
      let stream = media.localStreamRef.current;
      if (!stream) {
        console.log('📱 PARTICIPANT: Initializing mobile camera for manual connection');
        toast.info('📱 Inicializando câmera móvel...');
        stream = await media.initializeMedia();
      }
      
      await connection.connectToSession(stream);
      toast.success('✅ Conectado com sucesso!');
      
      streamLogger.log(
        'STREAM_SUCCESS' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'CONNECT_MANUAL',
        'Manual connection successful'
      );
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual mobile connection failed:', error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha na conexão manual: ${errorMsg}`);
    }
  };

  const handleRetryMedia = async () => {
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Media retry blocked - mobile validation failed');
      streamLogger.log(
        'STREAM_ERROR' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0, errorType: 'RETRY_BLOCKED' },
        undefined,
        'RETRY_MEDIA',
        'Media retry blocked - mobile validation failed'
      );
      toast.error('🚫 Retry bloqueado - dispositivo não validado como móvel');
      return;
    }
    
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    try {
      console.log('🔄 PARTICIPANT: Retrying MOBILE camera with enhanced detection');
      streamLogger.log(
        'STREAM_START' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'RETRY_MEDIA',
        'Retrying mobile camera with enhanced detection'
      );
      
      toast.info('🔄 Tentando novamente câmera móvel...');
      
      await media.retryMediaInitialization();
      const stream = media.localStreamRef.current;
      if (stream && connection.isConnected) {
        await connection.disconnectFromSession();
        await connection.connectToSession(stream);
        toast.success('✅ Câmera reconectada com sucesso!');
        
        streamLogger.log(
          'STREAM_SUCCESS' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0 },
          undefined,
          'RETRY_MEDIA',
          'Media retry successful'
        );
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Mobile media retry failed:', error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha ao tentar novamente: ${errorMsg}`);
    }
  };

  // Show loading screen while validating mobile access
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>🔒 Validando acesso móvel FORÇADO...</p>
          <p className="text-sm opacity-75 mt-2">Verificando parâmetros de força e câmera</p>
        </div>
      </div>
    );
  }

  // Show blocked screen for non-mobile users
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">📱🚫</div>
          <h1 className="text-2xl font-bold mb-4">Acesso Exclusivo Móvel</h1>
          <p className="text-lg mb-6">Esta página requer câmera móvel para funcionar corretamente.</p>
          <p className="text-sm opacity-75 mb-4">
            Escaneie o QR Code com seu <strong>celular</strong> para acessar a câmera.
          </p>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-yellow-200 text-xs">
              💡 A câmera do PC não é compatível com esta funcionalidade
            </p>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-200 text-xs">
              🔧 Para forçar acesso móvel, adicione ?forceMobile=true na URL
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <ParticipantHeader
          sessionId={sessionId}
          connectionStatus={connection.connectionStatus}
          signalingStatus={signalingStatus}
          onBack={() => navigate('/')}
        />

        {/* Error Display */}
        <ParticipantErrorDisplay
          error={connection.error}
          isConnecting={connection.isConnecting}
          onRetryConnect={handleConnect}
        />

        {/* Connection Status Details */}
        <ParticipantConnectionStatus
          signalingStatus={signalingStatus}
          connectionStatus={connection.connectionStatus}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          onRetryMedia={handleRetryMedia}
        />

        {/* Video Preview */}
        <ParticipantVideoPreview
          localVideoRef={media.localVideoRef}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          hasScreenShare={media.hasScreenShare}
          isVideoEnabled={media.isVideoEnabled}
          isAudioEnabled={media.isAudioEnabled}
          localStream={media.localStreamRef.current}
          onRetryMedia={handleRetryMedia}
        />

        {/* Controls */}
        <ParticipantControls
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          hasScreenShare={media.hasScreenShare}
          isVideoEnabled={media.isVideoEnabled}
          isAudioEnabled={media.isAudioEnabled}
          isConnected={connection.isConnected}
          isConnecting={connection.isConnecting}
          connectionStatus={connection.connectionStatus}
          onToggleVideo={media.toggleVideo}
          onToggleAudio={media.toggleAudio}
          onToggleScreenShare={media.toggleScreenShare}
          onConnect={handleConnect}
          onDisconnect={connection.disconnectFromSession}
        />

        {/* Instructions */}
        <ParticipantInstructions />
        
        {/* Enhanced Mobile Debug Info */}
        {isMobile && (
          <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
            <p className="text-green-300 text-sm">
              ✅ Dispositivo móvel FORÇADO | Câmera traseira priorizada
            </p>
            <p className="text-green-200 text-xs mt-1">
              📱 Modo: {sessionStorage.getItem('confirmedMobileCamera') || 
                        media.localStreamRef.current?.getVideoTracks()[0]?.getSettings()?.facingMode || 
                        'Detectando...'}
            </p>
            <p className="text-green-100 text-xs mt-1">
              🔧 Forçado: {sessionStorage.getItem('forcedMobile') === 'true' ? 'SIM' : 'NÃO'}
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
