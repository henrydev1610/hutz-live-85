import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global singleton management
let webrtcManager: UnifiedWebRTCManager | null = null;
const instanceMap = new Map<string, UnifiedWebRTCManager>();

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 FASE 1: Initializing PARTICIPANT WebRTC with UNIFIED singleton management');

    const existingInstance = instanceMap.get(sessionId);

    if (existingInstance) {
      console.log('♻️ Reusing existing WebRTC instance for session:', sessionId);
      webrtcManager = existingInstance;

      if (stream && participantId) {
        console.log('🎥 Registering participant stream with reused instance');
        await new Promise(resolve => setTimeout(resolve, 300)); // estabilidade
        webrtcManager.setOutgoingStream(stream);
        console.log('📡 Stream registered with reused instance');
      }

      return { webrtc: webrtcManager };
    }

    // 🔒 Garantia de limpeza antes de instanciar
    if (webrtcManager) {
      console.log('🧹 Cleaning up previous WebRTC manager');
      try {
        await webrtcManager.cleanup();
        if (webrtcManager.roomId) {
          instanceMap.delete(webrtcManager.roomId);
        }
      } catch (error) {
        console.warn('⚠️ Cleanup failed:', error);
      }
    }

    // ✅ Criar nova instância segura
    console.log('✨ Creating new WebRTC manager for participant');
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);

    // ✅ Registrar na instância global
    instanceMap.set(sessionId, webrtcManager);

    if (stream && participantId) {
      console.log('🎥 Registering participant stream with new instance');
      await new Promise(resolve => setTimeout(resolve, 300)); // estabilidade
      webrtcManager.setOutgoingStream(stream);
      console.log('📡 Stream registered with new instance');
    }

    console.log('✅ PARTICIPANT WebRTC UNIFIED manager initialized successfully');
    return { webrtc: webrtcManager };

  } catch (error) {
    console.error('❌ Failed to initialize participant WebRTC:', error);
    throw error;
  }
};

// Host initialization
export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 FASE 1: Initializing HOST WebRTC with UNIFIED singleton management');

    const existingInstance = instanceMap.get(sessionId);
    if (existingInstance) {
      console.log('♻️ Reusing existing WebRTC instance for session:', sessionId);
      webrtcManager = existingInstance;
      return { webrtc: webrtcManager };
    }

    // Clean up previous instance
    if (webrtcManager) {
      console.log('🧹 Cleaning up previous WebRTC manager');
      try {
        await webrtcManager.cleanup();
        if (webrtcManager.roomId) {
          instanceMap.delete(webrtcManager.roomId);
        }
      } catch (error) {
        console.warn('⚠️ Cleanup failed:', error);
      }
    }

    // Create new instance
    console.log('✨ Creating new WebRTC manager for host');
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);

    // Register in global instance
    instanceMap.set(sessionId, webrtcManager);

    console.log('✅ HOST WebRTC UNIFIED manager initialized successfully');
    return { webrtc: webrtcManager };

  } catch (error) {
    console.error('❌ Failed to initialize host WebRTC:', error);
    throw error;
  }
};

// Manager access
export const getWebRTCManager = (): UnifiedWebRTCManager | null => {
  return webrtcManager;
};

// Connection state
export const getWebRTCConnectionState = () => {
  if (!webrtcManager) {
    return {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    };
  }
  return webrtcManager.getConnectionState();
};

// Peer connections
export const getWebRTCPeerConnections = () => {
  if (!webrtcManager) {
    return new Map<string, RTCPeerConnection>();
  }
  return webrtcManager.getPeerConnections();
};

// Stream callbacks
export const setStreamCallback = (callback: (participantId: string, stream: MediaStream) => void) => {
  if (webrtcManager) {
    webrtcManager.setOnStreamCallback(callback);
  }
};

export const setParticipantJoinCallback = (callback: (participantId: string) => void) => {
  if (webrtcManager) {
    webrtcManager.setOnParticipantJoinCallback(callback);
  }
};

// Recovery functions
export const forceParticipantReconnection = async (participantId?: string) => {
  if (webrtcManager) {
    if (participantId) {
      return await webrtcManager.forceParticipantConnection(participantId);
    } else {
      return await webrtcManager.forceReconnectAll();
    }
  }
};

export const testWebRTCConnection = async () => {
  if (webrtcManager) {
    return await webrtcManager.testConnection();
  }
  return false;
};

export const forceReconnectAll = async () => {
  if (webrtcManager) {
    return await webrtcManager.forceReconnectAll();
  }
};

// Cleanup
export const cleanupWebRTC = async () => {
  if (webrtcManager) {
    console.log('🧹 Cleaning up WebRTC manager');
    try {
      await webrtcManager.cleanup();
      if (webrtcManager.roomId) {
        instanceMap.delete(webrtcManager.roomId);
      }
      webrtcManager = null;
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error);
    }
  }
};
