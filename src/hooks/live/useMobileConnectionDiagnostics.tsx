import { useState, useEffect, useCallback } from 'react';
import { useWebRTCStabilityIntegration } from './useWebRTCStabilityIntegration';
import { getWebRTCConnectionState } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface MobileConnectionDiagnostics {
  isMobile: boolean;
  connectionStatus: {
    websocket: 'connected' | 'disconnected' | 'connecting' | 'failed';
    webrtc: 'connected' | 'disconnected' | 'connecting' | 'failed';
    overall: 'connected' | 'disconnected' | 'connecting' | 'failed';
  };
  metrics: {
    attemptCount: number;
    successCount: number;
    lastSuccessTime: number;
    currentAttempt: number;
    isRetrying: boolean;
    errorHistory: string[];
  };
  diagnostics: {
    networkType: string;
    userAgent: string;
    supportedTransports: string[];
    currentUrl: string;
    timeConnected: number;
  };
  actions: {
    forceReconnect: () => Promise<void>;
    clearErrors: () => void;
    runDiagnostics: () => Promise<DiagnosticResult[]>;
  };
}

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export const useMobileConnectionDiagnostics = (): MobileConnectionDiagnostics => {
  const [metrics, setMetrics] = useState({
    attemptCount: 0,
    successCount: 0,
    lastSuccessTime: 0,
    currentAttempt: 0,
    isRetrying: false,
    errorHistory: [] as string[]
  });

  const [connectionStartTime, setConnectionStartTime] = useState(0);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);

  const {
    connectionStatus,
    stabilityMetrics,
    mobileStability,
    forceReconnect: stabilityForceReconnect
  } = useWebRTCStabilityIntegration();

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Monitor connection state changes
  useEffect(() => {
    if (connectionStatus.overall === 'connected' && connectionStartTime === 0) {
      setConnectionStartTime(Date.now());
      setMetrics(prev => ({
        ...prev,
        successCount: prev.successCount + 1,
        lastSuccessTime: Date.now(),
        isRetrying: false
      }));
    } else if (connectionStatus.overall === 'connecting') {
      setMetrics(prev => ({
        ...prev,
        currentAttempt: prev.currentAttempt + 1,
        isRetrying: true
      }));
    } else if (connectionStatus.overall === 'failed') {
      setMetrics(prev => ({
        ...prev,
        attemptCount: prev.attemptCount + 1,
        isRetrying: false,
        errorHistory: [...prev.errorHistory.slice(-4), `Failed at ${new Date().toLocaleTimeString()}`]
      }));
    }
  }, [connectionStatus.overall, connectionStartTime]);

  const runDiagnostics = useCallback(async (): Promise<DiagnosticResult[]> => {
    console.log('🔍 DIAGNOSTICS: Running mobile connection diagnostics...');
    
    const results: DiagnosticResult[] = [];

    // Test 1: Mobile Detection
    results.push({
      test: 'Mobile Detection',
      status: isMobile ? 'pass' : 'warning',
      message: isMobile ? 'Device correctly detected as mobile' : 'Device detected as desktop',
      details: { userAgent: navigator.userAgent }
    });

    // Test 2: HTTPS Check
    const isHTTPS = window.location.protocol === 'https:';
    results.push({
      test: 'HTTPS Security',
      status: isHTTPS ? 'pass' : 'fail',
      message: isHTTPS ? 'Secure HTTPS connection' : 'Insecure HTTP connection - WebRTC may fail',
      details: { protocol: window.location.protocol }
    });

    // Test 3: WebSocket Connection
    const wsConnected = unifiedWebSocketService.isConnected();
    results.push({
      test: 'WebSocket Connection',
      status: wsConnected ? 'pass' : 'fail',
      message: wsConnected ? 'WebSocket connected successfully' : 'WebSocket connection failed',
      details: { 
        status: unifiedWebSocketService.getConnectionStatus(),
        metrics: unifiedWebSocketService.getConnectionMetrics()
      }
    });

    // Test 4: WebRTC Support
    const hasWebRTC = 'RTCPeerConnection' in window;
    results.push({
      test: 'WebRTC Support',
      status: hasWebRTC ? 'pass' : 'fail',
      message: hasWebRTC ? 'WebRTC is supported' : 'WebRTC is not supported',
      details: { RTCPeerConnection: hasWebRTC }
    });

    // Test 5: Media Devices
    const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    results.push({
      test: 'Media Devices API',
      status: hasMediaDevices ? 'pass' : 'fail',
      message: hasMediaDevices ? 'Media devices API available' : 'Media devices API not available',
      details: { mediaDevices: hasMediaDevices }
    });

    // Test 6: Network Connection
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      results.push({
        test: 'Network Type',
        status: connection.effectiveType === '4g' ? 'pass' : 'warning',
        message: `Network: ${connection.effectiveType || 'unknown'} (${connection.downlink || 'unknown'} Mbps)`,
        details: {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        }
      });
    }

    setDiagnosticResults(results);
    console.log('🔍 DIAGNOSTICS: Results:', results);
    
    return results;
  }, [isMobile]);

  const forceReconnect = useCallback(async () => {
    console.log('🔄 FORCE RECONNECT: Starting aggressive mobile reconnection...');
    
    setMetrics(prev => ({
      ...prev,
      isRetrying: true,
      currentAttempt: 0
    }));

    try {
      // Use both stability integration and direct WebSocket service
      await Promise.all([
        stabilityForceReconnect(),
        unifiedWebSocketService.forceReconnect()
      ]);
      
      console.log('🔄 FORCE RECONNECT: Completed successfully');
    } catch (error) {
      console.error('🔄 FORCE RECONNECT: Failed:', error);
      setMetrics(prev => ({
        ...prev,
        errorHistory: [...prev.errorHistory.slice(-4), `Force reconnect failed: ${error.message}`]
      }));
    }
  }, [stabilityForceReconnect]);

  const clearErrors = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      errorHistory: [],
      attemptCount: 0,
      currentAttempt: 0
    }));
    setDiagnosticResults([]);
  }, []);

  return {
    isMobile,
    connectionStatus,
    metrics,
    diagnostics: {
      networkType: (navigator as any).connection?.effectiveType || 'unknown',
      userAgent: navigator.userAgent,
      supportedTransports: ['websocket', 'polling'],
      currentUrl: window.location.href,
      timeConnected: connectionStartTime > 0 ? Date.now() - connectionStartTime : 0
    },
    actions: {
      forceReconnect,
      clearErrors,
      runDiagnostics
    }
  };
};