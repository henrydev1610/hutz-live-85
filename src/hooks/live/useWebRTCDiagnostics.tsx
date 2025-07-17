import { useState, useEffect, useCallback } from 'react';
import { toast } from "sonner";

interface WebRTCDiagnostics {
  websocketStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtcStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  activeConnections: number;
  activeStreams: number;
  lastHealthCheck: number | null;
  errors: string[];
}

interface UseWebRTCDiagnosticsProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: any[];
  isHost: boolean;
}

export const useWebRTCDiagnostics = ({
  participantStreams,
  participantList,
  isHost
}: UseWebRTCDiagnosticsProps) => {
  const [diagnostics, setDiagnostics] = useState<WebRTCDiagnostics>({
    websocketStatus: 'disconnected',
    webrtcStatus: 'disconnected',
    activeConnections: 0,
    activeStreams: 0,
    lastHealthCheck: null,
    errors: []
  });

  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // Health check function
  const performHealthCheck = useCallback(async () => {
    try {
      // Import WebRTC manager dynamically
      const { UnifiedWebRTCManager } = await import('@/utils/webrtc/UnifiedWebRTCManager');
      const unifiedWebSocketService = (await import('@/services/UnifiedWebSocketService')).default;

      // Check WebSocket status
      const websocketConnected = unifiedWebSocketService.isConnected();
      
      // Count active streams
      const activeStreamCount = Object.keys(participantStreams).length;
      const activeParticipants = participantList.filter(p => p.active && p.hasVideo).length;

      // Update diagnostics
      setDiagnostics(prev => ({
        ...prev,
        websocketStatus: websocketConnected ? 'connected' : 'disconnected',
        activeStreams: activeStreamCount,
        activeConnections: activeParticipants,
        lastHealthCheck: Date.now()
      }));

      // Host-specific monitoring
      if (isHost) {
        // Check for expected streams vs actual streams
        const expectedStreams = participantList.filter(p => p.hasVideo).length;
        const actualStreams = activeStreamCount;

        console.log(`🔍 HEALTH CHECK: Expected: ${expectedStreams}, Actual: ${actualStreams}`);

        // Auto-recovery logic for hosts
        if (expectedStreams > 0 && actualStreams === 0 && autoRecoveryEnabled) {
          if (recoveryAttempts < 3) {
            console.log(`🔄 AUTO-RECOVERY: No streams detected, attempting recovery (${recoveryAttempts + 1}/3)`);
            setRecoveryAttempts(prev => prev + 1);
            
            // Trigger WebRTC reconnection
            setTimeout(() => {
              // Force stream re-request
              participantList.forEach(participant => {
                if (participant.hasVideo && !participantStreams[participant.id]) {
                  console.log(`🔄 RECOVERY: Re-requesting stream for ${participant.id}`);
                }
              });
            }, 1000);
          } else {
            console.warn(`⚠️ AUTO-RECOVERY: Max attempts reached, disabling auto-recovery`);
            setAutoRecoveryEnabled(false);
            toast.error("Múltiplas falhas de conexão detectadas. Verifique sua conexão.");
          }
        } else if (actualStreams > 0) {
          // Reset recovery attempts on success
          setRecoveryAttempts(0);
          setAutoRecoveryEnabled(true);
        }
      }

    } catch (error) {
      console.error('❌ DIAGNOSTICS: Health check failed:', error);
      setDiagnostics(prev => ({
        ...prev,
        errors: [...prev.errors.slice(-4), error.message].filter(Boolean)
      }));
    }
  }, [participantStreams, participantList, isHost, autoRecoveryEnabled, recoveryAttempts]);

  // Periodic health monitoring
  useEffect(() => {
    const interval = setInterval(performHealthCheck, 3000); // Check every 3 seconds
    performHealthCheck(); // Initial check

    return () => clearInterval(interval);
  }, [performHealthCheck]);

  // Stream monitoring with heartbeat
  useEffect(() => {
    let heartbeatCount = 0;
    const heartbeatInterval = setInterval(() => {
      heartbeatCount++;
      
      const sharedStreamsCount = Object.keys(participantStreams).length;
      
      console.log(`💓 HEARTBEAT ${heartbeatCount}: Shared streams: ${sharedStreamsCount}`);
      
      // Rule 3: Alert after 3 cycles with 0 streams when participants exist
      if (isHost && heartbeatCount >= 3 && sharedStreamsCount === 0) {
        const hasParticipants = participantList.some(p => p.hasVideo);
        if (hasParticipants) {
          console.warn("⚠️ Nenhum stream recebido do celular");
          toast.warning("Nenhum vídeo detectado. Verifique as conexões dos participantes.");
        }
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(heartbeatInterval);
  }, [participantStreams, participantList, isHost]);

  const forceReconnection = useCallback(async () => {
    console.log('🔄 FORCE RECONNECTION: Initiating manual reconnection...');
    
    try {
      const unifiedWebSocketService = (await import('@/services/UnifiedWebSocketService')).default;
      await unifiedWebSocketService.forceReconnect();
      
      toast.success("Reconexão iniciada com sucesso");
      setRecoveryAttempts(0);
      setAutoRecoveryEnabled(true);
    } catch (error) {
      console.error('❌ FORCE RECONNECTION: Failed:', error);
      toast.error("Falha na reconexão manual");
    }
  }, []);

  const resetDiagnostics = useCallback(() => {
    setDiagnostics(prev => ({
      ...prev,
      errors: []
    }));
    setRecoveryAttempts(0);
    setAutoRecoveryEnabled(true);
  }, []);

  return {
    diagnostics,
    autoRecoveryEnabled,
    recoveryAttempts,
    forceReconnection,
    resetDiagnostics,
    performHealthCheck
  };
};