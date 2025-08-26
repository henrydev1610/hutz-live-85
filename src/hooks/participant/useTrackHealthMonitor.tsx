import { useEffect, useRef, useCallback } from 'react';
import { streamLogger } from '@/utils/debug/StreamLogger';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';

interface TrackHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  trackCount: number;
  activeVideoTracks: number;
  activeAudioTracks: number;
}

export const useTrackHealthMonitor = (
  participantId: string,
  stream: MediaStream | null,
  onHealthChange?: (status: TrackHealthStatus) => void
) => {
  const healthInterval = useRef<NodeJS.Timeout | null>(null);
  const lastHealthStatus = useRef<TrackHealthStatus>({
    isHealthy: false,
    lastCheck: 0,
    trackCount: 0,
    activeVideoTracks: 0,
    activeAudioTracks: 0
  });

  const checkTrackHealth = useCallback((): TrackHealthStatus => {
    const now = Date.now();
    
    if (!stream) {
      return {
        isHealthy: false,
        lastCheck: now,
        trackCount: 0,
        activeVideoTracks: 0,
        activeAudioTracks: 0
      };
    }

    const allTracks = stream.getTracks();
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    const activeTracks = allTracks.filter(t => t.readyState === 'live' && t.enabled);
    const activeVideoTracks = videoTracks.filter(t => t.readyState === 'live' && t.enabled);
    const activeAudioTracks = audioTracks.filter(t => t.readyState === 'live' && t.enabled);

    const status: TrackHealthStatus = {
      isHealthy: stream.active && activeVideoTracks.length > 0,
      lastCheck: now,
      trackCount: activeTracks.length,
      activeVideoTracks: activeVideoTracks.length,
      activeAudioTracks: activeAudioTracks.length
    };

    // Log health status changes
    if (lastHealthStatus.current.isHealthy !== status.isHealthy) {
      const isMobile = detectMobileAggressively();
      const deviceType = isMobile ? 'mobile' : 'desktop';
      
      console.log(`🔍 [TRACK-HEALTH] Status changed:`, {
        participantId,
        wasHealthy: lastHealthStatus.current.isHealthy,
        nowHealthy: status.isHealthy,
        streamActive: stream.active,
        trackCount: status.trackCount,
        activeVideo: status.activeVideoTracks,
        activeAudio: status.activeAudioTracks
      });

      streamLogger.log(
        'VALIDATION' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: now, duration: 0 },
        undefined,
        'TRACK_HEALTH_CHANGE',
        `Track health changed: ${lastHealthStatus.current.isHealthy} -> ${status.isHealthy}`,
        status
      );

      if (onHealthChange) {
        onHealthChange(status);
      }
    }

    lastHealthStatus.current = status;
    return status;
  }, [stream, participantId, onHealthChange]);

  const setupTrackEventListeners = useCallback(() => {
    if (!stream) return () => {};

    const cleanup: (() => void)[] = [];
    const isMobile = detectMobileAggressively();
    const deviceType = isMobile ? 'mobile' : 'desktop';

    stream.getTracks().forEach(track => {
      const onEnded = () => {
        console.warn(`⚠️ [TRACK-HEALTH] Track ${track.kind} ended unexpectedly`);
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_ended_unexpected', track);
        checkTrackHealth();
      };

      const onMute = () => {
        console.warn(`🔇 [TRACK-HEALTH] Track ${track.kind} muted`);
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_muted', track);
        checkTrackHealth();
      };

      const onUnmute = () => {
        console.log(`🔊 [TRACK-HEALTH] Track ${track.kind} unmuted`);
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_unmuted', track);
        checkTrackHealth();
      };

      track.addEventListener('ended', onEnded);
      track.addEventListener('mute', onMute);
      track.addEventListener('unmute', onUnmute);

      cleanup.push(() => {
        track.removeEventListener('ended', onEnded);
        track.removeEventListener('mute', onMute);
        track.removeEventListener('unmute', onUnmute);
      });
    });

    return () => cleanup.forEach(fn => fn());
  }, [stream, participantId, checkTrackHealth]);

  const startMonitoring = useCallback((intervalMs: number = 3000) => {
    if (healthInterval.current) {
      clearInterval(healthInterval.current);
    }

    console.log(`🔍 [TRACK-HEALTH] Starting monitoring for ${participantId}`);
    
    // Initial check
    checkTrackHealth();
    
    // Setup event listeners
    const cleanupListeners = setupTrackEventListeners();

    // Periodic checks
    healthInterval.current = setInterval(() => {
      checkTrackHealth();
    }, intervalMs);

    return () => {
      if (healthInterval.current) {
        clearInterval(healthInterval.current);
        healthInterval.current = null;
      }
      cleanupListeners();
    };
  }, [participantId, checkTrackHealth, setupTrackEventListeners]);

  const stopMonitoring = useCallback(() => {
    if (healthInterval.current) {
      clearInterval(healthInterval.current);
      healthInterval.current = null;
    }
    console.log(`🔍 [TRACK-HEALTH] Stopped monitoring for ${participantId}`);
  }, [participantId]);

  // Auto-start monitoring when stream is available
  useEffect(() => {
    if (stream) {
      const cleanup = startMonitoring();
      return cleanup;
    } else {
      stopMonitoring();
    }
  }, [stream, startMonitoring, stopMonitoring]);

  return {
    checkTrackHealth,
    startMonitoring,
    stopMonitoring,
    lastHealthStatus: lastHealthStatus.current
  };
};