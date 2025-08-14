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
    ontrackReceived?: boolean;
    lastOntrackTime?: number;
    mediaStats?: {
      packetsReceived: number;
      framesDecoded: number;
      bytesReceived: number;
      lastStatsCheck: number;
    };
    recoveryAttempts: number;
    lastRecoveryTime?: number;
  }>;
  websocketPingLatency: number;
  lastWebSocketPing: number;
  totalReconnections: number;
  isStable: boolean;
}

interface StabilityConfig {
  websocketPingInterval: number;
  connectionHealthCheckInterval: number;
  maxRecoveryAttempts: number;
  recoveryDelayMultiplier: number;
  aggressiveModeForMobile: boolean;
  enableStatsMonitoring: boolean;
  statsCheckInterval: number;
}

const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  websocketPingInterval: 5000, // Relaxed from 3s to 5s
  connectionHealthCheckInterval: 3000, // Relaxed from 2s to 3s
  maxRecoveryAttempts: 3, // Reduced from 10 to 3
  recoveryDelayMultiplier: 2.0,
  aggressiveModeForMobile: false, // Disabled aggressive mode
  enableStatsMonitoring: true,
  statsCheckInterval: 2000
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
  const statsCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryAttemptsRef = useRef(new Map<string, number>());
  const lastStabilityCheckRef = useRef(Date.now());
  const ontrackEventRef = useRef(new Map<string, boolean>());

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

  // Enhanced stream detection with ontrack and getStats monitoring
  const checkMediaFlow = useCallback(async (pc: RTCPeerConnection, participantId: string) => {
    try {
      const stats = await pc.getStats();
      let packetsReceived = 0;
      let framesDecoded = 0;
      let bytesReceived = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          packetsReceived += report.packetsReceived || 0;
          framesDecoded += report.framesDecoded || 0;
          bytesReceived += report.bytesReceived || 0;
        }
      });

      console.log(`📊 STATS: Media flow for ${participantId}:`, {
        packetsReceived,
        framesDecoded,
        bytesReceived,
        timestamp: Date.now()
      });

      return {
        packetsReceived,
        framesDecoded,
        bytesReceived,
        lastStatsCheck: Date.now()
      };
    } catch (error) {
      console.warn(`⚠️ STATS: Failed to get media stats for ${participantId}:`, error);
      return null;
    }
  }, []);

  // Enhanced connection health assessment with ontrack-based detection and controlled recovery
  const assessPeerConnectionHealth = useCallback(async () => {
    const now = Date.now();
    
    const updatedConnections = new Map();
    let hasActiveConnections = false;
    let hasFailedConnections = false;
    let hasConnectingConnections = false;

    for (const [participantId, pc] of peerConnections.entries()) {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      const signalingState = pc.signalingState;
      
      const currentData = metrics.participantConnections.get(participantId) || {
        state: 'new' as RTCPeerConnectionState,
        iceState: 'new' as RTCIceConnectionState,
        lastHeartbeat: now,
        reconnectAttempts: 0,
        connectingStartTime: now,
        ontrackReceived: false,
        recoveryAttempts: 0
      };

      console.log(`🔍 HEALTH: Checking ${participantId} - State: ${state}, ICE: ${iceState}, Signaling: ${signalingState}`);

      // Check for ontrack event reception
      const ontrackReceived = ontrackEventRef.current.get(participantId) || currentData.ontrackReceived || false;
      
      // Check for active tracks via receivers (fallback)
      const receivers = pc.getReceivers();
      const hasActiveVideoTrack = receivers.some(receiver => 
        receiver.track && receiver.track.kind === 'video' && receiver.track.readyState === 'live'
      );
      const hasActiveAudioTrack = receivers.some(receiver => 
        receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live'
      );
      const hasActiveMedia = hasActiveVideoTrack || hasActiveAudioTrack;

      // Get media flow stats if available
      let mediaStats = currentData.mediaStats;
      if (finalConfig.enableStatsMonitoring && (state === 'connected' || ontrackReceived)) {
        const stats = await checkMediaFlow(pc, participantId);
        if (stats) {
          mediaStats = stats;
          console.log(`📊 STATS: Updated for ${participantId}:`, stats);
        }
      }

      // Enhanced connection detection logic
      let isConnected = false;
      let connectionMethod = 'none';
      
      if (ontrackReceived) {
        isConnected = true;
        connectionMethod = 'ontrack';
        console.log(`✅ CONNECTION: ${participantId} connected via ontrack event`);
      } else if (state === 'connected' && hasActiveMedia) {
        isConnected = true;
        connectionMethod = 'receivers';
        console.log(`✅ CONNECTION: ${participantId} connected via active receivers`);
      } else if (mediaStats && (mediaStats.packetsReceived > 0 || mediaStats.framesDecoded > 0)) {
        isConnected = true;
        connectionMethod = 'stats';
        console.log(`✅ CONNECTION: ${participantId} connected via media flow stats`);
      }

      // Determine if connection is failed (relaxed criteria)
      const connectingTime = now - (currentData.connectingStartTime || now);
      const isDefinitelyFailed = state === 'failed' || iceState === 'failed';
      
      // Determine if recovery is needed (but don't force failure)
      const needsRecovery = (state === 'connecting' || iceState === 'checking') && 
                           !isConnected && 
                           connectingTime > 45000 && // Increased from 30s to 45s
                           (currentData.recoveryAttempts || 0) < finalConfig.maxRecoveryAttempts;

      if (isConnected) {
        hasActiveConnections = true;
        console.log(`🎯 CONNECTED: ${participantId} via ${connectionMethod}`);
      } else if (isDefinitelyFailed) {
        hasFailedConnections = true;
        console.warn(`❌ FAILED: ${participantId} - State: ${state}, ICE: ${iceState}`);
      } else if (state === 'connecting' || iceState === 'checking') {
        hasConnectingConnections = true;
        console.log(`🔄 CONNECTING: ${participantId} for ${(connectingTime/1000).toFixed(1)}s`);
      }

      // Trigger controlled recovery if needed
      if (needsRecovery) {
        console.log(`🔧 RECOVERY: Initiating controlled recovery for ${participantId} (attempt ${(currentData.recoveryAttempts || 0) + 1})`);
        await attemptConnectionRecovery(participantId, pc);
      }

      updatedConnections.set(participantId, {
        state: isConnected ? 'connected' : state,
        iceState,
        signalingState,
        lastHeartbeat: isConnected ? now : currentData.lastHeartbeat,
        reconnectAttempts: currentData.reconnectAttempts,
        connectingStartTime: currentData.connectingStartTime,
        ontrackReceived,
        lastOntrackTime: ontrackReceived ? (currentData.lastOntrackTime || now) : currentData.lastOntrackTime,
        mediaStats,
        recoveryAttempts: needsRecovery ? (currentData.recoveryAttempts || 0) + 1 : (currentData.recoveryAttempts || 0),
        lastRecoveryTime: needsRecovery ? now : currentData.lastRecoveryTime
      });
    }

    // Enhanced WebRTC state logic - simplified and stable
    let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    if (hasActiveConnections) {
      webrtcState = 'connected';
      console.log(`✅ WEBRTC: Connected - ${hasActiveConnections ? 'active connections found' : 'no active connections'}`);
    } else if (hasFailedConnections) {
      webrtcState = 'failed';
      console.log(`❌ WEBRTC: Failed - connection failures detected`);
    } else if (hasConnectingConnections || peerConnections.size > 0) {
      webrtcState = 'connecting';
      console.log(`🔄 WEBRTC: Connecting - ${peerConnections.size} peer connections in progress`);
    } else {
      webrtcState = 'disconnected';
      console.log(`📱 WEBRTC: Disconnected - no peer connections`);
    }

    setMetrics(prev => {
      const newConnectionState = {
        ...prev.connectionState,
        webrtc: webrtcState
      };
      
      // Simplified overall state logic
      const overall = newConnectionState.websocket === 'connected' && newConnectionState.webrtc === 'connected'
                     ? 'connected'
                     : newConnectionState.websocket === 'failed' || newConnectionState.webrtc === 'failed'
                     ? 'failed'
                     : 'connecting';

      newConnectionState.overall = overall;

      return {
        ...prev,
        connectionState: newConnectionState,
        participantConnections: updatedConnections,
        isStable: overall === 'connected' && (now - lastStabilityCheckRef.current) > 10000
      };
    });

    lastStabilityCheckRef.current = now;
  }, [peerConnections, metrics.participantConnections, finalConfig.enableStatsMonitoring, finalConfig.maxRecoveryAttempts, checkMediaFlow]);

  // Controlled recovery sequence with ICE restart
  const attemptConnectionRecovery = useCallback(async (participantId: string, pc: RTCPeerConnection) => {
    const currentAttempts = recoveryAttemptsRef.current.get(participantId) || 0;
    
    if (currentAttempts >= finalConfig.maxRecoveryAttempts) {
      console.warn(`⚠️ RECOVERY: Max recovery attempts reached for ${participantId}`);
      return false;
    }

    recoveryAttemptsRef.current.set(participantId, currentAttempts + 1);
    
    try {
      console.log(`🔧 RECOVERY: Attempt ${currentAttempts + 1} for ${participantId} - triggering ICE restart`);
      
      if (pc.signalingState === 'stable') {
        // Try ICE restart for stable connections
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        console.log(`🧊 ICE RESTART: Triggered for ${participantId}`);
        return true;
      } else {
        console.log(`⚠️ RECOVERY: Cannot restart ICE - signaling state is ${pc.signalingState}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ RECOVERY: Failed for ${participantId}:`, error);
      return false;
    }
  }, [finalConfig.maxRecoveryAttempts]);

  // Register ontrack events for immediate connection detection
  const registerOntrackEvents = useCallback(() => {
    peerConnections.forEach((pc, participantId) => {
      if (!ontrackEventRef.current.has(participantId)) {
        pc.addEventListener('track', (event) => {
          console.log(`🎥 ONTRACK: Event received for ${participantId}`, {
            track: event.track.kind,
            trackId: event.track.id.substring(0, 8),
            streamCount: event.streams.length,
            timestamp: Date.now()
          });
          
          ontrackEventRef.current.set(participantId, true);
          
          // Immediately update connection state on ontrack
          setMetrics(prev => {
            const updatedConnections = new Map(prev.participantConnections);
            const current = updatedConnections.get(participantId);
            if (current) {
              updatedConnections.set(participantId, {
                ...current,
                ontrackReceived: true,
                lastOntrackTime: Date.now(),
                state: 'connected' as RTCPeerConnectionState
              });
            }
            
            return {
              ...prev,
              participantConnections: updatedConnections,
              connectionState: {
                ...prev.connectionState,
                webrtc: 'connected',
                overall: prev.connectionState.websocket === 'connected' ? 'connected' : 'connecting'
              }
            };
          });
        });
      }
    });
  }, [peerConnections]);

  // Manual connection recovery with controlled sequence
  const handleConnectionRecovery = useCallback(async (participantId?: string) => {
    console.log(`🔄 RECOVERY: Manual recovery initiated${participantId ? ` for ${participantId}` : ''}`);
    
    const currentAttempts = recoveryAttemptsRef.current.get(participantId || 'websocket') || 0;
    
    if (currentAttempts >= finalConfig.maxRecoveryAttempts) {
      console.error(`❌ RECOVERY: Max recovery attempts reached for ${participantId || 'websocket'}`);
      toast.error('❌ Connection recovery failed - please reset connection');
      return false;
    }

    recoveryAttemptsRef.current.set(participantId || 'websocket', currentAttempts + 1);
    
    try {
      if (participantId) {
        // Peer connection recovery with ICE restart
        const pc = peerConnections.get(participantId);
        if (pc) {
          console.log(`🔧 RECOVERY: ICE restart sequence for ${participantId}`);
          const success = await attemptConnectionRecovery(participantId, pc);
          if (success) {
            console.log(`✅ RECOVERY: ICE restart successful for ${participantId}`);
            recoveryAttemptsRef.current.delete(participantId);
            toast.success(`🔧 Connection recovered for ${participantId}`);
            return true;
          }
        }
      } else {
        // WebSocket recovery
        console.log('🔄 RECOVERY: WebSocket reconnection...');
        await unifiedWebSocketService.forceReconnect();
        
        setMetrics(prev => ({
          ...prev,
          totalReconnections: prev.totalReconnections + 1
        }));
        
        recoveryAttemptsRef.current.delete('websocket');
        console.log(`✅ RECOVERY: WebSocket recovery successful`);
        toast.success('📡 WebSocket connection recovered');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ RECOVERY: Failed for ${participantId || 'websocket'}:`, error);
      toast.error(`❌ Recovery failed - attempt ${currentAttempts + 1}/${finalConfig.maxRecoveryAttempts}`);
      return false;
    }
  }, [finalConfig.maxRecoveryAttempts, peerConnections, attemptConnectionRecovery]);

  // Start enhanced monitoring systems
  const startStabilityMonitoring = useCallback(() => {
    console.log(`🔍 STABILITY: Starting enhanced monitoring with ontrack detection`);
    
    // WebSocket ping monitoring (relaxed)
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(async () => {
      await performWebSocketPing();
    }, finalConfig.websocketPingInterval);

    // Connection health monitoring with ontrack registration
    if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
    healthCheckIntervalRef.current = setInterval(() => {
      registerOntrackEvents();
      assessPeerConnectionHealth();
    }, finalConfig.connectionHealthCheckInterval);

    // Optional stats monitoring
    if (finalConfig.enableStatsMonitoring) {
      if (statsCheckIntervalRef.current) clearInterval(statsCheckIntervalRef.current);
      statsCheckIntervalRef.current = setInterval(() => {
        peerConnections.forEach(async (pc, participantId) => {
          if (pc.connectionState === 'connected') {
            await checkMediaFlow(pc, participantId);
          }
        });
      }, finalConfig.statsCheckInterval);
    }

    console.log(`✅ STABILITY: Enhanced monitoring started - ontrack: enabled, stats: ${finalConfig.enableStatsMonitoring}`);
  }, [finalConfig, performWebSocketPing, assessPeerConnectionHealth, registerOntrackEvents, checkMediaFlow, peerConnections]);

  // Stop all monitoring
  const stopStabilityMonitoring = useCallback(() => {
    console.log('🛑 STABILITY: Stopping enhanced monitoring');
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (statsCheckIntervalRef.current) {
      clearInterval(statsCheckIntervalRef.current);
      statsCheckIntervalRef.current = null;
    }
    
    // Clear ontrack tracking
    ontrackEventRef.current.clear();
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
    recoveryAttemptsRef.current.clear();
    
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