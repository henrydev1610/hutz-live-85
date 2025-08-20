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

// PLANO: Detectar ambiente corporativo para timeouts mais longos
const isDesktop = !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);
const isCorporateNetwork = window.location.protocol === 'https:' && 
  (window.location.hostname.includes('.corp') || window.location.hostname.includes('.local'));

const DESKTOP_CONFIG: DesktopStabilityConfig = {
  maxConnectingTime: isDesktop ? (isCorporateNetwork ? 15000 : 10000) : 5000,  // PLANO: 10-15s desktop, 5s mobile
  healthCheckInterval: isDesktop ? 2000 : 1000,     // PLANO: 2s desktop, 1s mobile
  loopDetectionTime: isDesktop ? (isCorporateNetwork ? 12000 : 8000) : 4000,   // PLANO: 8-12s desktop, 4s mobile
  enableImmedateReset: !isCorporateNetwork      // PLANO: Não reset imediato em rede corporativa
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

  // PLANO: Assessor de conexão simplificado e assertivo
  const assessDesktopConnections = useCallback(() => {
    const now = Date.now();
    const updatedMetrics = new Map<string, ParticipantMetrics>();
    
    let hasConnected = false;
    let hasConnecting = false;
    let hasFailed = false;
    let hasLoops = false;

    const configType = isCorporateNetwork ? 'CORP' : isDesktop ? 'DESKTOP' : 'MOBILE';
    console.log(`🖥️ ${configType} [${(now / 1000).toFixed(0)}s]: Verificando ${peerConnections.size} conexões (timeout: ${DESKTOP_CONFIG.loopDetectionTime/1000}s)`);

    for (const [participantId, pc] of peerConnections.entries()) {
      const hasOntrack = ontrackEventsRef.current.get(participantId) || false;
      const pcState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      
      const currentMetrics = participantMetrics.get(participantId) || {
        state: 'new' as RTCPeerConnectionState,
        iceState: 'new' as RTCIceConnectionState,
        connectingStartTime: now,
        hasStream: false,
        lastUpdate: now
      };

      const connectingTime = now - currentMetrics.connectingStartTime;
      
      // PLANO: Múltiplas fontes de verdade para robustez
      const isConnected = hasOntrack || pcState === 'connected';
      const isActivelyConnecting = pcState === 'connecting' || iceState === 'checking' || iceState === 'new';
      
      // PLANO: Timeout adaptativo baseado no ambiente
      const isStuck = connectingTime > DESKTOP_CONFIG.loopDetectionTime && !isConnected && isActivelyConnecting;
      
      // PLANO: Detectar falhas definitivas mais cedo
      const hasDefinitiveFailed = pcState === 'failed' || iceState === 'failed' || iceState === 'disconnected';
      
      // PLANO: Log detalhado para diferentes cenários
      if (isConnected) {
        hasConnected = true;
        console.log(`✅ ${participantId}: CONECTADO (${(connectingTime/1000).toFixed(1)}s) [${pcState}/${iceState}]`);
      } else if (hasDefinitiveFailed) {
        hasFailed = true;
        console.log(`💥 ${participantId}: FALHOU (${(connectingTime/1000).toFixed(1)}s) [${pcState}/${iceState}] - LIMPANDO`);
        
        // PLANO: Cleanup imediato para falhas definitivas
        try {
          pc.close();
          peerConnections.delete(participantId);
          ontrackEventsRef.current.delete(participantId);
          
          window.dispatchEvent(new CustomEvent('webrtc-definitive-failure', {
            detail: { participantId, pcState, iceState, connectingTimeMs: connectingTime }
          }));
          
          continue; // Skip metrics for failed connection
        } catch (error) {
          console.error(`❌ ${participantId}: Erro no cleanup de falha:`, error);
        }
      } else if (isStuck) {
        hasLoops = true;
        const timeoutS = Math.round(DESKTOP_CONFIG.loopDetectionTime / 1000);
        console.log(`🔥 ${participantId}: TIMEOUT ${timeoutS}s (${configType}) - ${DESKTOP_CONFIG.enableImmedateReset ? 'FECHANDO' : 'MANTENDO'}`);
        
        // PLANO: Reset condicional baseado na configuração
        if (DESKTOP_CONFIG.enableImmedateReset) {
          try {
            pc.close();
            peerConnections.delete(participantId);
            ontrackEventsRef.current.delete(participantId);
            
            window.dispatchEvent(new CustomEvent('webrtc-timeout', {
              detail: { participantId, timeoutSeconds: timeoutS, networkType: configType }
            }));
            
            continue; // Skip metrics for closed connection
          } catch (error) {
            console.error(`❌ ${participantId}: Erro no fechamento por timeout:`, error);
          }
        }
      } else {
        hasConnecting = true;
        const progress = ((connectingTime / DESKTOP_CONFIG.loopDetectionTime) * 100).toFixed(0);
        console.log(`🔄 ${participantId}: CONECTANDO (${(connectingTime/1000).toFixed(1)}s/${(DESKTOP_CONFIG.loopDetectionTime/1000).toFixed(0)}s - ${progress}%) [${pcState}/${iceState}]`);
      }

      updatedMetrics.set(participantId, {
        state: 'connecting' as RTCPeerConnectionState,
        iceState: 'checking' as RTCIceConnectionState,
        connectingStartTime: currentMetrics.connectingStartTime,
        hasStream: isConnected || currentMetrics.hasStream,
        lastUpdate: now
      });
    }

    // PLANO: Lógica de estado simplificada
    let webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    
    if (hasConnected) {
      webrtcState = 'connected';
    } else if (hasLoops) {
      webrtcState = 'disconnected'; // Reset imediato após loop
    } else if (hasConnecting) {
      webrtcState = 'connecting';
    } else {
      webrtcState = 'disconnected';
    }

    // Update state
    setParticipantMetrics(updatedMetrics);
    setConnectionState(prev => {
      const websocketConnected = prev.websocket === 'connected';
      const overall = websocketConnected && webrtcState === 'connected' 
        ? 'connected'
        : prev.websocket === 'failed'
        ? 'failed'
        : 'connecting';

      return {
        ...prev,
        webrtc: webrtcState,
        overall
      };
    });

    // PLANO: Toasts informativos baseados no ambiente
    if (hasLoops && DESKTOP_CONFIG.enableImmedateReset) {
      const timeoutS = Math.round(DESKTOP_CONFIG.loopDetectionTime / 1000);
      toast.warning(`🔥 ${configType}: Timeout ${timeoutS}s - Reset automático`);
    } else if (hasFailed) {
      toast.error(`💥 ${configType}: Falha de conexão detectada`);
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