
import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state
let webrtcManager: UnifiedWebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    // CRITICAL FIX: Don't initialize for temporary sessions
    if (sessionId.includes('early-host-') || sessionId.includes('temp-host-')) {
      console.log('⏭️ WEBRTC: Skipping initialization for temporary session:', sessionId);
      return { webrtc: null }; // Return null for temporary sessions
    }
    
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
    
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
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

/**
 * Updates the local stream in all WebRTC connections
 * CRITICAL: Call this when camera stream changes (e.g., rear camera acquired)
 */
export const updateWebRTCStream = async (newStream: MediaStream): Promise<void> => {
  if (webrtcManager) {
    console.log('🔄 WEBRTC: Updating stream via global manager');
    await webrtcManager.updateLocalStream(newStream);
  } else {
    console.warn('⚠️ WEBRTC: No manager available to update stream');
  }
};

/**
 * Updates only video track using replaceTrack (faster for camera switching)
 */
export const updateWebRTCVideoTrack = async (newStream: MediaStream): Promise<void> => {
  if (webrtcManager) {
    console.log('🎥 WEBRTC: Updating video track via global manager');
    await webrtcManager.updateVideoTrack(newStream);
  } else {
    console.warn('⚠️ WEBRTC: No manager available to update video track');
  }
};

export const cleanupWebRTC = () => {
  if (webrtcManager) {
    webrtcManager.cleanup();
    webrtcManager = null;
  }
};
