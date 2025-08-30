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

    const initializeMedia = useCallback(async () => {
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
                    streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
                    throw error;
                }

                const stream = await getUserMediaWithFallback(participantId);

                if (!stream) {
                    console.log(`⚠️ MEDIA: No stream obtained, entering degraded mode`);
                    streamLogger.log(
                        'STREAM_ERROR' as any,
                        participantId,
                        isMobile,
                        deviceType,
                        { timestamp: Date.now(), duration: 0, errorType: 'NO_STREAM_DEGRADED_MODE' },
                        undefined,
                        'MEDIA_INIT',
                        'No stream obtained, entering degraded mode'
                    );
                    setHasVideo(false);
                    setHasAudio(false);
                    toast.warning('Connected in degraded mode (no camera/microphone)');
                    return null;
                }

                // 🔒 FASE 3: Proteger stream contra cleanup
                const protectStream = (stream: MediaStream) => {
                  localStreamRef.current = stream;
                  (window as any).__participantSharedStream = stream;
                  (stream as any).__isProtected = true;
                  console.log(`✅ FASE 3: Stream protected - ${stream.id} marked as protected`);
                };
                protectStream(stream);

                // 🎥 PATCH: Vincular tracks ao PeerConnection
                try {
                  const pcMap = (window as any).__webrtcPeerConnections as Map<string, RTCPeerConnection> | undefined;
                  if (pcMap && pcMap.size > 0) {
                      pcMap.forEach((pc, pid) => {
                          console.log(`🎥 [PATCH] Vinculando tracks ao PeerConnection de ${pid}`);
                          stream.getTracks().forEach(track => {
                              if (track.readyState === "live") {
                                  if (track.kind === "video" && track.muted) {
                                      console.warn(`⚠️ [PATCH] Track de vídeo veio muted, tentando forçar unmute`);
                                      try { track.enabled = true; } 
                                      catch (e) { console.error("❌ [PATCH] Falha ao forçar unmute no track:", e); }
                                  }
                                  pc.addTrack(track, stream);
                                  console.log(`✅ [PATCH] Track ${track.kind} (${track.id}) adicionada ao PC de ${pid}`);
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

                const videoTracks = stream.getVideoTracks();
                const audioTracks = stream.getAudioTracks();

                console.log(`[P-MEDIA] success tracks={video:${videoTracks.length}, audio:${audioTracks.length}} streamId=${stream.id}`);

                (window as any).__participantSharedStream = stream;
                (window as any).__participantLocalStream = stream;
                console.log('✅ MEDIA: Stream shared globally for handshake reuse');

                const activeVideoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live' && t.enabled);
                const activeAudioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live' && t.enabled);

                console.log('🔍 [MEDIA] WebRTC compatibility check:', {
                    streamActive: stream.active,
                    streamId: stream.id,
                    totalTracks: stream.getTracks().length,
                    activeVideoTracks: activeVideoTracks.length,
                    activeAudioTracks: activeAudioTracks.length,
                    readyForWebRTC: stream.active && activeVideoTracks.length > 0
                });

                if (!stream.active || activeVideoTracks.length === 0) {
                    console.warn('⚠️ [MEDIA] Stream may not be suitable for WebRTC transmission');
                    toast.warning('⚠️ Stream criado mas pode ter problemas na transmissão');
                }

                streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, 0);
                streamLogger.logWebRTCSend(participantId, isMobile, deviceType, stream);

                setHasVideo(videoTracks.length > 0);
                setHasAudio(audioTracks.length > 0);
                setIsVideoEnabled(videoTracks.length > 0);
                setIsAudioEnabled(audioTracks.length > 0);

                if (localVideoRef.current && videoTracks.length > 0) {
                    await setupVideoElement(localVideoRef.current, stream);
                    streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
                }

                const displayType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
                toast.success(`${displayType} camera connected! Video: ${videoTracks.length > 0 ? '✅' : '❌'}, Audio: ${audioTracks.length > 0 ? '✅' : '❌'}`);

                return stream;

            } catch (error) {
                console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
                const err = error as Error;
                streamLogger.logStreamError(participantId, isMobile, deviceType, err, 0);
                toast.error(`Camera initialization failed: ${error.message}`);
                setHasVideo(false);
                setHasAudio(false);
                return null;
            }
        });
    }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, mutex]);

    // (restante do arquivo igual ao seu, retryMediaInitialization, switchCamera, cleanup, return {...})
