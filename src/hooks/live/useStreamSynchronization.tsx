
import { useCallback, useEffect, useRef } from 'react';
import { streamTracker } from '@/utils/debug/streamTracker';

interface StreamStatus {
  participantId: string;
  streamId: string;
  lastHeartbeat: number;
  isDisplayed: boolean;
  confirmationReceived: boolean;
}

export const useStreamSynchronization = () => {
  const streamStatusRef = useRef<Map<string, StreamStatus>>(new Map());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  
  const updateStreamStatus = useCallback((
    participantId: string, 
    streamId: string, 
    updates: Partial<Omit<StreamStatus, 'participantId' | 'streamId'>>
  ) => {
    const current = streamStatusRef.current.get(participantId) || {
      participantId,
      streamId,
      lastHeartbeat: 0,
      isDisplayed: false,
      confirmationReceived: false
    };
    
    const updated = { ...current, ...updates, lastHeartbeat: Date.now() };
    streamStatusRef.current.set(participantId, updated);
    
    console.log('💓 STREAM SYNC: Updated status for:', participantId, updated);
    return updated;
  }, []);

  const confirmStreamReceived = useCallback((participantId: string, streamId: string) => {
    console.log('✅ STREAM SYNC: Confirming stream received for:', participantId);
    
    updateStreamStatus(participantId, streamId, {
      confirmationReceived: true,
      isDisplayed: false // Not displayed yet
    });
    
    // Send confirmation back to mobile if needed
    const sessionId = window.sessionStorage.getItem('currentSessionId');
    if (sessionId) {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'stream-confirmation',
        participantId,
        streamId,
        timestamp: Date.now()
      });
      channel.close();
    }
  }, [updateStreamStatus]);

  const confirmStreamDisplayed = useCallback((participantId: string, streamId: string) => {
    console.log('🎬 STREAM SYNC: Confirming stream displayed for:', participantId);
    
    updateStreamStatus(participantId, streamId, {
      isDisplayed: true
    });
    
    streamTracker.logEvent({
      type: 'displayed',
      participantId,
      streamId,
      details: { confirmed: true }
    });
  }, [updateStreamStatus]);

  const getStreamHealth = useCallback((participantId: string): 'healthy' | 'unhealthy' | 'unknown' => {
    const status = streamStatusRef.current.get(participantId);
    if (!status) return 'unknown';
    
    const timeSinceHeartbeat = Date.now() - status.lastHeartbeat;
    const isStale = timeSinceHeartbeat > 10000; // 10 seconds
    
    if (isStale) return 'unhealthy';
    if (status.confirmationReceived && status.isDisplayed) return 'healthy';
    if (status.confirmationReceived) return 'unhealthy'; // Received but not displayed
    
    return 'unknown';
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      streamStatusRef.current.forEach((status, participantId) => {
        const health = getStreamHealth(participantId);
        
        console.log(`💓 STREAM SYNC: Heartbeat for ${participantId}:`, {
          health,
          timeSinceLastHeartbeat: Date.now() - status.lastHeartbeat,
          isDisplayed: status.isDisplayed,
          confirmationReceived: status.confirmationReceived
        });
        
        // Alert if stream is unhealthy
        if (health === 'unhealthy') {
          console.warn(`⚠️ STREAM SYNC: Unhealthy stream detected for ${participantId}`);
          
          // Dispatch event for UI to show recovery options
          window.dispatchEvent(new CustomEvent('streamUnhealthy', {
            detail: { participantId, status }
          }));
        }
      });
    }, 5000);
  }, [getStreamHealth]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    startHeartbeat();
    return stopHeartbeat;
  }, [startHeartbeat, stopHeartbeat]);

  const getDebugInfo = useCallback(() => {
    const statusMap = Object.fromEntries(streamStatusRef.current.entries());
    
    return {
      activeStreams: streamStatusRef.current.size,
      statuses: statusMap,
      healthSummary: Array.from(streamStatusRef.current.keys()).reduce((acc, id) => {
        acc[getStreamHealth(id)] = (acc[getStreamHealth(id)] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [getStreamHealth]);

  return {
    updateStreamStatus,
    confirmStreamReceived,
    confirmStreamDisplayed,
    getStreamHealth,
    getDebugInfo
  };
};
