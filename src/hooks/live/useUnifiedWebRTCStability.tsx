/**
 * FASE 3: UNIFIED WebRTC Stability Hook
 * Replaces conflicting desktop/mobile stability systems with a single, clean implementation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getWebRTCManager } from '@/utils/webrtc';

interface UnifiedConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
  participantCount: number;
  activeStreams: number;
  lastUpdate: number;
}

interface UnifiedStabilityConfig {
  healthCheckInterval: number;
  connectionTimeout: number;
  enableAutoReset: boolean;
}

const DEFAULT_CONFIG: UnifiedStabilityConfig = {
  healthCheckInterval: 2000,    // Check every 2 seconds
  connectionTimeout: 8000,      // 8 seconds max for connection
  enableAutoReset: true         // Auto-reset stuck connections
};

export const useUnifiedWebRTCStability = (config: Partial<UnifiedStabilityConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [connectionState, setConnectionState] = useState<UnifiedConnectionState>({
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected',
    participantCount: 0,
    activeStreams: 0,
    lastUpdate: Date.now()
  });

  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthCheckRef = useRef<number>(0);

  // Unified health assessment
  const assessConnectionHealth = useCallback(async () => {
    const now = Date.now();
    
    // Prevent rapid successive checks
    if (now - lastHealthCheckRef.current < 1000) {
      return;
    }
    lastHealthCheckRef.current = now;

    try {
      // Check WebSocket
      const wsConnected = unifiedWebSocketService?.isConnected() ?? false;
      let wsState: 'disconnected' | 'connecting' | 'connected' | 'failed' = wsConnected ? 'connected' : 'disconnected';

      // Check WebRTC
      let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';
      let participantCount = 0;
      let activeStreams = 0;

      try {
        const manager = getWebRTCManager();
        if (manager) {
          // Estimate participant and stream counts based on available information
          const globalStreams = (window as any).__mlStreams__ || {};
          const globalConnections = (window as any).__activePeerConnections__ || {};
          
          participantCount = Object.keys(globalConnections).length;
          activeStreams = Object.keys(globalStreams).length;
          
          // Determine WebRTC state based on connections and streams
          if (activeStreams > 0) {
            webrtcState = 'connected';
          } else if (participantCount > 0) {
            webrtcState = 'connecting';
          } else {
            webrtcState = 'disconnected';
          }
        }
      } catch (error) {
        console.log('⚠️ UNIFIED STABILITY: WebRTC manager not available yet');
        webrtcState = 'disconnected';
      }

      // Determine overall state
      let overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
      
      if (wsState === 'connected' && webrtcState === 'connected') {
        overall = 'connected';
      } else if (wsState === 'connected' && (webrtcState === 'connecting' || participantCount > 0)) {
        overall = 'connecting';
      } else {
        overall = 'disconnected';
      }

      const newState: UnifiedConnectionState = {
        websocket: wsState,
        webrtc: webrtcState,
        overall,
        participantCount,
        activeStreams,
        lastUpdate: now
      };

      setConnectionState(newState);

      // Log state changes
      console.log(`🔍 UNIFIED STABILITY: WS:${wsState} | WebRTC:${webrtcState} | Overall:${overall} | P:${participantCount} | S:${activeStreams}`);

    } catch (error) {
      console.error('❌ UNIFIED STABILITY: Health check failed:', error);
      
      setConnectionState(prev => ({
        ...prev,
        overall: 'failed',
        lastUpdate: now
      }));
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    console.log(`🔍 UNIFIED STABILITY: Starting monitoring (${finalConfig.healthCheckInterval}ms)`);
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    // Initial check
    assessConnectionHealth();
    
    // Set interval
    healthCheckIntervalRef.current = setInterval(
      assessConnectionHealth, 
      finalConfig.healthCheckInterval
    );
  }, [assessConnectionHealth, finalConfig.healthCheckInterval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('🔍 UNIFIED STABILITY: Stopping monitoring');
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Force reset connections
  const forceReset = useCallback(() => {
    console.log('🔄 UNIFIED STABILITY: Force reset requested');
    
    try {
      const manager = getWebRTCManager();
      if (manager) {
        if (typeof manager.resetWebRTC === 'function') {
          manager.resetWebRTC();
        } else if (typeof manager.cleanup === 'function') {
          manager.cleanup();
        }
        console.log('✅ UNIFIED STABILITY: WebRTC reset completed');
      }
    } catch (error) {
      console.error('❌ UNIFIED STABILITY: Reset failed:', error);
    }

    // Reset state
    setConnectionState({
      websocket: unifiedWebSocketService?.isConnected() ? 'connected' : 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected',
      participantCount: 0,
      activeStreams: 0,
      lastUpdate: Date.now()
    });
  }, []);

  // Auto-start monitoring
  useEffect(() => {
    startMonitoring();
    
    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  return {
    connectionState,
    startMonitoring,
    stopMonitoring,
    forceReset,
    config: finalConfig,
    
    // Convenience getters
    isWebSocketConnected: connectionState.websocket === 'connected',
    isWebRTCConnected: connectionState.webrtc === 'connected',
    isFullyConnected: connectionState.overall === 'connected',
    hasParticipants: connectionState.participantCount > 0,
    hasStreams: connectionState.activeStreams > 0
  };
};