import { useCallback, useRef, useEffect } from 'react';

interface VideoTrackRecoveryProps {
  participantId: string;
  currentStream: React.RefObject<MediaStream | null>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStreamUpdate: (newStream: MediaStream) => void;
  webrtcSender?: RTCRtpSender;
}

export const useVideoTrackRecovery = ({
  participantId,
  currentStream,
  videoRef,
  onStreamUpdate,
  webrtcSender
}: VideoTrackRecoveryProps) => {
  const recoveryInProgress = useRef(false);
  const recoveryAttempts = useRef(0);
  const visibilityRecoveryTimer = useRef<NodeJS.Timeout>();
  const MAX_RECOVERY_ATTEMPTS = 3;
  const RECOVERY_BACKOFF = 2000;

  const recoverVideoTrack = useCallback(async (reason: string): Promise<boolean> => {
    if (recoveryInProgress.current) {
      console.log(`🔄 [RECOVERY] Already in progress, skipping: ${reason}`);
      return false;
    }

    if (recoveryAttempts.current >= MAX_RECOVERY_ATTEMPTS) {
      console.error(`❌ [RECOVERY] Max attempts reached (${MAX_RECOVERY_ATTEMPTS})`);
      return false;
    }

    recoveryInProgress.current = true;
    recoveryAttempts.current++;

    console.warn(`🚨 [RECOVERY] Attempting recovery #${recoveryAttempts.current} due to: ${reason}`);

    try {
      // Wait for backoff
      if (recoveryAttempts.current > 1) {
        await new Promise(resolve => setTimeout(resolve, RECOVERY_BACKOFF * recoveryAttempts.current));
      }

      // Create new stream with same constraints
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack || newVideoTrack.readyState !== 'live') {
        throw new Error('New track is not live');
      }

      // Update preview video
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        try {
          await videoRef.current.play();
          console.log('📺 [RECOVERY] Preview video restarted');
        } catch (playError) {
          console.warn('⚠️ [RECOVERY] Preview play failed:', playError);
        }
      }

      // Replace track in WebRTC if sender exists
      if (webrtcSender) {
        try {
          await webrtcSender.replaceTrack(newVideoTrack);
          console.log('🔄 [RECOVERY] WebRTC track replaced successfully');
        } catch (replaceError) {
          console.error('❌ [RECOVERY] Failed to replace WebRTC track:', replaceError);
          throw replaceError;
        }
      }

      // Stop old stream tracks
      if (currentStream.current) {
        currentStream.current.getTracks().forEach(track => {
          console.log(`🛑 [RECOVERY] Stopping old track: ${track.kind}`);
          track.stop();
        });
      }

      // Update stream reference through the callback
      // Note: We can't assign directly to ref.current as it's read-only
      onStreamUpdate(newStream);

      // Setup health monitoring for new track
      setupTrackHealthMonitoring(newVideoTrack);

      // Reset recovery state on success
      recoveryAttempts.current = 0;
      recoveryInProgress.current = false;

      console.log('✅ [RECOVERY] Video track recovery successful');
      return true;

    } catch (error) {
      console.error(`❌ [RECOVERY] Attempt #${recoveryAttempts.current} failed:`, error);
      recoveryInProgress.current = false;
      
      if (recoveryAttempts.current >= MAX_RECOVERY_ATTEMPTS) {
        console.error('💀 [RECOVERY] All recovery attempts exhausted');
      }
      
      return false;
    }
  }, [participantId, currentStream, videoRef, onStreamUpdate, webrtcSender]);

  const setupTrackHealthMonitoring = useCallback((track: MediaStreamTrack) => {
    // Remove existing listeners to prevent duplicates
    track.onmute = null;
    track.onended = null;
    track.onunmute = null;

    track.onmute = () => {
      console.warn('🔇 [TRACK-HEALTH] Video track muted - triggering recovery');
      recoverVideoTrack('track muted');
    };

    track.onended = () => {
      console.warn('⏹️ [TRACK-HEALTH] Video track ended - triggering recovery');
      recoverVideoTrack('track ended');
    };

    track.onunmute = () => {
      console.log('🔊 [TRACK-HEALTH] Video track unmuted');
      // Reset recovery attempts when track recovers naturally
      recoveryAttempts.current = 0;
    };

    console.log('👂 [RECOVERY] Track health monitoring established');
  }, [recoverVideoTrack]);

  // Visibility change monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible again
        console.log('👁️ [VISIBILITY] Page became visible');
        
        // Clear any pending recovery timer
        if (visibilityRecoveryTimer.current) {
          clearTimeout(visibilityRecoveryTimer.current);
        }

        // Check track health after a brief delay
        visibilityRecoveryTimer.current = setTimeout(() => {
          if (currentStream.current) {
            const videoTrack = currentStream.current.getVideoTracks()[0];
            if (videoTrack && (videoTrack.muted || videoTrack.readyState !== 'live')) {
              console.warn('🚨 [VISIBILITY] Track is muted/dead after becoming visible');
              recoverVideoTrack('tab visible but track muted');
            }
          }
        }, 1000);
      } else {
        console.log('👁️ [VISIBILITY] Page became hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityRecoveryTimer.current) {
        clearTimeout(visibilityRecoveryTimer.current);
      }
    };
  }, [currentStream, recoverVideoTrack]);

  return {
    recoverVideoTrack,
    setupTrackHealthMonitoring,
    isRecoveryInProgress: () => recoveryInProgress.current,
    getRecoveryAttempts: () => recoveryAttempts.current,
    resetRecoveryAttempts: () => { recoveryAttempts.current = 0; }
  };
};