import { useCallback, useEffect, useRef, useState } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

interface DesktopConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface ParticipantMetrics {
  state: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  connectingStartTime: number;
  hasStream: boolean;
  lastUpdate: number;
}

interface DesktopStabilityConfig {
  maxConnectingTime: number;     // 10 seconds max in connecting state
  healthCheckInterval: number;   // Check every 5 seconds
  loopDetectionTime: number;     // 8 seconds for loop detection
  enableImmedateReset: boolean;  // Enable immediate reset on loops
}

const DESKTOP_CONFIG: DesktopStabilityConfig = {
  maxConnectingTime: 10000,      // 10 seconds max connecting
  healthCheckInterval: 5000,     // Check every 5 seconds 
  loopDetectionTime: 8000,       // 8 seconds loop detection
  enableImmedateReset: true      // Enable immediate reset
};

export const useDesktopWebRTCStability = (
  peerConnections: Map<string, RTCPeerConnection>
) => {
  const [connectionState, setConnectionState] = useState<DesktopConnectionState>({
    websocket: 'disconnected',
    webrtc: 'disconnected', 
    overall: 'disconnected'
  });

  const [participantMetrics, setParticipantMetrics] = useState<Map<string, ParticipantMetrics>>(new Map());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ontrackEventsRef = useRef<Map<string, boolean>>(new Map());

  // Simple WebSocket health check
  const checkWebSocketHealth = useCallback(async () => {
    try {
      const isConnected = unifiedWebSocketService.isConnected();
      const newState = isConnected ? 'connected' : 'disconnected';
      
      setConnectionState(prev => ({
        ...prev,
        websocket: newState
      }));
      
      return isConnected;
    } catch (error) {
      console.error('❌ DESKTOP STABILITY: WebSocket check failed:', error);
      setConnectionState(prev => ({
        ...prev,
        websocket: 'failed'
      }));
      return false;
    }
  }, []);

  // Desktop-optimized connection assessment with immediate loop breaking
  const assessDesktopConnections = useCallback(() => {
    const now = Date.now();
    const updatedMetrics = new Map<string, ParticipantMetrics>();
    
    let hasConnected = false;
    let hasConnecting = false;
    let hasFailed = false;
    let hasLoops = false;

    console.log(`🖥️ DESKTOP STABILITY: Checking ${peerConnections.size} connections`);

    for (const [participantId, pc] of peerConnections.entries()) {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      const hasOntrack = ontrackEventsRef.current.get(participantId) || false;
      
      const currentMetrics = participantMetrics.get(participantId) || {
        state: 'new' as RTCPeerConnectionState,
        iceState: 'new' as RTCIceConnectionState,
        connectingStartTime: now,
        hasStream: false,
        lastUpdate: now
      };

      const connectingTime = now - currentMetrics.connectingStartTime;
      
      // Simple connection detection: ontrack event OR connected state
      const isConnected = hasOntrack || state === 'connected';
      
      // Desktop loop detection: connecting for more than 8 seconds
      const isInLoop = (state === 'connecting' || iceState === 'checking') && 
                       connectingTime > DESKTOP_CONFIG.loopDetectionTime;
      
      // Definitive failure detection
      const hasFailedState = state === 'failed' || iceState === 'failed';

      console.log(`🖥️ ${participantId}: State=${state}, ICE=${iceState}, Time=${(connectingTime/1000).toFixed(1)}s, Connected=${isConnected}, Loop=${isInLoop}`);

      if (isConnected) {
        hasConnected = true;
        console.log(`✅ DESKTOP: ${participantId} connected (${hasOntrack ? 'ontrack' : 'state'})`);
      } else if (hasFailedState) {
        hasFailed = true;
        console.log(`❌ DESKTOP: ${participantId} failed`);
      } else if (state === 'connecting' || iceState === 'checking') {
        hasConnecting = true;
        
        // IMMEDIATE LOOP BREAKING for desktop
        if (isInLoop) {
          hasLoops = true;
          console.log(`🚫 DESKTOP LOOP: ${participantId} stuck connecting for ${(connectingTime/1000).toFixed(1)}s - BREAKING`);
          
          if (DESKTOP_CONFIG.enableImmedateReset) {
            // Close the stuck connection immediately
            try {
              pc.close();
              peerConnections.delete(participantId);
              console.log(`🔥 DESKTOP LOOP: Forcefully closed ${participantId}`);
              
              // Dispatch immediate reset event
              window.dispatchEvent(new CustomEvent('webrtc-loop-detected', {
                detail: { participantId, connectingTime, action: 'force_close' }
              }));
              
              continue; // Skip updating metrics for closed connection
            } catch (error) {
              console.error(`❌ DESKTOP LOOP: Failed to close ${participantId}:`, error);
            }
          }
        }
      }

      updatedMetrics.set(participantId, {
        state,
        iceState,
        connectingStartTime: currentMetrics.connectingStartTime,
        hasStream: isConnected || currentMetrics.hasStream,
        lastUpdate: now
      });
    }

    // Simple WebRTC state logic for desktop
    let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    
    if (hasLoops) {
      webrtcState = 'failed';
      console.log(`🚫 DESKTOP: Connection loops detected - marking as failed`);
    } else if (hasConnected) {
      webrtcState = 'connected';
      console.log(`✅ DESKTOP: Active connections found`);
    } else if (hasFailed) {
      webrtcState = 'failed';
      console.log(`❌ DESKTOP: Failed connections detected`);
    } else if (hasConnecting || peerConnections.size > 0) {
      webrtcState = 'connecting';
      console.log(`🔄 DESKTOP: Connections in progress`);
    } else {
      webrtcState = 'disconnected';
      console.log(`📱 DESKTOP: No connections`);
    }

    // Update state
    setParticipantMetrics(updatedMetrics);
    setConnectionState(prev => {
      const websocketConnected = prev.websocket === 'connected';
      const overall = websocketConnected && webrtcState === 'connected' 
        ? 'connected'
        : webrtcState === 'failed' || prev.websocket === 'failed'
        ? 'failed'
        : 'connecting';

      return {
        ...prev,
        webrtc: webrtcState,
        overall
      };
    });

    // Auto-toast for loop detection
    if (hasLoops && DESKTOP_CONFIG.enableImmedateReset) {
      toast.warning('🚫 Connection loop detected - resetting automatically');
    }

  }, [peerConnections, participantMetrics]);

  // Register ontrack events for immediate connection detection
  const registerOntrackEvents = useCallback(() => {
    peerConnections.forEach((pc, participantId) => {
      if (!ontrackEventsRef.current.has(participantId)) {
        pc.addEventListener('track', (event) => {
          console.log(`🎥 DESKTOP ONTRACK: ${participantId} - ${event.track.kind}`);
          ontrackEventsRef.current.set(participantId, true);
          
          // Immediate state update on ontrack
          setConnectionState(prev => ({
            ...prev,
            webrtc: 'connected',
            overall: prev.websocket === 'connected' ? 'connected' : 'connecting'
          }));
        });
      }
    });
  }, [peerConnections]);

  // Start desktop stability monitoring
  const startDesktopMonitoring = useCallback(() => {
    console.log(`🖥️ DESKTOP STABILITY: Starting monitoring (${DESKTOP_CONFIG.healthCheckInterval}ms interval)`);
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    const monitor = () => {
      checkWebSocketHealth();
      assessDesktopConnections();
      registerOntrackEvents();
    };

    // Initial check
    monitor();
    
    // Set interval
    healthCheckIntervalRef.current = setInterval(monitor, DESKTOP_CONFIG.healthCheckInterval);
  }, [checkWebSocketHealth, assessDesktopConnections, registerOntrackEvents]);

  // Stop monitoring
  const stopDesktopMonitoring = useCallback(() => {
    console.log(`🖥️ DESKTOP STABILITY: Stopping monitoring`);
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Force immediate connection reset
  const forceDesktopReset = useCallback(() => {
    console.log(`🔥 DESKTOP STABILITY: Force reset requested`);
    
    // Close all peer connections
    peerConnections.forEach((pc, participantId) => {
      console.log(`🔥 DESKTOP RESET: Closing ${participantId}`);
      try {
        pc.close();
      } catch (error) {
        console.error(`❌ DESKTOP RESET: Error closing ${participantId}:`, error);
      }
    });
    
    // Clear all state
    peerConnections.clear();
    ontrackEventsRef.current.clear();
    setParticipantMetrics(new Map());
    
    setConnectionState({
      websocket: unifiedWebSocketService.isConnected() ? 'connected' : 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    });
    
    // Dispatch reset completion event
    window.dispatchEvent(new CustomEvent('desktop-webrtc-reset-complete'));
    toast.success('🔄 Desktop WebRTC reset complete');
    
    console.log(`✅ DESKTOP STABILITY: Reset complete`);
  }, [peerConnections]);

  // Auto-start monitoring when component mounts
  useEffect(() => {
    startDesktopMonitoring();
    
    return () => {
      stopDesktopMonitoring();
    };
  }, [startDesktopMonitoring, stopDesktopMonitoring]);

  return {
    connectionState,
    participantMetrics,
    startDesktopMonitoring,
    stopDesktopMonitoring,
    forceDesktopReset,
    config: DESKTOP_CONFIG
  };
};