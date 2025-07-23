import { useCallback, useEffect, useRef } from 'react';

interface VideoHeartbeatProps {
  participantId: string;
  stream: MediaStream | null;
  onVideoLost: (participantId: string) => void;
  onVideoRestored: (participantId: string) => void;
}

export const useVideoHeartbeat = ({ 
  participantId, 
  stream, 
  onVideoLost, 
  onVideoRestored 
}: VideoHeartbeatProps) => {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthyRef = useRef<number>(Date.now());
  const isHealthyRef = useRef<boolean>(true);

  const checkVideoHealth = useCallback(() => {
    if (!stream) return false;

    // Check if stream is active
    if (!stream.active) {
      console.warn('💔 Stream inactive for:', participantId);
      return false;
    }

    // Check if video tracks exist and are enabled
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('💔 No video tracks for:', participantId);
      return false;
    }

    const hasEnabledVideo = videoTracks.some(track => track.enabled && track.readyState === 'live');
    if (!hasEnabledVideo) {
      console.warn('💔 No enabled video tracks for:', participantId);
      return false;
    }

    // Check if video element exists and is playing
    const containers = document.querySelectorAll(`[data-participant-id="${participantId}"]`);
    let hasPlayingVideo = false;

    for (const container of containers) {
      const video = container.querySelector('video');
      if (video && video.srcObject === stream && !video.paused && video.readyState >= 2) {
        hasPlayingVideo = true;
        break;
      }
    }

    if (!hasPlayingVideo) {
      console.warn('💔 No playing video element for:', participantId);
      return false;
    }

    return true;
  }, [stream, participantId]);

  const performHeartbeat = useCallback(() => {
    const isHealthy = checkVideoHealth();
    const now = Date.now();

    if (isHealthy) {
      lastHealthyRef.current = now;
      if (!isHealthyRef.current) {
        console.log('💚 Video restored for:', participantId);
        isHealthyRef.current = true;
        onVideoRestored(participantId);
      }
    } else {
      // Consider unhealthy if no healthy signal for 3 seconds
      if (now - lastHealthyRef.current > 3000 && isHealthyRef.current) {
        console.error('💔 Video lost for:', participantId);
        isHealthyRef.current = false;
        onVideoLost(participantId);
      }
    }
  }, [checkVideoHealth, participantId, onVideoLost, onVideoRestored]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(performHeartbeat, 1000);
    console.log('💓 Started video heartbeat for:', participantId);
  }, [performHeartbeat, participantId]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      console.log('💔 Stopped video heartbeat for:', participantId);
    }
  }, [participantId]);

  // Start/stop heartbeat based on stream availability
  useEffect(() => {
    if (stream) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return stopHeartbeat;
  }, [stream, startHeartbeat, stopHeartbeat]);

  return {
    startHeartbeat,
    stopHeartbeat,
    checkVideoHealth,
    isHealthy: isHealthyRef.current
  };
};