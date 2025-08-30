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

    const mutex = useStreamMutex(participantId);

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

                if (!checkMediaDevicesSupport()) {
                    throw new Error('getUserMedia not supported');
                }

                const stream = await getUserMediaWithFallback(participantId);

                if (!stream) {
                    setHasVideo(false);
                    setHasAudio(false);
                    toast.warning('Connected in degraded mode (no camera/microphone)');
                    return null;
                }

                // 🔒 Proteger stream contra cleanup
                const protectStream = (stream: MediaStream) => {
                  localStreamRef.current = stream;
                  (window as any).__participantSharedStream = stream;
                  (stream as any).__isProtected = true;
                  console.log(`✅ Stream protected - ${stream.id} marked as protected`);
                };
                protectStream(stream);

                // 🎥 Patch: vincular tracks ao PeerConnection
                try {
                  const pcMap = (window as any).__webrtcPeerConnections as Map<string, RTCPeerConnection> | undefined;
                  if (pcMap && pcMap.size > 0) {
                      pcMap.forEach((pc, pid) => {
                          console.log(`🎥 [PATCH] Vinculando tracks ao PeerConnection de ${pid}`);
                          stream.getTracks().forEach(track => {
                              if (track.readyState === "live") {
                                  if (track.kind === "video" && track.muted) {
                                      try { track.enabled = true; } catch {}
                                  }
                                  pc.addTrack(track, stream);
                                  console.log(`✅ [PATCH] Track ${track.kind} adicionada ao PC de ${pid}`);
                              } else {
                                  console.warn(`⚠️ [PATCH] Track ${track.kind} não está ativa: ${track.readyState}`);
                              }
                          });
                      });
                  }
                } catch (err) {
                  console.error("❌ [PATCH] Falha ao anexar tracks ao PeerConnection:", err);
                }

                const videoTracks = stream.getVideoTracks();
                const audioTracks = stream.getAudioTracks();

                (window as any).__participantSharedStream = stream;
                (window as any).__participantLocalStream = stream;

                setHasVideo(videoTracks.length > 0);
                setHasAudio(audioTracks.length > 0);
                setIsVideoEnabled(videoTracks.length > 0);
                setIsAudioEnabled(audioTracks.length > 0);

                if (localVideoRef.current && videoTracks.length > 0) {
                    await setupVideoElement(localVideoRef.current, stream);
                }

                toast.success(`${isMobile ? '📱 Mobile' : '🖥️ Desktop'} camera connected!`);

                return stream;

            } catch (error) {
                console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
                setHasVideo(false);
                setHasAudio(false);
                return null;
            }
        });
    }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, mutex]);

    const retryMediaInitialization = useCallback(async () => {
        if (!mutex.isOperationAllowed('retry-media')) {
            console.warn(`🚫 [MEDIA] Cannot retry - blocked by ${mutex.currentOperation}`);
            return null;
        }

        return await mutex.withMutexLock('retry-media', async () => {
            if (localStreamRef.current) {
                const isStreamInUse = (window as any).__participantSharedStream === localStreamRef.current;
                if (!isStreamInUse) {
                    localStreamRef.current.getTracks().forEach(track => track.stop());
                }
                localStreamRef.current = null;
            }
            setHasVideo(false);
            setHasAudio(false);

            try {
                const stream = await initializeMedia();
                return stream;
            } catch (error) {
                console.error('❌ MEDIA: Retry failed:', error);
                toast.error('Failed to retry media connection');
                throw error;
            }
        });
    }, [initializeMedia, localStreamRef, setHasVideo, setHasAudio, mutex]);

    const switchCamera = useCallback(async (facing: 'user' | 'environment') => {
        if (!mutex.isOperationAllowed('switch-camera')) {
            console.warn(`🚫 [MEDIA] Cannot switch camera - blocked by ${mutex.currentOperation}`);
            return null;
        }

        return await mutex.withMutexLock('switch-camera', async () => {
            const isMobile = detectMobileAggressively();
            if (!isMobile) {
                toast.warning('Camera switching only available on mobile devices');
                return;
            }

            try {
                if (localStreamRef.current) {
                    const isStreamInUse = (window as any).__participantSharedStream === localStreamRef.current;
                    if (!isStreamInUse) {
                        localStreamRef.current.getTracks().forEach(track => track.stop());
                    }
                    localStreamRef.current = null;
                }

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                }

                setCameraPreference(facing);
                const newStream = await getUserMediaWithFallback(participantId);

                if (!newStream) throw new Error(`Cannot access ${facing} camera`);

                localStreamRef.current = newStream;
                const videoTracks = newStream.getVideoTracks();
                const audioTracks = newStream.getAudioTracks();

                setHasVideo(videoTracks.length > 0);
                setHasAudio(audioTracks.length > 0);
                setIsVideoEnabled(videoTracks.length > 0);
                setIsAudioEnabled(audioTracks.length > 0);

                if (localVideoRef.current && videoTracks.length > 0) {
                    await setupVideoElement(localVideoRef.current, newStream);
                }

                toast.success(`📱 ${facing === 'user' ? 'Front' : 'Back'} camera activated!`);
                return newStream;

            } catch (error) {
                console.error(`❌ CAMERA SWITCH: Failed to switch to ${facing}:`, error);
                await retryMediaInitialization();
                throw error;
            }
        });
    }, [participantId, localStreamRef, localVideoRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, retryMediaInitialization, mutex]);

    const cleanup = useCallback(() => {
        if (localStreamRef.current) {
            const isProtected = (localStreamRef.current as any).__isProtected;
            if (!isProtected) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        setHasVideo(false);
        setHasAudio(false);
        setHasScreenShare(false);
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
    }, [localStreamRef, screenStreamRef, localVideoRef, setHasVideo, setHasAudio, setHasScreenShare, setIsVideoEnabled, setIsAudioEnabled]);

    return {
        hasVideo,
        hasAudio,
        hasScreenShare,
        isVideoEnabled,
        isAudioEnabled,
        localVideoRef,
        localStreamRef,
        initializeMedia,
        retryMediaInitialization,
        switchCamera,
        cleanup,
        isStreamOperationAllowed: mutex.isOperationAllowed,
        currentStreamOperation: mutex.currentOperation,
        trackHealthStatus: trackHealth.lastHealthStatus,
        recoverVideoTrack: trackRecovery.recoverVideoTrack,
        isRecoveryInProgress: trackRecovery.isRecoveryInProgress,
        ...mediaControls
    };
};
