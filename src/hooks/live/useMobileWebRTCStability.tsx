import { useCallback, useEffect, useRef, useState } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface MobileConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface MobileStabilityConfig {
  healthCheckInterval: number;
  connectionTimeout: number;
}

const MOBILE_CONFIG: MobileStabilityConfig = {
  healthCheckInterval: 3000,    // Mobile: Check every 3 seconds
  connectionTimeout: 10000      // Mobile: 10 seconds timeout
};

export const useMobileWebRTCStability = () => {
  const [connectionState, setConnectionState] = useState<MobileConnectionState>({
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  });

  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkMobileHealth = useCallback(async () => {
    try {
      const isConnected = unifiedWebSocketService.isConnected();
      
      setConnectionState(prev => ({
        ...prev,
        websocket: isConnected ? 'connected' : 'disconnected',
        overall: isConnected ? 'connected' : 'disconnected'
      }));
      
      console.log(`📱 MOBILE: Health check - WebSocket: ${isConnected ? 'connected' : 'disconnected'}`);
      
      return isConnected;
    } catch (error) {
      console.error('❌ MOBILE: Health check failed:', error);
      setConnectionState(prev => ({
        ...prev,
        websocket: 'failed',
        overall: 'failed'
      }));
      return false;
    }
  }, []);

  const startMobileMonitoring = useCallback(() => {
    console.log(`📱 MOBILE: Starting monitoring (${MOBILE_CONFIG.healthCheckInterval}ms)`);
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    
    // Initial check
    checkMobileHealth();
    
    // Set interval
    healthCheckIntervalRef.current = setInterval(checkMobileHealth, MOBILE_CONFIG.healthCheckInterval);
  }, [checkMobileHealth]);

  const stopMobileMonitoring = useCallback(() => {
    console.log('📱 MOBILE: Stopping monitoring');
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Auto-start monitoring for mobile
  useEffect(() => {
    startMobileMonitoring();
    
    return () => {
      stopMobileMonitoring();
    };
  }, [startMobileMonitoring, stopMobileMonitoring]);

  return {
    connectionState,
    startMobileMonitoring,
    stopMobileMonitoring,
    config: MOBILE_CONFIG
  };
};