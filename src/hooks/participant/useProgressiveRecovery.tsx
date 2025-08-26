import { useCallback, useRef } from 'react';

interface ProgressiveRecoveryProps {
  currentStream: React.RefObject<MediaStream | null>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStreamUpdate: (newStream: MediaStream) => void;
  webrtcSender?: RTCRtpSender;
  onUserGestureRequired: (reason: string) => void;
  participantId: string;
}

export const useProgressiveRecovery = ({
  currentStream,
  videoRef,
  onStreamUpdate,
  webrtcSender,
  onUserGestureRequired,
  participantId
}: ProgressiveRecoveryProps) => {
  const recoveryInProgress = useRef(false);

  const attemptUnmuteTrack = useCallback(async (): Promise<boolean> => {
    if (!currentStream.current) return false;

    const videoTrack = currentStream.current.getVideoTracks()[0];
    if (!videoTrack) return false;

    console.log('🔊 [PROGRESSIVE] Attempting to unmute existing track');

    // Try to force unmute (usually doesn't work but worth trying)
    try {
      if (videoTrack.muted) {
        // Force play the video element
        if (videoRef.current) {
          videoRef.current.muted = true;
          await videoRef.current.play();
        }

        // Wait a bit and check if unmuted
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!videoTrack.muted) {
          console.log('✅ [PROGRESSIVE] Track unmuted successfully');
          return true;
        }
      }
    } catch (error) {
      console.warn('⚠️ [PROGRESSIVE] Unmute attempt failed:', error);
    }

    return false;
  }, [currentStream, videoRef]);

  const attemptReplaceTrack = useCallback(async (): Promise<boolean> => {
    if (!webrtcSender) return false;

    console.log('🔄 [PROGRESSIVE] Attempting replaceTrack with new stream');

    try {
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

      // Verify track produces frames
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Track timeout')), 2000);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadeddata = () => {
            clearTimeout(timeout);
            resolve(true);
          };
        } else {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      // Replace track in WebRTC
      await webrtcSender.replaceTrack(newVideoTrack);

      // Stop old stream
      if (currentStream.current) {
        currentStream.current.getTracks().forEach(track => track.stop());
      }

      onStreamUpdate(newStream);
      console.log('✅ [PROGRESSIVE] ReplaceTrack successful');
      return true;

    } catch (error) {
      console.error('❌ [PROGRESSIVE] ReplaceTrack failed:', error);
      
      if (error.message?.includes('Permission denied') || 
          error.message?.includes('NotAllowedError')) {
        onUserGestureRequired('Camera permission denied - user interaction required');
      }
      
      return false;
    }
  }, [currentStream, videoRef, onStreamUpdate, webrtcSender, onUserGestureRequired]);

  const attemptFullRecreation = useCallback(async (): Promise<boolean> => {
    console.log('🔥 [PROGRESSIVE] Attempting full stream recreation');

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Update preview
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      // Replace in WebRTC if possible
      if (webrtcSender) {
        try {
          await webrtcSender.replaceTrack(newVideoTrack);
        } catch (replaceError) {
          console.warn('⚠️ [PROGRESSIVE] Could not replace track, will need reconnection');
        }
      }

      // Clean up old stream
      if (currentStream.current) {
        currentStream.current.getTracks().forEach(track => track.stop());
      }

      onStreamUpdate(newStream);
      console.log('✅ [PROGRESSIVE] Full recreation successful');
      return true;

    } catch (error) {
      console.error('❌ [PROGRESSIVE] Full recreation failed:', error);
      
      if (error.message?.includes('Permission denied') || 
          error.message?.includes('NotAllowedError')) {
        onUserGestureRequired('Camera access denied - please tap to retry');
      }
      
      return false;
    }
  }, [currentStream, videoRef, onStreamUpdate, webrtcSender, onUserGestureRequired]);

  const executeProgressiveRecovery = useCallback(async (reason: string): Promise<boolean> => {
    if (recoveryInProgress.current) {
      console.log('⏳ [PROGRESSIVE] Recovery already in progress');
      return false;
    }

    recoveryInProgress.current = true;
    console.warn(`🚨 [PROGRESSIVE] Starting progressive recovery due to: ${reason}`);

    try {
      // Step 1: Try to unmute existing track
      if (await attemptUnmuteTrack()) {
        return true;
      }

      // Step 2: Try replaceTrack with new stream  
      if (await attemptReplaceTrack()) {
        return true;
      }

      // Step 3: Full stream recreation
      if (await attemptFullRecreation()) {
        return true;
      }

      // Step 4: Request user gesture as last resort
      console.warn('💀 [PROGRESSIVE] All automated recovery failed, requesting user gesture');
      onUserGestureRequired('Automatic recovery failed - tap to restart camera');
      return false;

    } finally {
      recoveryInProgress.current = false;
    }
  }, [attemptUnmuteTrack, attemptReplaceTrack, attemptFullRecreation, onUserGestureRequired]);

  return {
    executeProgressiveRecovery,
    isRecoveryInProgress: () => recoveryInProgress.current
  };
};