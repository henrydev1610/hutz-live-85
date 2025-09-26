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

  // FASE 4: Video-only media initialization with intelligent permissions
  const initializeMediaAutomatically = useCallback(async () => {
    try {
      console.log('🎬 MEDIA: Starting video-only media initialization');
      
      // FASE 4: Direct video-only getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false // FASE 4: Video-only capture
      });

      if (!stream) {
        throw new Error('No video stream obtained from getUserMedia');
      }

      localStreamRef.current = stream;
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      (window as any).__participantSharedStream = stream;
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0); // Should be 0 for video-only
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      // Enhanced validation logging
      console.log(`🔍 Video-only stream validation:`, {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        streamActive: stream.active,
        streamId: stream.id
      });

      // FASE 4: Invisible prime to drain frames
      if (localVideoRef.current && videoTracks.length > 0) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.style.visibility = 'hidden'; // Invisible prime
        
        try {
          // FASE 6: Single play() call with promise guard
          await localVideoRef.current.play();
          console.log('✅ [MEDIA] Video playing (invisible prime)');
          
          // Make visible after frames are drained
          setTimeout(() => {
            if (localVideoRef.current) {
              localVideoRef.current.style.visibility = 'visible';
            }
          }, 500);
        } catch (playError) {
          console.warn('⚠️ Video play warning:', playError);
        }
      }
      
      return stream;
        
    } catch (error) {
      console.error('❌ MEDIA: Failed to initialize video-only media:', error);
      
      // FASE 5: Intelligent permission management
      if (error.name === 'NotAllowedError') {
        console.log('🚫 [MEDIA] Permission denied - pausing recovery until user gesture');
        setHasVideo(false);
        setIsVideoEnabled(false);
        throw new Error('Permissão da câmera negada. Clique para tentar novamente.');
      } else if (error.name === 'AbortError') {
        console.log('🔄 [MEDIA] Permission dismissed - will retry silently on next gesture');
        throw new Error('Acesso à câmera foi cancelado');
      }
      
      setHasVideo(false);
      setHasAudio(false);
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      throw error;
    }
  }, [participantId, localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled]);

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