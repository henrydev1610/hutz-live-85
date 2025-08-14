import { useCallback, useEffect, useRef, useState } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
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
    signalingState?: RTCSignalingState;
    lastHeartbeat: number;
    reconnectAttempts: number;
    connectingStartTime?: number;
    isStuckConnecting?: boolean;
    isStalledHeartbeat?: boolean;
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

  // Enhanced connection health assessment with ontrack-based connection detection
  const assessPeerConnectionHealth = useCallback(() => {
    const now = Date.now();
    const CONNECTING_TIMEOUT = 30000; // 30s timeout for "connecting" state without ontrack
    const STALLED_HEARTBEAT_TIMEOUT = 15000; // 15s without heartbeat
    
    const updatedConnections = new Map();
    let hasActiveConnections = false;
    let hasFailedConnections = false;
    let hasStuckConnections = false;

    peerConnections.forEach((pc, participantId) => {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      const signalingState = pc.signalingState;
      
      const currentData = metrics.participantConnections.get(participantId) || {
        state: 'new' as RTCPeerConnectionState,
        iceState: 'new' as RTCIceConnectionState,
        lastHeartbeat: now,
        reconnectAttempts: 0,
        connectingStartTime: now,
        hasVideoTrack: false
      };

      // Check for ontrack reception or video receiver tracks  
      const receivers = pc.getReceivers();
      const hasVideoTrack = receivers.some(receiver => 
        receiver.track && receiver.track.kind === 'video' && receiver.track.readyState === 'live'
      );

      // WebRTC is "connected" only after ontrack OR when receiver has video track
      const isReallyConnected = hasVideoTrack || (state === 'connected' && hasVideoTrack);
      
      // Check for 30s timeout without ontrack
      const connectStartTime = currentData.connectingStartTime || now;
      const timeWithoutOntrack = now - connectStartTime;
      
      const isStuckConnecting = (state === 'connecting' || iceState === 'checking') &&
                               !hasVideoTrack && 
                               timeWithoutOntrack > CONNECTING_TIMEOUT;
      
      const isStalledHeartbeat = (now - currentData.lastHeartbeat) > STALLED_HEARTBEAT_TIMEOUT;

      // Enhanced health logic based on ontrack reception
      const isHealthy = isReallyConnected && 
                       !isStalledHeartbeat &&
                       hasVideoTrack;
      
      const isDefinitelyFailed = state === 'failed' || 
                                iceState === 'failed' || 
                                isStuckConnecting ||
                                isStalledHeartbeat ||
                                (state === 'connecting' && !hasVideoTrack && timeWithoutOntrack > CONNECTING_TIMEOUT);
      
      if (isHealthy) {
        hasActiveConnections = true;
      } else if (isDefinitelyFailed) {
        hasFailedConnections = true;
        console.warn(`⚠️ STABILITY: Connection failed for ${participantId} (no ontrack within 30s or failed state):`, {
          state, iceState, signalingState, hasVideoTrack, timeWithoutOntrack, isStuckConnecting, isStalledHeartbeat
        });
        
        // Auto-cleanup failed connections
        setTimeout(() => {
          console.log(`🧹 STABILITY: Auto-cleaning failed connection for ${participantId}`);
          pc.close();
          peerConnections.delete(participantId);
        }, 1000);
      } else if ((state === 'connecting' || iceState === 'checking') && !hasVideoTrack) {
        hasStuckConnections = true;
      }

      updatedConnections.set(participantId, {
        state: isReallyConnected ? 'connected' : state,
        iceState,
        signalingState,
        lastHeartbeat: isHealthy ? now : currentData.lastHeartbeat,
        reconnectAttempts: currentData.reconnectAttempts,
        connectingStartTime: (state === 'connecting' && !currentData.connectingStartTime) ? now : currentData.connectingStartTime,
        hasVideoTrack,
        timeWithoutOntrack,
        isStuckConnecting,
        isStalledHeartbeat
      });
    });

    // Enhanced WebRTC state based on real connection status
    let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    if (hasActiveConnections && !hasFailedConnections && !hasStuckConnections) {
      webrtcState = 'connected';
    } else if (hasFailedConnections) {
      webrtcState = 'failed';
    } else if (peerConnections.size > 0 && !hasStuckConnections) {
      webrtcState = 'connecting';
    } else if (hasStuckConnections && !hasActiveConnections) {
      webrtcState = 'failed'; // Stuck connections without ontrack = failed
    } else {
      webrtcState = 'disconnected';
    }

    setMetrics(prev => {
      const newConnectionState = {
        ...prev.connectionState,
        webrtc: webrtcState
      };
      
      // Overall state logic - prevent infinite "connecting" loop
      const overall = newConnectionState.websocket === 'connected' && 
                     newConnectionState.webrtc === 'connected'
                     ? 'connected'
                     : newConnectionState.websocket === 'failed' || newConnectionState.webrtc === 'failed'
                     ? 'failed'
                     : newConnectionState.websocket === 'connecting' || 
                       (newConnectionState.webrtc === 'connecting' && !hasStuckConnections)
                     ? 'connecting'
                     : 'disconnected';

      newConnectionState.overall = overall;

      return {
        ...prev,
        connectionState: newConnectionState,
        participantConnections: updatedConnections,
        isStable: overall === 'connected' && (now - lastStabilityCheckRef.current) > 10000
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
      
      // CORREÇÃO: Não fazer retry automático - evita loop infinito
      if (isMobile) {
        toast.error('❌ Connection recovery failed. Please try reconnecting manually.');
      }
      
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

  // SOLUÇÃO: Force full recovery com limpeza completa
  const forceFullRecovery = useCallback(async () => {
    console.log('💪 STABILITY: Force full recovery initiated');
    toast.info('🔄 Forcing full connection recovery...');
    
    stopStabilityMonitoring();
    
    // CORREÇÃO 7: Limpeza completa de conexões stuck
    peerConnections.forEach((pc, participantId) => {
      console.log(`🧹 STABILITY: Force closing connection for ${participantId}`);
      try {
        pc.close();
      } catch (err) {
        console.warn(`⚠️ STABILITY: Error closing PC for ${participantId}:`, err);
      }
    });
    
    // Clear all maps and attempts
    peerConnections.clear();
    reconnectAttemptsRef.current.clear();
    
    // Reset metrics to clean state
    setMetrics(prev => ({
      ...prev,
      participantConnections: new Map(),
      connectionState: {
        ...prev.connectionState,
        webrtc: 'disconnected',
        overall: prev.connectionState.websocket === 'connected' ? 'connected' : 'disconnected'
      },
      isStable: false
    }));
    
    try {
      // Force WebSocket reconnection
      await handleConnectionRecovery();
      
      // Restart monitoring after delay
      setTimeout(() => {
        startStabilityMonitoring();
      }, 2000);
      
      toast.success('✅ Full recovery completed - connections reset!');
    } catch (error) {
      console.error('❌ STABILITY: Force recovery failed:', error);
      toast.error('❌ Force recovery failed');
    }
  }, [stopStabilityMonitoring, handleConnectionRecovery, startStabilityMonitoring, peerConnections]);

  // SOLUÇÃO APRIMORADA: Loop detection e breaking mais inteligente
  const breakWebRTCLoop = useCallback(() => {
    console.log('🔄 STABILITY: Breaking WebRTC connecting loop - Enhanced');
    toast.info('🔄 Breaking connection loop...');
    
    const now = Date.now();
    const LOOP_DETECTION_THRESHOLD = 45000; // 45s in connecting = loop
    let loopDetected = false;
    let stuckConnections: string[] = [];
    
    // DETECÇÃO AVANÇADA: Verificar conexões em loop por tempo
    peerConnections.forEach((pc, participantId) => {
      const currentData = metrics.participantConnections.get(participantId);
      const connectingTime = currentData?.connectingStartTime || now;
      const timeInConnecting = now - connectingTime;
      
      const isDefinitelyStuck = (
        pc.connectionState === 'connecting' || 
        pc.iceConnectionState === 'checking' ||
        pc.signalingState === 'have-remote-offer'
      ) && timeInConnecting > LOOP_DETECTION_THRESHOLD;
      
      if (isDefinitelyStuck) {
        loopDetected = true;
        stuckConnections.push(participantId);
        console.log(`🔍 LOOP DETECTED: ${participantId} stuck for ${timeInConnecting}ms`);
        
        try {
          pc.close();
        } catch (err) {
          console.warn(`⚠️ Error closing stuck PC for ${participantId}:`, err);
        }
      }
    });
    
    // Cleanup stuck connections
    stuckConnections.forEach(participantId => {
      peerConnections.delete(participantId);
    });
    
    // RESET TOTAL se loop detectado mas sem conexões específicas
    if (!loopDetected && peerConnections.size > 0) {
      console.log('🔄 FORCE RESET: No specific loops but general WebRTC stuck');
      peerConnections.forEach((pc, participantId) => {
        try {
          pc.close();
          stuckConnections.push(participantId);
        } catch (err) {
          console.warn(`⚠️ Error in force reset for ${participantId}:`, err);
        }
      });
      peerConnections.clear();
      loopDetected = true;
    }
    
    // Update metrics with cleaned state
    setMetrics(prev => {
      const updatedConnections = new Map(prev.participantConnections);
      stuckConnections.forEach(participantId => {
        updatedConnections.delete(participantId);
      });
      
      const newWebRTCState = peerConnections.size === 0 ? 'disconnected' : 'connecting';
      const newOverallState = prev.connectionState.websocket === 'connected' && newWebRTCState !== 'connecting'
                             ? 'connected' 
                             : prev.connectionState.websocket === 'connected' && newWebRTCState === 'connecting'
                             ? 'connecting'
                             : 'disconnected';
      
      return {
        ...prev,
        participantConnections: updatedConnections,
        connectionState: {
          ...prev.connectionState,
          webrtc: newWebRTCState,
          overall: newOverallState
        },
        isStable: newOverallState === 'connected'
      };
    });
    
    if (loopDetected) {
      toast.success(`✅ Loop broken! Cleared ${stuckConnections.length} stuck connections`);
      console.log('✅ LOOP BROKEN: WebRTC state reset successfully');
    } else {
      toast.info('ℹ️ No connecting loops detected');
    }
    
    // Trigger global loop break event for external handlers
    window.dispatchEvent(new CustomEvent('webrtc-loop-broken', {
      detail: { clearedConnections: stuckConnections.length, timestamp: Date.now() }
    }));
  }, [peerConnections, metrics.participantConnections]);

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
    breakWebRTCLoop,
    handleConnectionRecovery, // Expose reset WebRTC action
    isMobile,
    config: finalConfig
  };
};