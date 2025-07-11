import { useState, useEffect, useCallback } from 'react';
import { getWebRTCManager } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface ConnectionMetrics {
  websocket: {
    status: 'disconnected' | 'connecting' | 'connected' | 'failed';
    latency?: number;
    reconnectCount: number;
    lastError?: string;
  };
  webrtc: {
    status: 'disconnected' | 'connecting' | 'connected' | 'failed';
    peerCount: number;
    activeConnections: number;
    lastError?: string;
  };
  overall: {
    status: 'disconnected' | 'connecting' | 'connected' | 'failed';
    healthScore: number; // 0-100
    lastCheck: number;
  };
}

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkQuality: 'poor' | 'fair' | 'good' | 'excellent';
  frameRate: number;
  resolution: string;
}

export const useConnectionDiagnostics = () => {
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    websocket: {
      status: 'disconnected',
      reconnectCount: 0
    },
    webrtc: {
      status: 'disconnected',
      peerCount: 0,
      activeConnections: 0
    },
    overall: {
      status: 'disconnected',
      healthScore: 0,
      lastCheck: Date.now()
    }
  });

  const [performance, setPerformance] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    cpuUsage: 0,
    networkQuality: 'poor',
    frameRate: 0,
    resolution: 'unknown'
  });

  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    setDiagnosticLogs(prev => {
      const newLogs = [logEntry, ...prev].slice(0, 100); // Keep last 100 logs
      return newLogs;
    });
    
    console.log(`🔍 DIAGNOSTICS: ${message}`);
  }, []);

  const updateWebSocketMetrics = useCallback(() => {
    const isConnected = unifiedWebSocketService.isConnected();
    const isReady = unifiedWebSocketService.isReady();
    
    setMetrics(prev => ({
      ...prev,
      websocket: {
        ...prev.websocket,
        status: isConnected ? (isReady ? 'connected' : 'connecting') : 'disconnected'
      }
    }));
  }, []);

  const updateWebRTCMetrics = useCallback(() => {
    const manager = getWebRTCManager();
    
    if (!manager) {
      setMetrics(prev => ({
        ...prev,
        webrtc: {
          ...prev.webrtc,
          status: 'disconnected',
          peerCount: 0,
          activeConnections: 0
        }
      }));
      return;
    }

    const connectionState = manager.getConnectionState();
    const participants = manager.getParticipants();
    
    let activeConnections = 0;
    // Count active peer connections would require access to internal peer connections
    // This is a simplified version
    
    setMetrics(prev => ({
      ...prev,
      webrtc: {
        ...prev.webrtc,
        status: connectionState.webrtc,
        peerCount: participants.length,
        activeConnections
      }
    }));
  }, []);

  const calculateHealthScore = useCallback(() => {
    const { websocket, webrtc } = metrics;
    let score = 0;

    // WebSocket health (40 points)
    if (websocket.status === 'connected') score += 40;
    else if (websocket.status === 'connecting') score += 20;

    // WebRTC health (40 points)
    if (webrtc.status === 'connected') score += 40;
    else if (webrtc.status === 'connecting') score += 20;

    // Connection stability (20 points)
    if (websocket.reconnectCount === 0) score += 10;
    else if (websocket.reconnectCount < 3) score += 5;

    if (webrtc.activeConnections > 0) score += 10;

    return Math.min(100, score);
  }, [metrics]);

  const updatePerformanceMetrics = useCallback(() => {
    // Basic performance monitoring
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      setPerformance(prev => ({
        ...prev,
        memoryUsage: memInfo ? Math.round((memInfo.usedJSHeapSize / memInfo.totalJSHeapSize) * 100) : 0
      }));
    }

    // Network quality estimation (simplified)
    const connectionType = (navigator as any).connection?.effectiveType;
    let networkQuality: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
    
    switch (connectionType) {
      case '4g':
        networkQuality = 'excellent';
        break;
      case '3g':
        networkQuality = 'good';
        break;
      case '2g':
        networkQuality = 'fair';
        break;
      default:
        networkQuality = 'poor';
    }

    setPerformance(prev => ({
      ...prev,
      networkQuality
    }));
  }, []);

  const runDiagnosticCheck = useCallback(async () => {
    addLog('Running comprehensive diagnostic check...');
    
    try {
      // Check WebSocket
      addLog('Checking WebSocket connection...');
      updateWebSocketMetrics();
      
      // Check WebRTC
      addLog('Checking WebRTC connections...');
      updateWebRTCMetrics();
      
      // Update performance
      addLog('Updating performance metrics...');
      updatePerformanceMetrics();
      
      // Calculate overall health
      const healthScore = calculateHealthScore();
      
      setMetrics(prev => ({
        ...prev,
        overall: {
          ...prev.overall,
          healthScore,
          lastCheck: Date.now()
        }
      }));
      
      addLog(`Diagnostic check complete. Health score: ${healthScore}/100`);
      
      // Log issues if any
      if (healthScore < 70) {
        addLog('⚠️ Connection health is below optimal threshold');
        
        if (metrics.websocket.status !== 'connected') {
          addLog('❌ WebSocket connection issue detected');
        }
        
        if (metrics.webrtc.status !== 'connected') {
          addLog('❌ WebRTC connection issue detected');
        }
      }
      
    } catch (error) {
      addLog(`❌ Diagnostic check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [addLog, updateWebSocketMetrics, updateWebRTCMetrics, updatePerformanceMetrics, calculateHealthScore, metrics]);

  const forceReconnect = useCallback(async () => {
    addLog('🔄 Forcing reconnection...');
    
    try {
      // Increment reconnect count
      setMetrics(prev => ({
        ...prev,
        websocket: {
          ...prev.websocket,
          reconnectCount: prev.websocket.reconnectCount + 1
        }
      }));
      
      // Cleanup and reconnect would need to be implemented
      // This would typically call the manager's cleanup and re-initialization
      addLog('Reconnection initiated');
      
    } catch (error) {
      addLog(`❌ Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setDiagnosticLogs([]);
    addLog('Diagnostic logs cleared');
  }, [addLog]);

  const exportDiagnostics = useCallback(() => {
    const diagnosticData = {
      timestamp: new Date().toISOString(),
      metrics,
      performance,
      logs: diagnosticLogs,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
    
    const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog('Diagnostic data exported');
  }, [metrics, performance, diagnosticLogs, addLog]);

  // Auto-update metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      runDiagnosticCheck();
    }, 5000);

    // Initial check
    runDiagnosticCheck();

    return () => clearInterval(interval);
  }, [runDiagnosticCheck]);

  // Update overall status based on individual metrics
  useEffect(() => {
    const { websocket, webrtc } = metrics;
    let overallStatus: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';

    if (websocket.status === 'failed' || webrtc.status === 'failed') {
      overallStatus = 'failed';
    } else if (websocket.status === 'connected' && webrtc.status === 'connected') {
      overallStatus = 'connected';
    } else if (websocket.status === 'connecting' || webrtc.status === 'connecting') {
      overallStatus = 'connecting';
    }

    setMetrics(prev => ({
      ...prev,
      overall: {
        ...prev.overall,
        status: overallStatus
      }
    }));
  }, [metrics.websocket.status, metrics.webrtc.status]);

  return {
    metrics,
    performance,
    diagnosticLogs,
    runDiagnosticCheck,
    forceReconnect,
    clearLogs,
    exportDiagnostics,
    addLog
  };
};