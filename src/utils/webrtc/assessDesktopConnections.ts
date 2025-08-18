// Método assessDesktopConnections movido para arquivo separado para melhor modularidade

const DESKTOP_TIMEOUTS = {
  connectionTimeout: 15000,    // 15s para negociação WebRTC
  forceCleanup: 20000,         // 20s antes de força limpeza  
  healthCheckInterval: 30000,  // 30s entre checks de saúde
  retryGracePeriod: 45000      // 45s grace period antes do primeiro retry
};

export function assessDesktopConnections(
  peerConnections: Map<string, RTCPeerConnection>,
  connectionMetrics: Map<string, any>,
  connectionTimeouts: Map<string, NodeJS.Timeout>
): void {
  const now = Date.now();
  
  peerConnections.forEach((pc, participantId) => {
    const connectionAge = now - (connectionMetrics.get(participantId)?.createdAt || now);
    const state = pc.connectionState;
    const iceState = pc.iceConnectionState;
    
    console.log(`🔍 DESKTOP: Assessing ${participantId}:`, {
      state,
      iceState,
      ageSeconds: Math.round(connectionAge / 1000),
      gracePeriod: DESKTOP_TIMEOUTS.retryGracePeriod / 1000
    });
    
    // DESKTOP: Só cleanup após grace period completo
    if ((state === 'failed' || iceState === 'failed') && connectionAge > DESKTOP_TIMEOUTS.forceCleanup) {
      console.log(`🔥 DESKTOP: Cleanup failed connection ${participantId} após ${Math.round(connectionAge/1000)}s`);
      
      try {
        pc.close();
        peerConnections.delete(participantId);
        connectionMetrics.delete(participantId);
        
        // Limpar timeout individual se existir
        const timeout = connectionTimeouts.get(participantId);
        if (timeout) {
          clearTimeout(timeout);
          connectionTimeouts.delete(participantId);
        }
        
        // Event de cleanup forçado apenas para failed connections
        window.dispatchEvent(new CustomEvent('desktop-connection-cleanup', {
          detail: { participantId, reason: 'failed-connection', ageSeconds: Math.round(connectionAge/1000) }
        }));
      } catch (error) {
        console.error(`❌ DESKTOP: Erro no cleanup de ${participantId}:`, error);
      }
    }
    
    // Log de conexões em progresso durante grace period
    if (state === 'connecting' && connectionAge < DESKTOP_TIMEOUTS.retryGracePeriod) {
      console.log(`⏳ DESKTOP: ${participantId} connecting (${Math.round(connectionAge/1000)}s/${Math.round(DESKTOP_TIMEOUTS.retryGracePeriod/1000)}s grace)`);
    }
  });
}