
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
        // onTrackMuted callback
        (track) => {
            console.warn('🚨 [MEDIA] Track muted detected, triggering recovery');
            trackRecovery.recoverVideoTrack(`track muted: ${track.kind}`);
        },
        // onTrackEnded callback  
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
            // Update the stream reference manually since it's mutable
            localStreamRef.current = newStream;

            // Update global shared stream for WebRTC
            (window as any).__participantSharedStream = newStream;

            // Update state
            setHasVideo(newStream.getVideoTracks().length > 0);
            setHasAudio(newStream.getAudioTracks().length > 0);

            // Restart track health monitoring for new stream
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
        // MUTEX PROTECTION: Prevent media operations during WebRTC handshake
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

                // [P-MEDIA] request getUserMedia (antes de chamar)
                console.log('[P-MEDIA] request getUserMedia');

                // Log início via StreamLogger
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
                    console.log('[P-MEDIA] error name=NO_STREAM message=No stream obtained, entering degraded mode');

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

                localStreamRef.current = stream;


                (window as any).__participantSharedStream = stream;
                try {
                    const pcMap = (window as any).__webrtcPeerConnections as Map<string, RTCPeerConnection> | undefined;
                    if (pcMap && pcMap.size > 0) {
                        pcMap.forEach((pc, pid) => {
                            console.log(`🎥 [PATCH] Vinculando tracks ao PeerConnection de ${pid}`);
                            stream.getTracks().forEach(track => {
                                if (track.readyState === "live") {
                                    // PATCH: Forçar ativação de track de vídeo
                                    if (track.kind === "video" && track.muted) {
                                        console.warn(`⚠️ [PATCH] Track de vídeo veio muted, tentando forçar unmute`);
                                        try {
                                            track.enabled = true; // força ativação
                                        } catch (e) {
                                            console.error("❌ [PATCH] Falha ao forçar unmute no track:", e);
                                        }
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

                // [P-MEDIA] success tracks={video:<n>, audio:<n>} streamId=<id>
                console.log(`[P-MEDIA] success tracks={video:${videoTracks.length}, audio:${audioTracks.length}} streamId=${stream.id}`);

                // CRITICAL: Set this stream globally for handshake reuse with validation
                (window as any).__participantSharedStream = stream;
                (window as any).__participantLocalStream = stream;
                console.log('✅ MEDIA: Stream shared globally for handshake reuse');

                // Enhanced stream validation for WebRTC compatibility
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

                console.log(`✅ MEDIA: Stream obtained:`, {
                    videoTracks: videoTracks.length,
                    audioTracks: audioTracks.length,
                    deviceType: isMobile ? 'MOBILE' : 'DESKTOP'
                });

                // Log sucesso detalhado
                streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, 0);

                // Log WebRTC send
                streamLogger.logWebRTCSend(participantId, isMobile, deviceType, stream);

                setHasVideo(videoTracks.length > 0);
                setHasAudio(audioTracks.length > 0);
                setIsVideoEnabled(videoTracks.length > 0);
                setIsAudioEnabled(audioTracks.length > 0);

                // Setup video element
                if (localVideoRef.current && videoTracks.length > 0) {
                    await setupVideoElement(localVideoRef.current, stream);

                    // Log DOM update
                    streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
                }

                const displayType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
                const videoStatus = videoTracks.length > 0 ? '✅' : '❌';
                const audioStatus = audioTracks.length > 0 ? '✅' : '❌';

                toast.success(`${displayType} camera connected! Video: ${videoStatus}, Audio: ${audioStatus}`);

                // REMOÇÃO: Não emitir stream-started aqui - será feito na página

                return stream;

            } catch (error) {
                console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);

                const err = error as Error;
                console.log(`[P-MEDIA] error name=${err.name} message=${err.message}`);

                streamLogger.logStreamError(participantId, isMobile, deviceType, err, 0);

                const errorMsg = error instanceof Error ? error.message : String(error);
                toast.error(`Camera initialization failed: ${errorMsg}`);

                setHasVideo(false);
                setHasAudio(false);
                return null;
            }
        });
    }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, mutex]);

    const retryMediaInitialization = useCallback(async () => {
        // MUTEX PROTECTION: Prevent retry during WebRTC operations
        if (!mutex.isOperationAllowed('retry-media')) {
            console.warn(`🚫 [MEDIA] Cannot retry - blocked by ${mutex.currentOperation}`);
            return null;
        }

        return await mutex.withMutexLock('retry-media', async () => {
            const isMobile = detectMobileAggressively();
            const deviceType = isMobile ? 'mobile' : 'desktop';

            console.log('🔄 MEDIA: Retrying media initialization...');

            streamLogger.log(
                'STREAM_START' as any,
                participantId,
                isMobile,
                deviceType,
                { timestamp: Date.now(), duration: 0 },
                undefined,
                'MEDIA_RETRY',
                'Media retry initialization started'
            );

            // PROTECTED CLEANUP: Don't stop tracks if they're being used by WebRTC
            if (localStreamRef.current) {
                const isStreamInUse = (window as any).__participantSharedStream === localStreamRef.current;

                if (isStreamInUse) {
                    console.log('🔒 MEDIA: Skipping track cleanup - stream is being used by WebRTC handshake');
                    streamLogger.log(
                        'VALIDATION' as any,
                        participantId,
                        isMobile,
                        deviceType,
                        { timestamp: Date.now(), duration: 0 },
                        undefined,
                        'TRACK_PROTECTION',
                        'Tracks protected from cleanup during WebRTC use'
                    );
                } else {
                    localStreamRef.current.getTracks().forEach(track => {
                        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_for_retry', track);
                        track.stop();
                    });
                }
                localStreamRef.current = null;
            }

            // Reset state
            setHasVideo(false);
            setHasAudio(false);

            try {
                const stream = await initializeMedia();

                if (stream) {
                    streamLogger.log(
                        'STREAM_SUCCESS' as any,
                        participantId,
                        isMobile,
                        deviceType,
                        { timestamp: Date.now(), duration: 0 },
                        undefined,
                        'MEDIA_RETRY',
                        'Media retry successful'
                    );
                }

                return stream;
            } catch (error) {
                console.error('❌ MEDIA: Retry failed:', error);
                streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
                toast.error('Failed to retry media connection');
                throw error;
            }
        });
    }, [participantId, initializeMedia, localStreamRef, setHasVideo, setHasAudio, mutex]);

    const switchCamera = useCallback(async (facing: 'user' | 'environment') => {
        // MUTEX PROTECTION: Prevent camera switch during WebRTC operations
        if (!mutex.isOperationAllowed('switch-camera')) {
            console.warn(`🚫 [MEDIA] Cannot switch camera - blocked by ${mutex.currentOperation}`);
            return null;
        }

        return await mutex.withMutexLock('switch-camera', async () => {
            const isMobile = detectMobileAggressively();
            const deviceType = isMobile ? 'mobile' : 'desktop';

            if (!isMobile) {
                streamLogger.log(
                    'STREAM_ERROR' as any,
                    participantId,
                    isMobile,
                    deviceType,
                    { timestamp: Date.now(), duration: 0, errorType: 'CAMERA_SWITCH_NOT_MOBILE' },
                    undefined,
                    'CAMERA_SWITCH',
                    'Camera switch attempted on non-mobile device'
                );

                toast.warning('Camera switching only available on mobile devices');
                return;
            }

            console.log(`📱 CAMERA SWITCH: Switching to ${facing} camera`);

            streamLogger.log(
                'STREAM_START' as any,
                participantId,
                isMobile,
                deviceType,
                { timestamp: Date.now(), duration: 0 },
                undefined,
                'CAMERA_SWITCH',
                `Camera switch to ${facing} started`
            );

            try {
                // PROTECTED CLEANUP: Don't stop tracks if they're being used by WebRTC
                if (localStreamRef.current) {
                    const isStreamInUse = (window as any).__participantSharedStream === localStreamRef.current;

                    if (isStreamInUse) {
                        console.log('🔒 CAMERA SWITCH: Stream is in use by WebRTC - creating new stream without stopping current');
                        streamLogger.log(
                            'VALIDATION' as any,
                            participantId,
                            isMobile,
                            deviceType,
                            { timestamp: Date.now(), duration: 0 },
                            undefined,
                            'TRACK_PROTECTION',
                            'Current tracks protected during camera switch'
                        );
                    } else {
                        localStreamRef.current.getTracks().forEach(track => {
                            streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_for_switch', track);
                            track.stop();
                        });
                    }
                    localStreamRef.current = null;
                }

                // Clear video element
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                    streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
                }

                // Set new camera preference
                setCameraPreference(facing);

                // Get new stream with new camera
                const newStream = await getUserMediaWithFallback(participantId);

                if (!newStream) {
                    const error = new Error(`Cannot access ${facing === 'user' ? 'front' : 'back'} camera`);
                    streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
                    throw error;
                }

                // Update state
                localStreamRef.current = newStream;
                const videoTracks = newStream.getVideoTracks();
                const audioTracks = newStream.getAudioTracks();

                streamLogger.logStreamSuccess(participantId, isMobile, deviceType, newStream, 0);

                setHasVideo(videoTracks.length > 0);
                setHasAudio(audioTracks.length > 0);
                setIsVideoEnabled(videoTracks.length > 0);
                setIsAudioEnabled(audioTracks.length > 0);

                // Setup video element
                if (localVideoRef.current && videoTracks.length > 0) {
                    await setupVideoElement(localVideoRef.current, newStream);
                    streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
                }

                toast.success(`📱 ${facing === 'user' ? 'Front' : 'Back'} camera activated!`);

                return newStream;

            } catch (error) {
                console.error(`❌ CAMERA SWITCH: Failed to switch to ${facing}:`, error);

                streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);

                const errorMsg = error instanceof Error ? error.message : String(error);
                toast.error(`Failed to switch camera: ${errorMsg}`);

                // Try to reinitialize
                try {
                    await retryMediaInitialization();
                } catch (recoveryError) {
                    console.error('❌ CAMERA SWITCH: Recovery also failed:', recoveryError);
                    streamLogger.logStreamError(participantId, isMobile, deviceType, recoveryError as Error, 0);
                }

                throw error;
            }
        });
    }, [participantId, localStreamRef, localVideoRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, retryMediaInitialization, mutex]);

    const cleanup = useCallback(() => {
        const isMobile = detectMobileAggressively();
        const deviceType = isMobile ? 'mobile' : 'desktop';

        console.log('🧹 MEDIA: Cleaning up media resources...');

        streamLogger.log(
            'VALIDATION' as any,
            participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: 0 },
            undefined,
            'CLEANUP',
            'Media cleanup initiated'
        );

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_cleanup', track);
                track.stop();
            });
            localStreamRef.current = null;
        }

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
                streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'screen_track_stopped_cleanup', track);
                track.stop();
            });
            screenStreamRef.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
            streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
        }

        setHasVideo(false);
        setHasAudio(false);
        setHasScreenShare(false);
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
    }, [participantId, localStreamRef, screenStreamRef, localVideoRef, setHasVideo, setHasAudio, setHasScreenShare, setIsVideoEnabled, setIsAudioEnabled]);

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
        // Stream protection utilities
        isStreamOperationAllowed: mutex.isOperationAllowed,
        currentStreamOperation: mutex.currentOperation,
        trackHealthStatus: trackHealth.lastHealthStatus,
        // Track recovery utilities
        recoverVideoTrack: trackRecovery.recoverVideoTrack,
        isRecoveryInProgress: trackRecovery.isRecoveryInProgress,
        ...mediaControls
    };
};
