import { useEffect, useRef, useCallback } from 'react';

interface VideoHealthMetrics {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
  networkState: number;
  buffered: number;
  currentTime: number;
  duration: number;
}

export const useVideoHealthMonitor = (
  participantId: string,
  videoElement: HTMLVideoElement | null,
  onHealthChange?: (isHealthy: boolean, metrics: VideoHealthMetrics) => void
) => {
  const healthInterval = useRef<NodeJS.Timeout | null>(null);
  const lastHealthy = useRef<boolean>(false);

  const checkVideoHealth = useCallback((): boolean => {
    if (!videoElement) return false;

    const metrics: VideoHealthMetrics = {
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      readyState: videoElement.readyState,
      networkState: videoElement.networkState,
      buffered: videoElement.buffered.length > 0 ? videoElement.buffered.end(0) : 0,
      currentTime: videoElement.currentTime,
      duration: videoElement.duration || 0
    };

    // FASE 8: Health based on videoWidth>0 on host (not videoEl.muted)
    const isHealthy = 
      videoElement.videoWidth > 0 &&
      videoElement.videoHeight > 0 &&
      videoElement.readyState >= 2 && // HAVE_CURRENT_DATA or higher
      !videoElement.paused &&
      !videoElement.ended;

    // Log health changes
    if (lastHealthy.current !== isHealthy) {
      console.log(`📺 [VIDEO-HEALTH] Health changed for ${participantId}:`, {
        wasHealthy: lastHealthy.current,
        nowHealthy: isHealthy,
        metrics
      });
      
      lastHealthy.current = isHealthy;
      
      if (onHealthChange) {
        onHealthChange(isHealthy, metrics);
      }
    }

    return isHealthy;
  }, [videoElement, participantId, onHealthChange]);

  const startMonitoring = useCallback((intervalMs: number = 1000) => {
    if (healthInterval.current) {
      clearInterval(healthInterval.current);
    }

    console.log(`📺 [VIDEO-HEALTH] Starting monitoring for ${participantId}`);
    
    healthInterval.current = setInterval(() => {
      checkVideoHealth();
    }, intervalMs);

    return () => {
      if (healthInterval.current) {
        clearInterval(healthInterval.current);
        healthInterval.current = null;
      }
    };
  }, [participantId, checkVideoHealth]);

  const stopMonitoring = useCallback(() => {
    if (healthInterval.current) {
      clearInterval(healthInterval.current);
      healthInterval.current = null;
    }
    console.log(`📺 [VIDEO-HEALTH] Stopped monitoring for ${participantId}`);
  }, [participantId]);

  // Auto-start monitoring when video element is available
  useEffect(() => {
    if (videoElement) {
      const cleanup = startMonitoring();
      return cleanup;
    } else {
      stopMonitoring();
    }
  }, [videoElement, startMonitoring, stopMonitoring]);

  return {
    checkVideoHealth,
    startMonitoring,
    stopMonitoring,
    isHealthy: lastHealthy.current
  };
};