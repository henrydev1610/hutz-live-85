import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state
let webrtcManager: UnifiedWebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 FASE 3: Initializing host WebRTC for session:', sessionId);
    
    // FASE 3: Sincronizar instâncias - verificar se existe e está ativa
    if (webrtcManager) {
      const existingState = webrtcManager.getConnectionState();
      console.log('🔍 FASE 3: EXISTING HOST CONNECTION STATE:', existingState);
      
      // Se já existe e está conectado/conectando, reutilizar
      if (existingState.overall === 'connected' || existingState.overall === 'connecting') {
        console.log('✅ FASE 3: REUSING existing host WebRTC manager (already connected)');
        return { webrtc: webrtcManager };
      }
      
      // Só limpar se realmente necessário
      console.log('🧹 FASE 3: Cleaning up failed host WebRTC manager');
      webrtcManager.cleanup();
    }
    
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);
    
    console.log('✅ FASE 3: Host WebRTC manager initialized and stored in singleton');
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('❌ FASE 3: Failed to initialize host WebRTC:', error);
    return { webrtc: webrtcManager };
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 UNIFIED: Connecting participant to EXISTING WebRTC session:', sessionId);
    
    // CRITICAL: SEMPRE usar a instância existente do HOST se disponível
    if (webrtcManager && webrtcManager.roomId === sessionId) {
      console.log('✅ UNIFIED: REUSING existing HOST WebRTC manager for participant connection');
      
      // CRITICAL: Registrar stream na instância HOST existente
      if (stream) {
        console.log('🎬 UNIFIED: Registering participant stream with HOST WebRTC manager');
        await new Promise(resolve => setTimeout(resolve, 300)); // Estabilização
        webrtcManager.setOutgoingStream(stream);
        console.log('✅ UNIFIED: Participant stream registered with HOST manager');
      }
      
      // CRITICAL: Stream já registrado, apenas retornar instância HOST existente
      console.log('✅ UNIFIED: Using existing HOST WebRTC for participant stream forwarding');
      
      return { webrtc: webrtcManager };
    }
    
    // Se não há HOST, criar nova instância (modo standalone)
    console.log('🔄 UNIFIED: No HOST found, creating standalone participant WebRTC');
    if (webrtcManager) {
      webrtcManager.cleanup();
    }
    
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
    
    console.log('✅ UNIFIED: Standalone participant WebRTC manager created');
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('❌ UNIFIED: Failed to initialize participant WebRTC:', error);
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

// FASE 5: Fallback and Recovery - Detect and auto-correct instance desync
export const detectAndCorrectInstanceDesync = async (): Promise<boolean> => {
  if (!webrtcManager) {
    console.log('⚠️ FASE 5: No WebRTC manager instance available');
    return false;
  }
  
  const state = webrtcManager.getConnectionState();
  console.log('🔍 FASE 5: Checking instance sync:', state);
  
  // Se WebSocket conectado mas WebRTC falhou, há dessincronia
  if (state.websocket === 'connected' && state.webrtc === 'failed') {
    console.log('🚨 FASE 5: Instance desync detected - WebSocket OK but WebRTC failed');
    
    try {
      // Força reconexão automática
      await webrtcManager.forceReconnectAll();
      console.log('✅ FASE 5: Auto-correction applied');
      return true;
    } catch (error) {
      console.error('❌ FASE 5: Auto-correction failed:', error);
      return false;
    }
  }
  
  return true;
};

// FASE 5: Recovery system - Auto-correct when stream doesn't reach host
export const recoverStreamConnection = async (participantId: string): Promise<void> => {
  if (!webrtcManager) {
    console.log('⚠️ FASE 5: No WebRTC manager for stream recovery');
    return;
  }
  
  console.log(`🔄 FASE 5: Attempting stream recovery for ${participantId}`);
  
  try {
    // Force participant reconnection specifically
    await webrtcManager.forceParticipantConnection(participantId);
    console.log(`✅ FASE 5: Stream recovery initiated for ${participantId}`);
  } catch (error) {
    console.error(`❌ FASE 5: Stream recovery failed for ${participantId}:`, error);
  }
};
