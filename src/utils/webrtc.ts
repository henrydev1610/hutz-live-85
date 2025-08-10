
import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state with unique relay management
let webrtcManager: UnifiedWebRTCManager | null = null;
let currentSessionId: string | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 FASE 1: Initializing host WebRTC for session:', sessionId);
    
    // Verificar se já existe manager para mesma sessão
    if (webrtcManager && currentSessionId === sessionId) {
      console.log('♻️ FASE 1: Reusing existing WebRTC manager for same session:', sessionId);
      return { webrtc: webrtcManager };
    }
    
    // Cleanup mais agressivo para evitar relay duplicado
    if (webrtcManager) {
      console.log('🧹 FASE 1: Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
      webrtcManager = null;
      currentSessionId = null;
      
      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Criar nova instância com identificação única
    console.log('🔧 FASE 1: Creating new UnifiedWebRTCManager instance');
    webrtcManager = new UnifiedWebRTCManager();
    currentSessionId = sessionId;
    
    console.log('🎯 FASE 1: Initializing as host...');
    await webrtcManager.initializeAsHost(sessionId);
    
    // CRITICAL FIX: Verificar se manager foi armazenado corretamente
    if (!webrtcManager) {
      console.error('❌ FASE 1: webrtcManager is null after initialization!');
      throw new Error('WebRTC manager initialization failed');
    }
    
    console.log('✅ FASE 1: Host WebRTC initialized successfully, manager stored:', !!webrtcManager);
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('❌ FASE 1: Failed to initialize host WebRTC:', error);
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
  console.log('🔍 FASE 1: getWebRTCManager called, manager exists:', !!webrtcManager, 'sessionId:', currentSessionId);
  
  // FASE 1: Verificação de saúde do manager
  if (webrtcManager) {
    try {
      const state = webrtcManager.getConnectionState();
      console.log('🔍 FASE 1: Manager health check - state:', state);
      
      // Verificar se o manager está em estado consistente
      if (!state) {
        console.warn('⚠️ FASE 1: Manager exists but has no state - possibly corrupted');
        return null;
      }
      
      return webrtcManager;
    } catch (error) {
      console.error('❌ FASE 1: Manager health check failed:', error);
      return null;
    }
  }
  
  console.warn('⚠️ FASE 1: No WebRTC manager available');
  return null;
};

export const cleanupWebRTC = () => {
  if (webrtcManager) {
    console.log('🧹 Cleaning up WebRTC manager and resetting session');
    webrtcManager.cleanup();
    webrtcManager = null;
    currentSessionId = null;
  }
};
export const getWebRTCManagerInstance = (): UnifiedWebRTCManager => {
  if (!webrtcManager) {
    console.error('❌ FASE 2: Nenhum WebRTC manager inicializado. Use initHostWebRTC ou initParticipantWebRTC primeiro.');
    throw new Error('WebRTC manager not initialized - call init function first');
  }
  return webrtcManager;
}