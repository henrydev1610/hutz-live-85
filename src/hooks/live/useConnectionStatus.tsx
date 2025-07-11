import { useState, useEffect } from 'react';
import { getWebRTCManager } from '@/utils/webrtc';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export const useConnectionStatus = () => {
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  useEffect(() => {
    const checkConnectionStatus = () => {
      // Check WebRTC status
      const webrtcManager = getWebRTCManager();
      const webrtcStatus = webrtcManager?.getConnectionState() || { 
        websocket: 'disconnected', 
        webrtc: 'disconnected' 
      };
      
      setWebrtcConnected(webrtcStatus.webrtc === 'connected');
      
      // Check WebSocket status
      setWebsocketConnected(unifiedWebSocketService.isConnected());
      
      console.log('🔍 CONNECTION STATUS:', {
        webrtc: webrtcStatus.webrtc,
        websocket: unifiedWebSocketService.isConnected() ? 'connected' : 'disconnected'
      });
    };

    // Check immediately
    checkConnectionStatus();

    // Check every 2 seconds
    const interval = setInterval(checkConnectionStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return {
    webrtcConnected,
    websocketConnected
  };
};