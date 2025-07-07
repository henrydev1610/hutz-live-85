
import { WebRTCManager } from './webrtc/WebRTCManager';

// Global WebRTC state
let webrtcManager: WebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
    }
    
    webrtcManager = new WebRTCManager();
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
    
    // Detectar se é mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('📱 Using mobile WebRTC manager');
      // Usar o gerenciador mobile específico
      const { MobileWebRTCManager } = await import('./webrtc/MobileWebRTCManager');
      const mobileManager = new MobileWebRTCManager();
      await mobileManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
      return { webrtc: mobileManager };
    } else {
      console.log('🖥️ Using desktop WebRTC manager');
      // Usar o gerenciador desktop
      if (webrtcManager) {
        webrtcManager.cleanup();
      }
      
      webrtcManager = new WebRTCManager();
      await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
      return { webrtc: webrtcManager };
    }
    
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
