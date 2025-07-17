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
