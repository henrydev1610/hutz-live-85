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

  // Automatic media initialization (Teams/Meet style)
  const initializeMediaAutomatically = useCallback(async () => {
    try {
      console.log('🎬 MEDIA: Starting automatic media initialization');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (!stream || !stream.active) {
        throw new Error('No active stream obtained from getUserMedia');
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      const liveVideoTracks = videoTracks.filter(track => track.readyState === 'live' && track.enabled);
      const liveAudioTracks = audioTracks.filter(track => track.readyState === 'live' && track.enabled);

      if (liveVideoTracks.length === 0 && liveAudioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Stream obtained but contains no live video or audio tracks.');
      }

      localStreamRef.current = stream;
      (window as any).__participantSharedStream = stream;
      
      setHasVideo(liveVideoTracks.length > 0);
      setHasAudio(liveAudioTracks.length > 0);
      setIsVideoEnabled(liveVideoTracks.length > 0);
      setIsAudioEnabled(liveAudioTracks.length > 0);
      
      console.log(`🔍 Stream validation - Live Audio: ${liveAudioTracks.length}, Live Video: ${liveVideoTracks.length}`);

      if (localVideoRef.current && liveVideoTracks.length > 0) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.autoplay = true; // Ensure autoplay is set
        
        try {
          await localVideoRef.current.play();
          console.log('✅ MEDIA: Video playing successfully in local preview');
        } catch (playError: any) {
          console.warn('⚠️ MEDIA: Video play failed in local preview:', playError.name, playError.message);
          if (playError.name === 'NotAllowedError' || playError.name === 'AbortError') {
            toast.info('Video autoplay blocked. Please tap the video to start.');
          } else {
            toast.error('Error playing video: ' + playError.message);
          }
        }
      } else if (localVideoRef.current) {
        // If no live video tracks, ensure video element is cleared
        localVideoRef.current.srcObject = null;
        console.log('⚠️ MEDIA: No live video tracks, local video preview cleared.');
      }
      
      return stream;
        
    } catch (error) {
      console.error('❌ MEDIA: Failed to initialize automatically:', error);
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