import { useEffect, useState } from 'react';
import { useEnhancedWebRTCStability } from './useEnhancedWebRTCStability';
import { getWebRTCPeerConnections, getWebRTCConnectionState } from '@/utils/webrtc';

export const useWebRTCStabilityIntegration = () => {
  const [peerConnections, setPeerConnections] = useState(new Map<string, RTCPeerConnection>());
  const [connectionState, setConnectionState] = useState(getWebRTCConnectionState());

  // Monitor peer connections
  useEffect(() => {
    const interval = setInterval(() => {
      const currentConnections = getWebRTCPeerConnections();
      const currentState = getWebRTCConnectionState();
      
      setPeerConnections(currentConnections);
      setConnectionState(currentState);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const {
    metrics,
    forceFullRecovery,
    handleConnectionRecovery,
    isMobile
  } = useEnhancedWebRTCStability(peerConnections, {
    aggressiveModeForMobile: true,
    websocketPingInterval: 2000, // 2s ping
    connectionHealthCheckInterval: 1500, // 1.5s health check
    maxReconnectAttempts: 15 // More attempts
  });

  return {
    connectionStatus: connectionState,
    stabilityMetrics: metrics,
    participantCount: peerConnections.size,
    mobileStability: {
      isConnected: connectionState.overall === 'connected',
      isStable: metrics.isStable,
      connectionAttempts: metrics.totalReconnections,
      lastSuccessTime: metrics.lastWebSocketPing,
      error: connectionState.overall === 'failed' ? 'Connection failed' : null,
      isMobile
    },
    forceReconnect: forceFullRecovery,
    handleRecovery: handleConnectionRecovery
  };
};