import { useCallback, useEffect, useRef, useState } from 'react';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

interface WebRTCStabilityMetrics {
  connectionState: {
    websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
    webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
    overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
  };
  participantConnections: Map<string, {
    state: RTCPeerConnectionState;
    iceState: RTCIceConnectionState;
    lastHeartbeat: number;
    reconnectAttempts: number;
  }>;
  websocketPingLatency: number;
  lastWebSocketPing: number;
  totalReconnections: number;
  isStable: boolean;
}

interface StabilityConfig {
  websocketPingInterval: number;
  connectionHealthCheckInterval: number;
  maxReconnectAttempts: number;
  reconnectDelayMultiplier: number;
  aggressiveModeForMobile: boolean;
}

const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  websocketPingInterval: 3000, // 3s for aggressive monitoring
  connectionHealthCheckInterval: 2000, // 2s health checks
  maxReconnectAttempts: 10,
  reconnectDelayMultiplier: 1.5,
  aggressiveModeForMobile: true
};

export const useEnhancedWebRTCStability = (
  peerConnections: Map<string, RTCPeerConnection>,
  config: Partial<StabilityConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_STABILITY_CONFIG, ...config };
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const [metrics, setMetrics] = useState<WebRTCStabilityMetrics>({
    connectionState: {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    },
    participantConnections: new Map(),
    websocketPingLatency: 0,
    lastWebSocketPing: 0,
    totalReconnections: 0,
    isStable: false
  });

  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(new Map<string, number>());
  const lastStabilityCheckRef = useRef(Date.now());

  // Enhanced WebSocket ping with latency measurement
  const performWebSocketPing = useCallback(async () => {
    if (!unifiedWebSocketService.isConnected()) {
      setMetrics(prev => ({
        ...prev,
        connectionState: {
          ...prev.connectionState,
          websocket: 'failed'
        }
      }));
      return false;
    }

    try {
      const startTime = Date.now();
      const isHealthy = await unifiedWebSocketService.healthCheck();
      const latency = Date.now() - startTime;
      
      setMetrics(prev => ({
        ...prev,
        websocketPingLatency: latency,
        lastWebSocketPing: Date.now(),
        connectionState: {
          ...prev.connectionState,
          websocket: isHealthy ? 'connected' : 'failed'
        }
      }));

      if (latency > 5000) { // 5s threshold
        console.warn(`⚠️ STABILITY: High WebSocket latency detected: ${latency}ms`);
        if (isMobile && finalConfig.aggressiveModeForMobile) {
          toast.warning('📱 High latency detected - optimizing connection...');
        }
      }

      return isHealthy;
    } catch (error) {
      console.error('❌ STABILITY: WebSocket ping failed:', error);
      setMetrics(prev => ({
        ...prev,
        connectionState: {
          ...prev.connectionState,
          websocket: 'failed'
        }
      }));
      return false;
    }
  }, [isMobile, finalConfig.aggressiveModeForMobile]);

  // Comprehensive peer connection health assessment
  const assessPeerConnectionHealth = useCallback(() => {
    const now = Date.now();
    const updatedConnections = new Map();
    let hasActiveConnections = false;
    let hasFailedConnections = false;

    peerConnections.forEach((pc, participantId) => {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      const currentData = metrics.participantConnections.get(participantId) || {
        state: 'new' as RTCPeerConnectionState,
        iceState: 'new' as RTCIceConnectionState,
        lastHeartbeat: now,
        reconnectAttempts: 0
      };

      // Check for connection degradation
      const isHealthy = state === 'connected' && 
                       (iceState === 'connected' || iceState === 'completed');
      
      if (isHealthy) {
        hasActiveConnections = true;
      } else if (state === 'failed' || iceState === 'failed') {
        hasFailedConnections = true;
        console.warn(`⚠️ STABILITY: Connection failed for ${participantId}: ${state}/${iceState}`);
      }

      updatedConnections.set(participantId, {
        state,
        iceState,
        lastHeartbeat: isHealthy ? now : currentData.lastHeartbeat,
        reconnectAttempts: currentData.reconnectAttempts
      });
    });

    // Update WebRTC connection state
    let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    if (hasActiveConnections && !hasFailedConnections) {
      webrtcState = 'connected';
    } else if (hasFailedConnections) {
      webrtcState = 'failed';
    } else if (peerConnections.size > 0) {
      webrtcState = 'connecting';
    } else {
      webrtcState = 'disconnected';
    }

    setMetrics(prev => {
      const newConnectionState = {
        ...prev.connectionState,
        webrtc: webrtcState
      };
      
      // Calculate overall state
      const overall = newConnectionState.websocket === 'connected' && 
                     (newConnectionState.webrtc === 'connected' || peerConnections.size === 0)
                     ? 'connected'
                     : newConnectionState.websocket === 'failed' || newConnectionState.webrtc === 'failed'
                     ? 'failed'
                     : 'connecting';

      newConnectionState.overall = overall;

      return {
        ...prev,
        connectionState: newConnectionState,
        participantConnections: updatedConnections,
        isStable: overall === 'connected' && (now - lastStabilityCheckRef.current) > 10000 // Stable for 10s
      };
    });

    lastStabilityCheckRef.current = now;
  }, [peerConnections, metrics.participantConnections]);

  // Intelligent reconnection strategy
  const handleConnectionRecovery = useCallback(async (participantId?: string) => {
    console.log(`🔄 STABILITY: Initiating connection recovery${participantId ? ` for ${participantId}` : ''}`);
    
    const currentAttempts = reconnectAttemptsRef.current.get(participantId || 'websocket') || 0;
    
    if (currentAttempts >= finalConfig.maxReconnectAttempts) {
      console.error(`❌ STABILITY: Max reconnection attempts reached for ${participantId || 'websocket'}`);
      toast.error('❌ Connection recovery failed - max attempts reached');
      return false;
    }

    reconnectAttemptsRef.current.set(participantId || 'websocket', currentAttempts + 1);
    
    try {
      if (participantId) {
        // Peer connection recovery
        const pc = peerConnections.get(participantId);
        if (pc) {
          console.log(`🔄 STABILITY: Restarting ICE for ${participantId}`);
          await pc.restartIce();
        }
      } else {
        // WebSocket recovery
        console.log('🔄 STABILITY: Reconnecting WebSocket...');
        await unifiedWebSocketService.forceReconnect();
        
        setMetrics(prev => ({
          ...prev,
          totalReconnections: prev.totalReconnections + 1
        }));
      }
      
      // Reset attempts on success
      reconnectAttemptsRef.current.delete(participantId || 'websocket');
      console.log(`✅ STABILITY: Recovery successful for ${participantId || 'websocket'}`);
      
      if (isMobile) {
        toast.success('📱 Connection recovered successfully!');
      }
      
      return true;
    } catch (error) {
      console.error(`❌ STABILITY: Recovery failed for ${participantId || 'websocket'}:`, error);
      
      // Schedule retry with exponential backoff
      const delay = 1000 * Math.pow(finalConfig.reconnectDelayMultiplier, currentAttempts);
      setTimeout(() => {
        handleConnectionRecovery(participantId);
      }, Math.min(delay, 30000)); // Max 30s delay
      
      return false;
    }
  }, [finalConfig.maxReconnectAttempts, finalConfig.reconnectDelayMultiplier, peerConnections, isMobile]);

  // Start monitoring systems
  const startStabilityMonitoring = useCallback(() => {
    console.log(`🔍 STABILITY: Starting enhanced monitoring (Mobile: ${isMobile})`);
    
    // WebSocket ping monitoring
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(async () => {
      const isHealthy = await performWebSocketPing();
      if (!isHealthy && finalConfig.aggressiveModeForMobile && isMobile) {
        handleConnectionRecovery();
      }
    }, finalConfig.websocketPingInterval);

    // Connection health monitoring
    if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
    healthCheckIntervalRef.current = setInterval(() => {
      assessPeerConnectionHealth();
    }, finalConfig.connectionHealthCheckInterval);

  }, [isMobile, finalConfig.websocketPingInterval, finalConfig.connectionHealthCheckInterval, finalConfig.aggressiveModeForMobile, performWebSocketPing, assessPeerConnectionHealth, handleConnectionRecovery]);

  // Stop monitoring
  const stopStabilityMonitoring = useCallback(() => {
    console.log('🛑 STABILITY: Stopping monitoring');
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Force full recovery
  const forceFullRecovery = useCallback(async () => {
    console.log('💪 STABILITY: Force full recovery initiated');
    toast.info('🔄 Forcing full connection recovery...');
    
    stopStabilityMonitoring();
    
    // Clear all reconnection attempts
    reconnectAttemptsRef.current.clear();
    
    try {
      // Force WebSocket reconnection
      await handleConnectionRecovery();
      
      // Restart monitoring
      setTimeout(() => {
        startStabilityMonitoring();
      }, 2000);
      
      toast.success('✅ Full recovery completed!');
    } catch (error) {
      console.error('❌ STABILITY: Force recovery failed:', error);
      toast.error('❌ Force recovery failed');
    }
  }, [stopStabilityMonitoring, handleConnectionRecovery, startStabilityMonitoring]);

  // Auto-start monitoring
  useEffect(() => {
    startStabilityMonitoring();
    return stopStabilityMonitoring;
  }, [startStabilityMonitoring, stopStabilityMonitoring]);

  return {
    metrics,
    startStabilityMonitoring,
    stopStabilityMonitoring,
    forceFullRecovery,
    handleConnectionRecovery,
    isMobile,
    config: finalConfig
  };
};