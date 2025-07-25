
import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state with unique relay management
let webrtcManager: UnifiedWebRTCManager | null = null;
let currentSessionId: string | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    // Verificar se já existe manager para mesma sessão
    if (webrtcManager && currentSessionId === sessionId) {
      console.log('♻️ Reusing existing WebRTC manager for same session:', sessionId);
      return { webrtc: webrtcManager };
    }
    
    // Cleanup mais agressivo para evitar relay duplicado
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
      webrtcManager = null;
      currentSessionId = null;
      
      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Criar nova instância com identificação única
    webrtcManager = new UnifiedWebRTCManager();
    currentSessionId = sessionId;
    await webrtcManager.initializeAsHost(sessionId);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize host WebRTC:', error);
    // Em caso de erro, garantir limpeza
    if (webrtcManager) {
      webrtcManager.cleanup();
      webrtcManager = null;
      currentSessionId = null;
    }
    throw error;
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 Initializing participant WebRTC for session:', sessionId);
    
    const finalParticipantId = participantId || `participant-${Date.now()}`;
    
    // Verificar se já existe manager para mesma sessão e participante
    if (webrtcManager && currentSessionId === sessionId) {
      console.log('♻️ Reusing existing WebRTC manager for same session:', sessionId, 'participant:', finalParticipantId);
      return { webrtc: webrtcManager };
    }
    
    // Cleanup mais agressivo para evitar relay duplicado
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
      webrtcManager = null;
      currentSessionId = null;
      
      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Criar nova instância com identificação única
    webrtcManager = new UnifiedWebRTCManager();
    currentSessionId = sessionId;
    await webrtcManager.initializeAsParticipant(sessionId, finalParticipantId, stream);
    
    // CRITICAL FIX: Ensure stream is properly set after initialization
    if (stream) {
      console.log('📹 CRITICAL FIX: Setting stream in WebRTC manager after initialization');
      webrtcManager.setLocalStream(stream);
    }
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    // Em caso de erro, garantir limpeza
    if (webrtcManager) {
      webrtcManager.cleanup();
      webrtcManager = null;
      currentSessionId = null;
    }
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
    console.log('🧹 Cleaning up WebRTC manager and resetting session');
    webrtcManager.cleanup();
    webrtcManager = null;
    currentSessionId = null;
  }
};
