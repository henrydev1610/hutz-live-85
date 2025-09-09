import { useCallback, useEffect, useState } from 'react';
import { toast } from "sonner";
import { useMediaState } from './useMediaState';
import { useMediaControls } from './useMediaControls';
import { useStreamMutex } from './useStreamMutex';
import { useTrackHealthMonitor } from './useTrackHealthMonitor';
import { useVideoTrackRecovery } from './useVideoTrackRecovery';

export const useParticipantMedia = (participantId: string) => {
  console.log('🎯 MOBILE-VIDEO-ONLY: Initializing video-only media for participant:', participantId);
  
  // Initialize basic media state
  const mediaState = useMediaState();
  const mediaControls = useMediaControls({
    localStreamRef: mediaState.localStreamRef,
    screenStreamRef: mediaState.screenStreamRef,
    localVideoRef: mediaState.localVideoRef,
    isVideoEnabled: mediaState.isVideoEnabled,
    setIsVideoEnabled: mediaState.setIsVideoEnabled,
    isAudioEnabled: mediaState.isAudioEnabled,
    setIsAudioEnabled: mediaState.setIsAudioEnabled,
    hasScreenShare: mediaState.hasScreenShare,
    setHasScreenShare: mediaState.setHasScreenShare
  });
  
  // STREAM PROTECTION: Ensure only one operation at a time
  const {
    acquireLock,
    releaseLock,
    isOperationAllowed,
    withMutexLock
  } = useStreamMutex(participantId);
  
  // MOBILE VIDEO CAPTURE: Import and initialize mobile video capture
  const [mobileCapture, setMobileCapture] = useState<any>(null);
  
  useEffect(() => {
    // Dynamically import mobile capture to avoid SSR issues
    import('@/utils/media/MobileVideoCapture').then(({ mobileVideoCapture }) => {
      setMobileCapture(mobileVideoCapture);
    });
  }, []);
  
  // TRACK HEALTH MONITORING: Only use track properties (not video element state)
  const {
    startMonitoring,
    stopMonitoring,
    lastHealthStatus
  } = useTrackHealthMonitor(
    participantId,
    mediaState.localStreamRef.current,
    (healthStatus) => {
      console.log('🏥 MOBILE-VIDEO: Track health based on track properties:', healthStatus);
      
      // Only trigger recovery based on actual track state
      if (!healthStatus.isHealthy && healthStatus.trackCount > 0) {
        console.log('🔄 MOBILE-VIDEO: Unhealthy track detected - triggering recovery');
        recoverVideoTrack('track health monitoring detected issues');
      }
    },
    (participantId) => {
      console.log('🔇 MOBILE-VIDEO: Video track muted (from track, not element):', participantId);
    },
    (participantId) => {
      console.log('⚰️ MOBILE-VIDEO: Video track ended:', participantId);
      recoverVideoTrack('track ended - likely OS suspension');
    }
  );
  
  // VIDEO RECOVERY: Handle track replacement without connection reset
  const {
    recoverVideoTrack,
    setupTrackHealthMonitoring,
    isRecoveryInProgress,
    getRecoveryAttempts,
    resetRecoveryAttempts
  } = useVideoTrackRecovery({
    participantId,
    currentStream: mediaState.localStreamRef,
    videoRef: mediaState.localVideoRef,
    onStreamUpdate: (newStream: MediaStream) => {
      console.log('🔄 MOBILE-VIDEO: Stream updated via recovery - using replaceTrack:', {
        newStreamId: newStream.id,
        videoTracks: newStream.getVideoTracks().length
      });
      
      // Update stream reference
      mediaState.localStreamRef.current = newStream;
      
      // Restart monitoring
      stopMonitoring();
      setTimeout(() => startMonitoring(), 1000);
      
      // Update offscreen priming element (not visible UI)
      if (mediaState.localVideoRef.current) {
        mediaState.localVideoRef.current.srcObject = newStream;
      }
    },
    webrtcSender: undefined
  });

  const initializeMedia = async (): Promise<MediaStream | null> => {
    console.log('🎯 MOBILE-VIDEO-ONLY: Starting video-only initialization');
    
    // Check if another operation is in progress
    if (!isOperationAllowed('initialize_media')) {
      console.log('🔒 MOBILE-VIDEO: Initialization blocked by mutex');
      return null;
    }
    
    return withMutexLock('initialize_media', async () => {
      try {
        // Use mobile video capture for video-only stream
        if (!mobileCapture) {
          console.error('❌ MOBILE-VIDEO: Mobile capture not initialized');
          return null;
        }
        
        return new Promise<MediaStream | null>((resolve) => {
          mobileCapture.startCapture((stream: MediaStream) => {
            console.log('✅ MOBILE-VIDEO: Video-only stream obtained:', {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              active: stream.active
            });
            
            // Validate this is video-only
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            
            if (audioTracks.length > 0) {
              console.warn('⚠️ MOBILE-VIDEO: Unexpected audio tracks found, removing them');
              audioTracks.forEach(track => {
                stream.removeTrack(track);
                track.stop();
              });
            }
            
            if (videoTracks.length === 0) {
              console.error('❌ MOBILE-VIDEO: No video tracks in stream');
              resolve(null);
              return;
            }
            
            // Store stream reference
            mediaState.localStreamRef.current = stream;
            
            // Set global shared stream for handshake reuse
            (window as any).__participantSharedStream = stream;
            (window as any).__globalParticipantStream = stream;
            
            console.log('🛡️ MOBILE-VIDEO: Stream globally shared for WebRTC');
            
            // Update component state - video only, no audio
            mediaState.setHasVideo(true);
            mediaState.setHasAudio(false);
            
            // Start health monitoring based on track properties only
            console.log('🏥 MOBILE-VIDEO: Starting track-based health monitoring');
            startMonitoring();
            
            // Setup track monitoring for the video track
            if (videoTracks[0]) {
              setupTrackHealthMonitoring(videoTracks[0]);
            }
            
            console.log('✅ MOBILE-VIDEO: Video-only initialization completed');
            resolve(stream);
          });
        });
        
      } catch (error) {
        console.error('❌ MOBILE-VIDEO: Initialization failed:', error);
        mediaState.setHasVideo(false);
        mediaState.setHasAudio(false);
        return null;
      }
    });
  };

  return {
    // State
    hasVideo: mediaState.hasVideo,
    hasAudio: mediaState.hasAudio,
    hasScreenShare: mediaState.hasScreenShare,
    isVideoEnabled: mediaState.isVideoEnabled,
    isAudioEnabled: mediaState.isAudioEnabled,
    localVideoRef: mediaState.localVideoRef,
    localStreamRef: mediaState.localStreamRef,
    
    // Control functions
    initializeMedia,
    retryMediaInitialization: initializeMedia, // Alias for ParticipantPage compatibility
    isStreamOperationAllowed: isOperationAllowed,
    recoverVideoTrack,
    
    // Monitoring status
    trackHealthStatus: lastHealthStatus,
    isRecoveryInProgress: isRecoveryInProgress(),
    
    // Spread media controls
    ...mediaControls,
    
    // Cleanup function
    cleanup: () => {
      console.log('🧹 MOBILE-VIDEO: Cleaning up media resources');
      
      // Stop monitoring
      stopMonitoring();
      
      // Clean up mobile capture
      if (mobileCapture) {
        mobileCapture.cleanup();
      }
      
      // Stop tracks
      if (mediaState.localStreamRef.current) {
        mediaState.localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Clear global references
      (window as any).__participantSharedStream = null;
      (window as any).__globalParticipantStream = null;
      
      console.log('✅ MOBILE-VIDEO: Cleanup completed');
    }
  };
};
