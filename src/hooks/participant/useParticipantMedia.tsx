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

  // FASE 1: Automatic media initialization with validation and retry
  const initializeMediaAutomatically = useCallback(async () => {
    const MAX_ATTEMPTS = 3;
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`🎬 PATCH FASE 1: Media init attempt ${attempt}/${MAX_ATTEMPTS}`);
        
        // Progressive constraints: environment -> user -> basic
        const constraints = {
          video: attempt === 1 ? { facingMode: 'environment' } : 
                 attempt === 2 ? { facingMode: 'user' } : true,
          audio: true
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // CRITICAL: Validate tracks BEFORE accepting stream
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        if (videoTracks.length === 0) {
          throw new Error('No video tracks in stream');
        }
        
        if (videoTracks[0].readyState !== 'live') {
          throw new Error('Video track not live');
        }
        
        // Store IMMEDIATELY
        localStreamRef.current = stream;
        (window as any).__participantSharedStream = stream;
        
        // Validate that it was stored
        const stored = (window as any).__participantSharedStream;
        if (!stored || stored.id !== stream.id) {
          throw new Error('Stream storage failed');
        }
        
        // Connect to preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          await localVideoRef.current.play();
        }
        
        setHasVideo(true);
        setHasAudio(audioTracks.length > 0);
        setIsVideoEnabled(true);
        setIsAudioEnabled(audioTracks.length > 0);
        
        // Start health monitoring
        trackHealth.startMonitoring();
        
        console.log('✅ PATCH FASE 1: Media initialized successfully', {
          streamId: stream.id,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          attempt
        });
        
        return stream;
        
      } catch (error) {
        console.warn(`⚠️ PATCH FASE 1: Attempt ${attempt} failed:`, error);
        if (attempt === MAX_ATTEMPTS) {
          setHasVideo(false);
          setHasAudio(false);
          setIsVideoEnabled(false);
          setIsAudioEnabled(false);
          throw error;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    throw new Error('Failed to initialize media after all attempts');
  }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, trackHealth]);

  const initializeMedia = useCallback(async () => {
    if (!mutex.isOperationAllowed('initialize-media')) {
      console.warn('🚫 [MEDIA] Cannot initialize - blocked by operation');
      return null;
    }

    return await mutex.withMutexLock('initialize-media', async () => {
      return await initializeMediaAutomatically();
    });
  }, [initializeMediaAutomatically, mutex]);

  const cleanup = useCallback(() => {
    console.log('🧹 MEDIA: Cleaning up media resources...');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
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
    initializeMediaAutomatically,
    cleanup,
    ...mediaControls,
    ...mutex,
    ...trackHealth,
    ...trackRecovery
  };
};