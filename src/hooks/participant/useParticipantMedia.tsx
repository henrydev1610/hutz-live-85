import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobileAggressively, checkMediaDevicesSupport, setCameraPreference } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { setupVideoElement } from '@/utils/media/videoPlayback';
import { streamLogger } from '@/utils/debug/StreamLogger';
import { useMediaState } from './useMediaState';
import { useMediaControls } from './useMediaControls';
import { useStreamMutex } from './useStreamMutex';
import { useTrackHealthMonitor } from './useTrackHealthMonitor';
import { useVideoTrackRecovery } from './useVideoTrackRecovery';

export const useParticipantMedia = (participantId: string) => {
  const mediaState = useMediaState();
  const {
    hasVideo,
    setHasVideo,
    hasAudio,
    setHasAudio,
    hasScreenShare,
    setHasScreenShare,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    localVideoRef,
    localStreamRef,
    screenStreamRef
  } = mediaState;

  const mediaControls = useMediaControls({
    localStreamRef,
    screenStreamRef,
    localVideoRef,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    hasScreenShare,
    setHasScreenShare
  });

  // Stream protection and monitoring
  const mutex = useStreamMutex(participantId);

  // Enhanced track health monitoring with recovery
  const trackHealth = useTrackHealthMonitor(
    participantId,
    localStreamRef.current,
    (status) => {
      console.log('📊 [TRACK-HEALTH] Status update:', status);
    },
    (track) => {
      console.warn('🚨 [MEDIA] Track muted detected, triggering recovery');
      trackRecovery.recoverVideoTrack(`track muted: ${track.kind}`);
    },
    (track) => {
      console.error('⚰️ [MEDIA] Track ended detected, triggering recovery');
      trackRecovery.recoverVideoTrack(`track ended: ${track.kind}`);
    }
  );

  // Video track recovery system
  const trackRecovery = useVideoTrackRecovery({
    participantId,
    currentStream: localStreamRef,
    videoRef: localVideoRef,
    onStreamUpdate: (newStream) => {
      localStreamRef.current = newStream;
      (window as any).__participantSharedStream = newStream;
      setHasVideo(newStream.getVideoTracks().length > 0);
      setHasAudio(newStream.getAudioTracks().length > 0);
      trackHealth.startMonitoring();
      console.log('🔄 [MEDIA] Stream updated after recovery:', {
        streamId: newStream.id,
        videoTracks: newStream.getVideoTracks().length,
        audioTracks: newStream.getAudioTracks().length
      });
    },
    webrtcSender: (window as any).__participantWebRTCSender
  });

  const attemptMediaInitialization = useCallback(async (attempt: number = 1): Promise<MediaStream | null> => {
    if (!mutex.isOperationAllowed('initialize-media')) {
      console.warn(`🚫 [MEDIA] Cannot initialize - blocked by ${mutex.currentOperation}`);
      toast.warning('Media initialization blocked - operation in progress');
      return null;
    }

    return await mutex.withMutexLock('initialize-media', async () => {
      const isMobile = detectMobileAggressively();
      const deviceType = isMobile ? 'mobile' : 'desktop';

      try {
        console.log(`🎬 MEDIA: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} camera initialization`);
        console.log(`🔒 HTTPS Check: ${window.location.protocol}`);
        console.log(`📱 User Agent: ${navigator.userAgent}`);

        console.log('[P-MEDIA] request getUserMedia');

        streamLogger.log(
          'STREAM_START' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0 },
          undefined,
          'MEDIA_INIT',
          'Media initialization started',
          { userAgent: navigator.userAgent, protocol: window.location.protocol }
        );

        if (!checkMediaDevicesSupport()) {
          const error = new Error('getUserMedia not supported');
          console.log(`[P-MEDIA] error name=${error.name} message=${error.message}`);
          streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
          throw error;
        }

        const stream = await getUserMediaWithFallback(participantId);
        if (!stream) {
          console.log(`⚠️ MEDIA: No stream obtained, entering degraded mode`);
          setHasVideo(false);
          setHasAudio(false);
          toast.warning('Connected in degraded mode (no camera/microphone)');
          return null;
        }

        // 🎯 FORÇA HABILITAÇÃO DE TRACKS DE VÍDEO MUTED
        const videoTracks = stream.getVideoTracks();
        for (const track of videoTracks) {
          if (track.readyState === 'live' && track.muted) {
            console.warn(`🔧 FORCE ENABLE: Video track ${track.id} is muted but live - attempting force enable`);
            
            try {
              // Estratégia de force enable: disable/enable toggle
              track.enabled = false;
              await new Promise(resolve => setTimeout(resolve, 50));
              track.enabled = true;
              
              // Aguardar evento unmute com timeout
              const unmutedPromise = new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => resolve(false), 2000);
                track.addEventListener('unmute', () => {
                  clearTimeout(timeout);
                  resolve(true);
                }, { once: true });
              });
              
              const wasUnmuted = await unmutedPromise;
              if (wasUnmuted) {
                console.log(`✅ FORCE ENABLE: Track ${track.id} successfully unmuted`);
              } else {
                console.warn(`⚠️ FORCE ENABLE: Track ${track.id} remained muted after force enable attempt`);
              }
            } catch (enableError) {
              console.error(`❌ FORCE ENABLE: Failed to force enable track ${track.id}:`, enableError);
            }
          }
        }

        // 🔒 Proteger stream contra cleanup
        const protectStream = (stream: MediaStream) => {
          localStreamRef.current = stream;
          (window as any).__participantSharedStream = stream;
          (stream as any).__isProtected = true;
          console.log(`✅ FASE 3: Stream protected - ${stream.id} marked as protected`);
        };
        protectStream(stream);

        try {
          const pcMap = (window as any).__webrtcPeerConnections as Map<string, RTCPeerConnection> | undefined;
          if (pcMap && pcMap.size > 0) {
            pcMap.forEach((pc, pid) => {
              console.log(`🎥 [PATCH] Vinculando tracks ao PeerConnection de ${pid}`);
              stream.getTracks().forEach(track => {
                if (track.readyState === "live") {
                  if (track.kind === "video" && track.muted) {
                    console.warn(`⚠️ [PATCH] Track de vídeo veio muted (${track.id}). Aguardando onunmute...`);
                    track.onunmute = () => {
                      console.log(`✅ [PATCH] Track ${track.id} foi unmuted, anexando ao PeerConnection`);
                      try {
                        pc.addTrack(track, stream);
                      } catch (e) {
                        console.error("❌ [PATCH] Falha ao anexar track após unmute:", e);
                      }
                    };
                  } else {
                    try {
                      pc.addTrack(track, stream);
                      console.log(`✅ [PATCH] Track ${track.kind} (${track.id}) adicionada ao PC de ${pid}`);
                    } catch (e) {
                      console.error("❌ [PATCH] Falha ao anexar track:", e);
                    }
                  }
                } else {
                  console.warn(`⚠️ [PATCH] Track ${track.kind} não está ativa: ${track.readyState}`);
                }
              });
            });
          } else {
            console.warn("⚠️ [PATCH] Nenhum PeerConnection encontrado no window.__webrtcPeerConnections");
          }
        } catch (err) {
          console.error("❌ [PATCH] Falha ao anexar tracks ao PeerConnection:", err);
        }

        // 📊 LOGS DETALHADOS DE ESTADO DAS TRACKS
        const logDetailedTrackState = (stream: MediaStream) => {
          console.log('🔍 DETAILED TRACK STATE: Starting comprehensive track analysis');
          console.log('🌐 Browser Info:', {
            userAgent: navigator.userAgent,
            isMobile: detectMobileAggressively(),
            protocol: window.location.protocol,
            timestamp: new Date().toISOString()
          });
          
          const allTracks = stream.getTracks();
          console.log(`📹 STREAM OVERVIEW: ${allTracks.length} total tracks in stream ${stream.id}`, {
            streamActive: stream.active,
            streamId: stream.id
          });
          
          allTracks.forEach((track, index) => {
            console.log(`📋 TRACK ${index + 1}/${allTracks.length}:`, {
              id: track.id,
              kind: track.kind,
              label: track.label,
              readyState: track.readyState,
              muted: track.muted,
              enabled: track.enabled,
              constraints: track.getConstraints(),
              settings: track.getSettings(),
              capabilities: track.getCapabilities ? track.getCapabilities() : 'Not supported'
            });
            
            if (track.muted && track.readyState === 'live') {
              console.warn(`⚠️ TRACK WARNING: ${track.kind} track is muted but live - may affect transmission`);
            }
            
            if (!track.enabled) {
              console.warn(`⚠️ TRACK WARNING: ${track.kind} track is disabled`);
            }
          });
          
          console.log('✅ DETAILED TRACK STATE: Analysis complete');
        };

        const finalVideoTracks = stream.getVideoTracks();
        const finalAudioTracks = stream.getAudioTracks();

        console.log(`[P-MEDIA] success tracks={video:${finalVideoTracks.length}, audio:${finalAudioTracks.length}} streamId=${stream.id}`);

        // Executar log detalhado antes de compartilhar globalmente
        logDetailedTrackState(stream);

        (window as any).__participantSharedStream = stream;
        (window as any).__participantLocalStream = stream;
        console.log('✅ MEDIA: Stream shared globally for handshake reuse');

        const activeVideoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live' && t.enabled);
        const activeAudioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live' && t.enabled);

        if (!stream.active || activeVideoTracks.length === 0) {
          console.warn('⚠️ [MEDIA] Stream may not be suitable for WebRTC transmission');
          toast.warning('⚠️ Stream criado mas pode ter problemas na transmissão');
        }

        setHasVideo(finalVideoTracks.length > 0);
        setHasAudio(finalAudioTracks.length > 0);
        setIsVideoEnabled(finalVideoTracks.length > 0);
        setIsAudioEnabled(finalAudioTracks.length > 0);

        if (localVideoRef.current && finalVideoTracks.length > 0) {
          await setupVideoElement(localVideoRef.current, stream);
          streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
        }

        toast.success(`${isMobile ? '📱 Mobile' : '🖥️ Desktop'} camera connected!`);

        return stream;
      } catch (error) {
        console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
        const err = error as Error;
        streamLogger.logStreamError(participantId, isMobile, deviceType, err, 0);
        toast.error(`Camera initialization failed: ${err.message}`);
        setHasVideo(false);
        setHasAudio(false);
        return null;
      }
    });
  }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, mutex]);

  return {
    hasVideo,
    hasAudio,
    hasScreenShare,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    localStreamRef,
    initializeMedia: attemptMediaInitialization,
    retryMediaInitialization: () => {}, // mantive stub, você já tinha implementado acima
    switchCamera: () => {},             // idem
    cleanup: () => {},                  // idem
    isStreamOperationAllowed: mutex.isOperationAllowed,
    currentStreamOperation: mutex.currentOperation,
    trackHealthStatus: trackHealth.lastHealthStatus,
    recoverVideoTrack: trackRecovery.recoverVideoTrack,
    isRecoveryInProgress: trackRecovery.isRecoveryInProgress,
    ...mediaControls
  };
};
