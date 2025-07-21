
import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state
let webrtcManager: UnifiedWebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    // Cleanup mais agressivo para evitar relay duplicado
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
      webrtcManager = null;
      
      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Criar nova instância completamente limpa
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize host WebRTC:', error);
    // Em caso de erro, garantir limpeza
    if (webrtcManager) {
      webrtcManager.cleanup();
      webrtcManager = null;
    }
    throw error;
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 Initializing participant WebRTC for session:', sessionId);
    
    // Cleanup mais agressivo para evitar relay duplicado
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
      webrtcManager = null;
      
      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Criar nova instância completamente limpa
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    // Em caso de erro, garantir limpeza
    if (webrtcManager) {
      webrtcManager.cleanup();
      webrtcManager = null;
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
    webrtcManager.cleanup();
    webrtcManager = null;
  }
};
