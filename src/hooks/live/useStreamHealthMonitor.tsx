// FASE 5: Stream Health Monitoring Hook
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface StreamHealthMetrics {
  participantId: string;
  streamId: string;
  connected: boolean;
  lastActiveTime: number;
  trackCount: number;
  videoTracks: number;
  audioTracks: number;
  healthy: boolean;
}

interface UseStreamHealthMonitorProps {
  participantStreams: {[id: string]: MediaStream};
  onStreamIssue: (participantId: string, issue: string) => void;
}

export const useStreamHealthMonitor = ({ 
  participantStreams, 
  onStreamIssue 
}: UseStreamHealthMonitorProps) => {
  const [healthMetrics, setHealthMetrics] = useState<Map<string, StreamHealthMetrics>>(new Map());
  const [monitoringActive, setMonitoringActive] = useState(false);

  // FASE 5: Health check function
  const performHealthCheck = useCallback(() => {
    const currentTime = Date.now();
    const newMetrics = new Map<string, StreamHealthMetrics>();
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const previousMetrics = healthMetrics.get(participantId);
      
      const metrics: StreamHealthMetrics = {
        participantId,
        streamId: stream.id,
        connected: stream.active,
        lastActiveTime: currentTime,
        trackCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        healthy: stream.active && stream.getTracks().length > 0
      };
      
      // Check for stream issues
      if (previousMetrics && !metrics.healthy && previousMetrics.healthy) {
        console.warn(`⚠️ STREAM HEALTH: Stream became unhealthy for ${participantId}`);
        onStreamIssue(participantId, 'Stream became inactive');
        
        toast.error(`Problema com vídeo de ${participantId}`, {
          description: 'Tentando reconectar automaticamente...'
        });
      }
      
      // Check for track loss
      if (previousMetrics && metrics.trackCount < previousMetrics.trackCount) {
        console.warn(`⚠️ STREAM HEALTH: Track loss detected for ${participantId}`);
        onStreamIssue(participantId, 'Track loss detected');
      }
      
      newMetrics.set(participantId, metrics);
    });
    
    setHealthMetrics(newMetrics);
    
    // Log health summary
    console.log('🏥 STREAM HEALTH SUMMARY:', {
      totalStreams: newMetrics.size,
      healthyStreams: Array.from(newMetrics.values()).filter(m => m.healthy).length,
      unhealthyStreams: Array.from(newMetrics.values()).filter(m => !m.healthy).length
    });
    
  }, [participantStreams, healthMetrics, onStreamIssue]);

  // FASE 5: Start monitoring
  useEffect(() => {
    if (Object.keys(participantStreams).length > 0) {
      console.log('🏥 STREAM HEALTH: Starting health monitoring');
      setMonitoringActive(true);
      
      const healthInterval = setInterval(performHealthCheck, 3000); // Check every 3 seconds
      
      return () => {
        console.log('🏥 STREAM HEALTH: Stopping health monitoring');
        clearInterval(healthInterval);
        setMonitoringActive(false);
      };
    }
  }, [participantStreams, performHealthCheck]);

  // FASE 5: Force health check
  const forceHealthCheck = useCallback(() => {
    console.log('🏥 STREAM HEALTH: Force health check triggered');
    performHealthCheck();
  }, [performHealthCheck]);

  // FASE 5: Get health status
  const getHealthStatus = useCallback(() => {
    const metrics = Array.from(healthMetrics.values());
    return {
      totalStreams: metrics.length,
      healthyStreams: metrics.filter(m => m.healthy).length,
      unhealthyStreams: metrics.filter(m => !m.healthy).length,
      lastCheck: Math.max(...metrics.map(m => m.lastActiveTime), 0)
    };
  }, [healthMetrics]);

  return {
    healthMetrics,
    monitoringActive,
    forceHealthCheck,
    getHealthStatus
  };
};