import { UnifiedWebRTCManager } from './webrtc/UnifiedWebRTCManager';

// Global WebRTC state - FASE 1: Enhanced singleton management
let webrtcManager: UnifiedWebRTCManager | null = null;
const instanceMap = new Map<string, UnifiedWebRTCManager>();

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 FASE 1: Initializing HOST WebRTC with UNIFIED singleton management');
    
    // FASE 1: Check existing instance for this session
    const existingInstance = instanceMap.get(sessionId);
    if (existingInstance) {
      const state = existingInstance.getConnectionState();
      if (state.overall === 'connected' || state.overall === 'connecting') {
        console.log('♻️ FASE 1: Reusing ACTIVE WebRTC instance for session:', sessionId);
        webrtcManager = existingInstance;
        return { webrtc: webrtcManager };
      }
    }
    
    // FASE 1: Clean up any existing failed connections
    if (webrtcManager && webrtcManager.roomId !== sessionId) {
      console.log('🧹 FASE 1: Cleaning up WebRTC manager for different session');
      try {
        await webrtcManager.cleanup();
        instanceMap.delete(webrtcManager.roomId || 'unknown');
      } catch (error) {
        console.log('⚠️ FASE 1: Error during cleanup:', error);
      }
      webrtcManager = null;
    }
    
    // FASE 1: Create new UNIFIED manager instance
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);
    
    // FASE 1: Store in instance map for reuse
    instanceMap.set(sessionId, webrtcManager);
    
    console.log('✅ FASE 1: HOST WebRTC UNIFIED manager initialized successfully');
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('❌ FASE 1: Failed to initialize host WebRTC:', error);
    webrtcManager = null;
    throw error;
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 FASE 1: Initializing PARTICIPANT WebRTC with UNIFIED singleton management');
    
    // FASE 1: Check existing instance for this session - MUST use same instance as HOST
    const existingInstance = instanceMap.get(sessionId);
    if (existingInstance) {
      const state = existingInstance.getConnectionState();
      if (state.overall === 'connected' || state.overall === 'connecting') {
        console.log('♻️ FASE 1: Reusing SAME WebRTC instance as HOST for participant:', participantId);
        webrtcManager = existingInstance;
        
        // FASE 2: Register stream if provided AFTER ensuring singleton
        if (stream && participantId) {
          console.log('🎥 FASE 2: Registering participant stream with UNIFIED manager');
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for stability
          webrtcManager.setOutgoingStream(stream);
          console.log('📡 FASE 2: Stream registered with UNIFIED instance');
        }
        
        return { webrtc: webrtcManager };
      }
    }
    
    // FASE 1: Create new UNIFIED manager (should be rare if HOST initialized first)
    console.log('⚠️ FASE 1: Creating new WebRTC instance for participant (HOST may not be ready)');
    webrtcManager = new UnifiedWebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
    
    // FASE 1: Store in instance map for HOST reuse
    instanceMap.set(sessionId, webrtcManager);
    
    // FASE 2: Register stream AFTER initialization with correct timing
    if (stream && participantId) {
      console.log('🎥 FASE 2: Registering participant stream with new UNIFIED manager');
      await new Promise(resolve => setTimeout(resolve, 300)); // FASE 2: Wait for WebRTC stabilization
      webrtcManager.setOutgoingStream(stream);
      console.log('📡 FASE 2: Stream registered with new UNIFIED instance');
    }
    
    console.log('✅ FASE 1: PARTICIPANT WebRTC UNIFIED manager initialized successfully');
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('❌ FASE 1: Failed to initialize participant WebRTC:', error);
    throw error;
  }
};

export const setStreamCallback = (callback: (participantId: string, stream: MediaStream) => void) => {
  // FASE 2: Ensure callback is set on the UNIFIED singleton instance
  if (webrtcManager) {
    console.log('📞 FASE 2: Setting stream callback on UNIFIED instance');
    webrtcManager.setOnStreamCallback(callback);
  } else {
    console.warn('⚠️ FASE 2: No WebRTC manager available for stream callback');
  }
};

export const setParticipantJoinCallback = (callback: (participantId: string) => void) => {
  if (webrtcManager) {
    webrtcManager.setOnParticipantJoinCallback(callback);
  }
};

export const getWebRTCManager = (): UnifiedWebRTCManager | null => {
  // FASE 1: Return the UNIFIED singleton instance
  console.log('🔍 FASE 1: Getting UNIFIED WebRTC manager:', !!webrtcManager);
  return webrtcManager;
};

export const cleanupWebRTC = () => {
  console.log('🧹 FASE 1: Cleaning up UNIFIED WebRTC manager');
  if (webrtcManager) {
    const sessionId = webrtcManager.roomId || 'unknown';
    webrtcManager.cleanup();
    instanceMap.delete(sessionId);
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

// FASE 5: Enhanced fallback and recovery functions
export const detectAndCorrectInstanceDesync = async (): Promise<boolean> => {
  try {
    console.log('🔍 FASE 5: Detecting UNIFIED instance desynchronization');
    
    if (!webrtcManager) {
      console.log('⚠️ FASE 5: No UNIFIED WebRTC manager available');
      return false;
    }
    
    // FASE 5: Check if streams are being received but not processed
    const connections = getWebRTCPeerConnections();
    let hasIncomingStreams = false;
    let streamCount = 0;
    
    connections.forEach((connection, peerId) => {
      connection.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.readyState === 'live') {
          hasIncomingStreams = true;
          streamCount++;
          console.log('📊 FASE 5: Found incoming stream from:', peerId, {
            kind: receiver.track.kind,
            enabled: receiver.track.enabled,
            readyState: receiver.track.readyState
          });
        }
      });
    });
    
    if (hasIncomingStreams && streamCount > 0) {
      console.log(`🔄 FASE 5: DESYNC DETECTED - ${streamCount} streams but callback may not be working`);
      
      // FASE 5: Force re-trigger stream callbacks for all active streams
      connections.forEach((connection, peerId) => {
        const remoteStream = new MediaStream();
        connection.getReceivers().forEach(receiver => {
          if (receiver.track && receiver.track.readyState === 'live') {
            remoteStream.addTrack(receiver.track);
          }
        });
        
        if (remoteStream.getTracks().length > 0) {
          console.log('🔄 FASE 5: Manually triggering stream callback for:', peerId);
          // Re-trigger the callback using the manager's triggerStreamCallback method
          if (webrtcManager) {
            webrtcManager.triggerStreamCallback(peerId, remoteStream);
          }
        }
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ FASE 5: Error detecting UNIFIED desync:', error);
    return false;
  }
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
