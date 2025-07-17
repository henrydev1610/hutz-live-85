import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state
let webrtcManager: UnifiedWebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
    }
    
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize host WebRTC:', error);
    return { webrtc: webrtcManager };
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 Initializing participant WebRTC for session:', sessionId);
    
    // FASE 1: Verificar se já existe uma conexão válida antes de criar nova
    if (webrtcManager) {
      const existingState = webrtcManager.getConnectionState();
      console.log('🔍 EXISTING CONNECTION STATE:', existingState);
      
      // Se já existe e está conectado/conectando, reutilizar
      if (existingState.overall === 'connected' || existingState.overall === 'connecting') {
        console.log('✅ REUSING existing WebRTC manager (already connected)');
        return { webrtc: webrtcManager };
      }
      
      // Só limpar se realmente necessário
      console.log('🧹 Cleaning up failed WebRTC manager');
      webrtcManager.cleanup();
    }
    
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    throw error;
  }
};

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

export const getWebRTCManager = () => {
  return webrtcManager;
};

export const cleanupWebRTC = () => {
  if (webrtcManager) {
    webrtcManager.cleanup();
    webrtcManager = null;
  }
};

export const getWebRTCPeerConnections = (): Map<string, RTCPeerConnection> => {
  if (webrtcManager) {
    return webrtcManager.getPeerConnections();
  }
  return new Map();
};

export const getWebRTCConnectionState = () => {
  if (webrtcManager) {
    return webrtcManager.getConnectionState();
  }
  return {
    websocket: 'disconnected' as const,
    webrtc: 'disconnected' as const,
    overall: 'disconnected' as const
  };
};

// CRITICAL: Test WebRTC connection
export const testWebRTCConnection = async (): Promise<boolean> => {
  if (webrtcManager) {
    return await webrtcManager.testConnection();
  }
  return false;
};

// CRITICAL: Force participant reconnection
export const forceParticipantReconnection = async (participantId: string): Promise<void> => {
  if (webrtcManager) {
    await webrtcManager.forceParticipantConnection(participantId);
  }
};

// CRITICAL: Force reconnection for all participants
export const forceReconnectAll = async (): Promise<void> => {
  if (webrtcManager) {
    await webrtcManager.forceReconnectAll();
  }
};
