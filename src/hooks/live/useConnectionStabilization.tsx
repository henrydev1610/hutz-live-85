import { useEffect, useRef, useState } from 'react';
import { getWebRTCManager, getWebRTCConnectionState } from '@/utils/webrtc';
import { useToast } from '@/hooks/use-toast';

interface ConnectionStabilizationProps {
  sessionId: string | null;
  isHost: boolean;
  enabled?: boolean;
}

export const useConnectionStabilization = ({ 
  sessionId, 
  isHost, 
  enabled = true 
}: ConnectionStabilizationProps) => {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [lastSuccessfulConnection, setLastSuccessfulConnection] = useState<number>(0);
  const stabilizationInterval = useRef<NodeJS.Timeout | null>(null);
  const recoveryAttempts = useRef<number>(0);
  const lastRecoveryAttempt = useRef<number>(0);

  // CRITICAL: Enhanced connection monitoring
  useEffect(() => {
    if (!sessionId || !enabled) return;

    console.log('🔧 STABILIZATION: Starting enhanced connection monitoring...');

    stabilizationInterval.current = setInterval(() => {
      const webrtcManager = getWebRTCManager();
      const currentState = getWebRTCConnectionState();
      
      if (!webrtcManager) return;

      const overallState = currentState.overall;
      const webrtcState = currentState.webrtc;
      const websocketState = currentState.websocket;

      // Track state changes
      if (overallState !== connectionState) {
        console.log(`🔄 STABILIZATION: State changed from ${connectionState} to ${overallState}`);
        setConnectionState(overallState);

        // Success tracking
        if (overallState === 'connected') {
          setLastSuccessfulConnection(Date.now());
          recoveryAttempts.current = 0;
          
          if (!isHost) {
            toast({
              title: "Conectado",
              description: "Transmissão de vídeo ativa",
            });
          }
        }
      }

      // CRITICAL: Failure detection and recovery
      if (websocketState === 'connected' && webrtcState === 'failed') {
        const timeSinceLastRecovery = Date.now() - lastRecoveryAttempt.current;
        
        // Prevent too frequent recovery attempts (minimum 10 seconds between attempts)
        if (timeSinceLastRecovery > 10000 && recoveryAttempts.current < 5) {
          console.warn('⚠️ STABILIZATION: WebRTC failed but WebSocket connected, initiating recovery...');
          
          lastRecoveryAttempt.current = Date.now();
          recoveryAttempts.current++;
          
          webrtcManager.forceReconnectAll().catch(error => {
            console.error('❌ STABILIZATION: Recovery failed:', error);
          });
          
          if (!isHost) {
            toast({
              title: "Reconectando",
              description: `Tentativa ${recoveryAttempts.current} de reconexão...`,
            });
          }
        }
      }

      // CRITICAL: Stuck connection detection (15 seconds in connecting state)
      if (overallState === 'connecting') {
        const connectingTime = Date.now() - (lastSuccessfulConnection || Date.now() - 15000);
        
        if (connectingTime > 15000) {
          console.warn('⚠️ STABILIZATION: Connection stuck in connecting state, forcing reset...');
          
          webrtcManager.forceReconnectAll().catch(error => {
            console.error('❌ STABILIZATION: Stuck connection recovery failed:', error);
          });
          
          if (!isHost) {
            toast({
              title: "Conexão Travada",
              description: "Reiniciando conexão...",
              variant: "destructive"
            });
          }
        }
      }

      // CRITICAL: Total connection loss detection
      if (overallState === 'disconnected' && websocketState === 'disconnected') {
        const timeSinceLastSuccess = Date.now() - lastSuccessfulConnection;
        
        // If disconnected for more than 5 seconds, attempt full reconnection
        if (timeSinceLastSuccess > 5000 && recoveryAttempts.current < 3) {
          console.warn('⚠️ STABILIZATION: Total connection loss detected, attempting full reconnection...');
          
          recoveryAttempts.current++;
          
          // For participants, attempt to reconnect
          if (!isHost) {
            toast({
              title: "Conexão Perdida",
              description: "Tentando reconectar...",
              variant: "destructive"
            });
          }
        }
      }

    }, 2000); // Check every 2 seconds

    return () => {
      if (stabilizationInterval.current) {
        clearInterval(stabilizationInterval.current);
        stabilizationInterval.current = null;
      }
    };
  }, [sessionId, isHost, enabled, connectionState, toast]);

  // Manual recovery function
  const triggerManualRecovery = async () => {
    console.log('🔧 STABILIZATION: Manual recovery triggered');
    const webrtcManager = getWebRTCManager();
    
    if (webrtcManager) {
      try {
        recoveryAttempts.current++;
        lastRecoveryAttempt.current = Date.now();
        
        await webrtcManager.forceReconnectAll();
        
        toast({
          title: "Reconexão Manual",
          description: "Tentativa de reconexão iniciada",
        });
        
        console.log('✅ STABILIZATION: Manual recovery completed');
      } catch (error) {
        console.error('❌ STABILIZATION: Manual recovery failed:', error);
        
        toast({
          title: "Erro de Reconexão",
          description: "Falha na tentativa de reconexão",
          variant: "destructive"
        });
      }
    }
  };

  // Connection test function
  const testConnection = async (): Promise<boolean> => {
    const webrtcManager = getWebRTCManager();
    if (webrtcManager) {
      try {
        const result = await webrtcManager.testConnection();
        
        toast({
          title: result ? "Teste Bem-sucedido" : "Teste Falhou",
          description: result ? "Conexão está funcional" : "Problemas na conexão detectados",
          variant: result ? "default" : "destructive"
        });
        
        return result;
      } catch (error) {
        console.error('❌ STABILIZATION: Connection test failed:', error);
        return false;
      }
    }
    return false;
  };

  // Get detailed connection metrics
  const getConnectionMetrics = () => {
    const webrtcManager = getWebRTCManager();
    const currentState = getWebRTCConnectionState();
    
    return {
      connectionState: currentState,
      recoveryAttempts: recoveryAttempts.current,
      lastSuccessfulConnection,
      lastRecoveryAttempt: lastRecoveryAttempt.current,
      peerConnections: webrtcManager?.getPeerConnections().size || 0,
      connectionMetrics: webrtcManager?.getConnectionMetrics() || new Map()
    };
  };

  return {
    connectionState,
    triggerManualRecovery,
    testConnection,
    getConnectionMetrics,
    recoveryAttempts: recoveryAttempts.current,
    isHealthy: connectionState === 'connected' && Date.now() - lastSuccessfulConnection < 30000
  };
};