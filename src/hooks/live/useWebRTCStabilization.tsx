import { useEffect, useRef } from 'react';
import { getWebRTCManager, getWebRTCConnectionState } from '@/utils/webrtc';

interface UseWebRTCStabilizationProps {
  sessionId: string | null;
  isHost: boolean;
  onConnectionStateChange?: (state: any) => void;
}

export const useWebRTCStabilization = ({
  sessionId,
  isHost,
  onConnectionStateChange
}: UseWebRTCStabilizationProps) => {
  const stabilizationInterval = useRef<NodeJS.Timeout | null>(null);
  const lastConnectionState = useRef<string>('disconnected');

  useEffect(() => {
    if (!sessionId) return;

    console.log('🔧 STABILIZATION: Starting WebRTC stabilization monitoring...');

    // Enhanced monitoring every 3 seconds
    stabilizationInterval.current = setInterval(() => {
      const webrtcManager = getWebRTCManager();
      const connectionState = getWebRTCConnectionState();
      
      if (!webrtcManager) return;

      const currentState = connectionState.overall;
      
      // Log state changes
      if (currentState !== lastConnectionState.current) {
        console.log(`🔄 STABILIZATION: Connection state changed from ${lastConnectionState.current} to ${currentState}`);
        lastConnectionState.current = currentState;
        onConnectionStateChange?.(connectionState);
      }

      // CRITICAL: Auto-recovery for failed connections
      if (currentState === 'failed' || 
          (connectionState.websocket === 'connected' && connectionState.webrtc === 'failed')) {
        
        console.warn('⚠️ STABILIZATION: Failed state detected, initiating recovery...');
        
        if (!isHost) {
          // For participants: try to reconnect WebRTC
          webrtcManager.forceReconnectAll().catch(error => {
            console.error('❌ STABILIZATION: Auto-recovery failed:', error);
          });
        }
      }

      // CRITICAL: Detect stuck "connecting" state (timeout after 15 seconds)
      if (currentState === 'connecting') {
        const stuckTimeout = setTimeout(() => {
          const newState = getWebRTCConnectionState();
          if (newState.overall === 'connecting') {
            console.warn('⚠️ STABILIZATION: Connection stuck in connecting state, forcing reset...');
            webrtcManager.forceReconnectAll().catch(error => {
              console.error('❌ STABILIZATION: Stuck connection recovery failed:', error);
            });
          }
        }, 15000);

        // Clear timeout if state changes
        setTimeout(() => {
          if (getWebRTCConnectionState().overall !== 'connecting') {
            clearTimeout(stuckTimeout);
          }
        }, 1000);
      }

    }, 3000);

    return () => {
      if (stabilizationInterval.current) {
        clearInterval(stabilizationInterval.current);
        stabilizationInterval.current = null;
      }
    };
  }, [sessionId, isHost, onConnectionStateChange]);

  // Manual recovery function
  const triggerRecovery = async () => {
    console.log('🔧 STABILIZATION: Manual recovery triggered');
    const webrtcManager = getWebRTCManager();
    if (webrtcManager) {
      try {
        await webrtcManager.forceReconnectAll();
        console.log('✅ STABILIZATION: Manual recovery completed');
      } catch (error) {
        console.error('❌ STABILIZATION: Manual recovery failed:', error);
      }
    }
  };

  // Connection test function
  const testConnection = async (): Promise<boolean> => {
    const webrtcManager = getWebRTCManager();
    if (webrtcManager) {
      return await webrtcManager.testConnection();
    }
    return false;
  };

  return {
    triggerRecovery,
    testConnection,
    connectionState: lastConnectionState.current
  };
};