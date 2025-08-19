// ============= Host WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { webrtcGlobalDebugger } from '@/utils/webrtc/WebRTCGlobalDebug';

const hostPeerConnections = new Map<string, RTCPeerConnection>();
const participantICEBuffers = new Map<string, RTCIceCandidate[]>();
const handshakeTimeouts = new Map<string, NodeJS.Timeout>();

class HostHandshakeManager {
  private getOrCreatePC(participantId: string): RTCPeerConnection {
    let pc = hostPeerConnections.get(participantId);
    
    if (!pc) {
      const pcStartTime = performance.now();
      console.log(`[HOST] Creating new RTCPeerConnection for ${participantId}`);
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      // Event handlers
      pc.ontrack = async (event) => {
        console.log(`🚨 CRÍTICO [HOST] ontrack DISPARADO para ${participantId}:`, {
          streamCount: event.streams.length,
          trackKind: event.track.kind,
          trackEnabled: event.track.enabled,
          trackReadyState: event.track.readyState,
          timestamp: Date.now()
        });
        
        if (event.streams.length > 0) {
          const stream = event.streams[0];
          console.log(`✅ CRÍTICO [HOST] Stream recebido de ${participantId}:`, {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            videoEnabled: stream.getVideoTracks()[0]?.enabled,
            audioEnabled: stream.getAudioTracks()[0]?.enabled
          });

          // CORREÇÃO CRÍTICA: Aguardar tracks estarem 'live' antes de processar
          console.log(`🔥 [HOST] AGUARDANDO TRACKS 'LIVE' no ontrack para: ${participantId}`);
          const { waitUntilTracksReady } = await import('@/utils/media/trackReadyWaiter');
          const tracksReady = await waitUntilTracksReady(stream, participantId, 3000);

          if (!tracksReady) {
            console.warn(`⚠️ [HOST] Tracks não ficaram 'live' para ${participantId} - prosseguindo mesmo assim`);
          }

          const tracks = stream.getVideoTracks();
          if (tracks.length === 0) {
            console.warn(`⚠️ [HOST] Nenhuma track de vídeo para ${participantId} - não processando stream`);
            return;
          }

          console.log(`🎥 [HOST] VALIDATION LOG para ${participantId}:`, {
            streamId: stream.id,
            videoTracks: tracks.length,
            trackReadyState: tracks[0].readyState,
            trackEnabled: tracks[0].enabled,
            tracksReady
          });
          
          // Dispatch custom event para notificar que stream foi recebido
          console.log(`🚨 CRÍTICO [HOST] Dispatching participant-stream-connected event para ${participantId}`);
          window.dispatchEvent(new CustomEvent('participant-stream-connected', {
            detail: { participantId, stream }
          }));
          
          console.log(`✅ CRÍTICO [HOST] Event participant-stream-connected dispatched para ${participantId}`);
        } else {
          console.warn(`⚠️ [HOST] ontrack disparado mas sem streams para ${participantId}`);
        }
      };

      // Add receive-only transceiver for video BEFORE setRemoteDescription
      pc.addTransceiver('video', { direction: 'recvonly' });
      console.log(`[HOST] addTransceiver('video', recvonly) for ${participantId}`);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[ICE] candidate generated for ${participantId}, sending`);
          unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`[HOST] Connection state for ${participantId}: ${state}`);
        
        // CORREÇÃO 3: Emitir eventos de estado WebRTC
        window.dispatchEvent(new CustomEvent('webrtc-negotiation-state', {
          detail: { participantId, state: state === 'connected' ? 'connected' : state }
        }));
        
        if (state === 'connected') {
          // Clear timeout on successful connection
          const timeout = handshakeTimeouts.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            handshakeTimeouts.delete(participantId);
          }
        } else if (state === 'failed' || state === 'closed') {
          console.log(`[HOST] Connection failed/closed for ${participantId}, cleaning up`);
          this.cleanupHostHandshake(participantId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`[HOST] ICE connection state for ${participantId}: ${state}`);
        
        if (state === 'failed') {
          console.log(`[HOST] ICE connection failed for ${participantId}`);
          this.cleanupHostHandshake(participantId);
        }
      };

      const pcDuration = performance.now() - pcStartTime;
      console.log(`[HOST] RTCPeerConnection created for ${participantId} (${pcDuration.toFixed(1)}ms)`);

      hostPeerConnections.set(participantId, pc);
      
      // CORREÇÃO 1: Timeout adaptativo baseado no tipo de dispositivo
      const isMobileParticipant = participantId.includes('mobile') || participantId.includes('participant');
      const timeoutDuration = isMobileParticipant ? 30000 : 15000; // 30s mobile, 15s desktop
      
      console.log(`[HOST] Setting ${isMobileParticipant ? 'MOBILE' : 'DESKTOP'} timeout for ${participantId}: ${timeoutDuration}ms`);
      
      const timeout = setTimeout(() => {
        console.log(`[HOST] ${isMobileParticipant ? 'Mobile' : 'Desktop'} handshake timeout for ${participantId} (${timeoutDuration}ms)`);
        
        // CORREÇÃO 2: Fallback automático - tentar criar offer direto do host
        console.log(`[HOST] FALLBACK: Attempting direct offer creation for ${participantId}`);
        this.attemptDirectOfferCreation(participantId);
        
      }, timeoutDuration);
      
      handshakeTimeouts.set(participantId, timeout);
    }

    return pc;
  }

  async handleOfferFromParticipant(data: any): Promise<void> {
    try {
      console.log('🚨 CRÍTICO [HOST] Offer recebido de participante', {
        participantId: data.participantId,
        hasOffer: !!data.offer,
        dataKeys: Object.keys(data),
        offerType: data.offer?.type,
        offerSdpPreview: data.offer?.sdp?.substring(0, 100) + '...',
        timestamp: Date.now()
      });

      if (!data.participantId || !data.offer) {
        console.error('❌ CRÍTICO [HOST] Invalid offer data:', data);
        return;
      }

      // CORREÇÃO 3: Emitir estado de negociação
      window.dispatchEvent(new CustomEvent('webrtc-negotiation-state', {
        detail: { participantId: data.participantId, state: 'negotiating' }
      }));

      console.log(`✅ [HOST] Processing offer from ${data.participantId}`);

      // PASSO 1: Obter ou criar peer connection
      const pc = this.getOrCreatePC(data.participantId);
      console.log(`🚨 CRÍTICO [HOST] RTCPeerConnection state: ${pc.connectionState}`);
      
      // PASSO 2: Set remote description
      console.log(`🚨 CRÍTICO [HOST] Setting remote description for ${data.participantId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log(`✅ [HOST] Remote description set para ${data.participantId}`);

      // PASSO 3: Aplicar candidates em buffer se existirem
      const bufferedCandidates = participantICEBuffers.get(data.participantId) || [];
      if (bufferedCandidates.length > 0) {
        console.log(`🚨 CRÍTICO [HOST] Applying ${bufferedCandidates.length} buffered candidates for ${data.participantId}`);
        for (const candidate of bufferedCandidates) {
          try {
            await pc.addIceCandidate(candidate);
            console.log(`✅ [HOST] ICE candidate aplicado para ${data.participantId}`);
          } catch (error) {
            console.error(`❌ [HOST] Error applying buffered candidate for ${data.participantId}:`, error);
          }
        }
        participantICEBuffers.delete(data.participantId);
        console.log(`✅ [HOST] Buffer de ICE candidates limpo para ${data.participantId}`);
      }

      // PASSO 4: Criar answer
      console.log(`🚨 CRÍTICO [HOST] Creating answer for ${data.participantId}`);
      const answer = await pc.createAnswer();
      console.log(`✅ [HOST] Answer criado para ${data.participantId}`);
      
      // PASSO 5: Set local description
      console.log(`🚨 CRÍTICO [HOST] Setting local description for ${data.participantId}`);
      await pc.setLocalDescription(answer);
      console.log(`✅ [HOST] Local description set para ${data.participantId}`);

      // PASSO 6: Enviar answer
      console.log(`🚨 CRÍTICO [HOST] Sending answer to ${data.participantId}`);
      
      // Validar se answer tem SDP antes de enviar
      if (!answer.sdp) {
        console.error(`❌ CRÍTICO [HOST] Answer sem SDP para ${data.participantId}:`, answer);
        return;
      }

      // CORREÇÃO CRÍTICA: Usar sendWebRTCAnswer em vez de emit
      unifiedWebSocketService.sendWebRTCAnswer(data.participantId, answer.sdp, answer.type);
      
      console.log(`✅ CRÍTICO [HOST] Answer sent to ${data.participantId} via sendWebRTCAnswer - Aguardando ontrack...`);
      console.log(`📋 CRÍTICO [HOST] Answer details: type=${answer.type}, sdpLength=${answer.sdp.length}`);

      // CORREÇÃO 3: Emitir estado conectando após answer
      window.dispatchEvent(new CustomEvent('webrtc-negotiation-state', {
        detail: { participantId: data.participantId, state: 'connecting' }
      }));

    } catch (error) {
      console.error('❌ CRÍTICO [HOST] Error handling offer:', error);
      
      // CORREÇÃO 3: Emitir estado de erro
      window.dispatchEvent(new CustomEvent('webrtc-negotiation-state', {
        detail: { participantId: data.participantId, state: 'failed' }
      }));
    }
  }

  handleRemoteCandidate(data: any): void {
    const participantId = data.participantId || data.fromUserId;
    const candidate = data.candidate;

    console.log('🚨 CRÍTICO [HOST] Received webrtc-candidate:', {
      participantId,
      hasCandidate: !!candidate,
      candidateType: candidate?.candidate?.includes('host') ? 'host' : 
                    candidate?.candidate?.includes('srflx') ? 'srflx' : 'relay'
    });

    if (!candidate || !participantId) {
      console.error('❌ [HOST] handleRemoteCandidate: Missing candidate or participantId');
      return;
    }

    const pc = hostPeerConnections.get(participantId);

    if (pc && pc.remoteDescription) {
      // PC pronto, aplicar candidate imediatamente
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`✅ [HOST] ICE candidate aplicado imediatamente para ${participantId}`);
      } catch (error) {
        console.error(`❌ [HOST] Error applying ICE candidate for ${participantId}:`, error);
      }
    } else {
      // PC não pronto, buffer candidate
      if (!participantICEBuffers.has(participantId)) {
        participantICEBuffers.set(participantId, []);
      }
      participantICEBuffers.get(participantId)!.push(new RTCIceCandidate(candidate));
      console.log(`📦 [HOST] ICE candidate bufferizado para ${participantId} (total: ${participantICEBuffers.get(participantId)!.length})`);
    }
  }

  setupHostHandlers(): void {
    console.log('🚨 CRÍTICO [HOST] Setting up WebRTC handlers');
    
    unifiedWebSocketService.on('webrtc-offer', (payload: any) => {
      console.log('🚨 CRÍTICO [HOST] Received webrtc-offer:', {
        hasParticipantId: !!payload.participantId,
        hasOffer: !!payload.offer,
        dataKeys: Object.keys(payload),
        timestamp: Date.now()
      });
      this.handleOfferFromParticipant(payload);
    });

    unifiedWebSocketService.on('webrtc-candidate', (payload: any) => {
      console.log('🚨 CRÍTICO [HOST] Received webrtc-candidate:', {
        hasParticipantId: !!payload.participantId,
        hasCandidate: !!payload.candidate,
        dataKeys: Object.keys(payload),
        timestamp: Date.now()
      });
      this.handleRemoteCandidate(payload);
    });

    console.log('✅ [HOST] Enhanced handshake handlers registered');
  }

  requestOfferFromParticipant(participantId: string): void {
    if (!unifiedWebSocketService) {
      console.error('❌ [HOST] unifiedWebSocketService not available');
      return;
    }

    console.log(`[HOST] Requesting offer from participant: ${participantId}`);
    unifiedWebSocketService.requestOfferFromParticipant(participantId);
  }

  cleanupHostHandshake(participantId: string): void {
    const pc = hostPeerConnections.get(participantId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch (err) {
        console.warn(`[HOST] Error closing PC for ${participantId}:`, err);
      }
      hostPeerConnections.delete(participantId);
    }

    // Clear pending candidates
    participantICEBuffers.delete(participantId);

    // Clear timeout
    const timeout = handshakeTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      handshakeTimeouts.delete(participantId);
    }

    console.log(`[HOST] Cleaned up handshake for ${participantId}`);
  }

  cleanupAllStuckConnections(): void {
    console.log('[HOST] Cleaning up all stuck connections');
    
    hostPeerConnections.forEach((pc, participantId) => {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      
      if (state === 'connecting' || state === 'failed' || iceState === 'checking' || iceState === 'failed') {
        console.log(`[HOST] Cleaning up stuck connection for ${participantId} (state: ${state}, ice: ${iceState})`);
        this.cleanupHostHandshake(participantId);
      }
    });
  }

  getHostConnectionsState(): Map<string, { connectionState: string; iceState: string; signalingState: string }> {
    const states = new Map();
    hostPeerConnections.forEach((pc, participantId) => {
      states.set(participantId, {
        connectionState: pc.connectionState,
        iceState: pc.iceConnectionState,
        signalingState: pc.signalingState
      });
    });
    return states;
  }

  // CORREÇÃO 2: Método de fallback para criar offer direto do host
  async attemptDirectOfferCreation(participantId: string): Promise<void> {
    try {
      console.log(`🚀 [HOST] FALLBACK: Creating direct offer for ${participantId}`);
      
      const pc = this.getOrCreatePC(participantId);
      
      // Criar offer do lado host
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log(`✅ [HOST] FALLBACK: Direct offer created for ${participantId}`);
      
      // Enviar offer diretamente para o participante
      unifiedWebSocketService.sendWebRTCOffer(participantId, offer.sdp!, offer.type!);
      
      console.log(`📤 [HOST] FALLBACK: Direct offer sent to ${participantId}`);
      
      // Manter timeout ativo mas com tempo menor para response
      setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          console.log(`[HOST] FALLBACK timeout - cleaning up ${participantId}`);
          this.cleanupHostHandshake(participantId);
        }
      }, 15000); // 15s para resposta ao fallback
      
    } catch (error) {
      console.error(`❌ [HOST] FALLBACK failed for ${participantId}:`, error);
      this.cleanupHostHandshake(participantId);
    }
  }

  resetHostWebRTC(): void {
    console.log('[HOST] Resetting all WebRTC connections');
    
    // Close all connections
    hostPeerConnections.forEach((pc, participantId) => {
      this.cleanupHostHandshake(participantId);
    });
    
    // Clear all maps
    hostPeerConnections.clear();
    participantICEBuffers.clear();
    handshakeTimeouts.clear();
    
    console.log('[HOST] WebRTC reset complete');
  }
}

// Global instance
const hostHandshakeManager = new HostHandshakeManager();

// Expor funções de debug globalmente
webrtcGlobalDebugger.exposeGlobalFunctions();
webrtcGlobalDebugger.startHeartbeat(15000); // Heartbeat a cada 15 segundos

// Export functions for external use
export const getOrCreatePC = (participantId: string) => hostHandshakeManager['getOrCreatePC'](participantId);
export const handleOfferFromParticipant = (data: any) => hostHandshakeManager.handleOfferFromParticipant(data);
export const handleRemoteCandidate = (data: any) => hostHandshakeManager.handleRemoteCandidate(data);
export const setupHostHandlers = () => hostHandshakeManager.setupHostHandlers();
export const requestOfferFromParticipant = (participantId: string) => hostHandshakeManager.requestOfferFromParticipant(participantId);
export const cleanupHostHandshake = (participantId: string) => hostHandshakeManager.cleanupHostHandshake(participantId);
export const cleanupAllStuckConnections = () => hostHandshakeManager.cleanupAllStuckConnections();
export const getHostConnectionsState = () => hostHandshakeManager.getHostConnectionsState();
export const resetHostWebRTC = () => hostHandshakeManager.resetHostWebRTC();

// Initialize handlers once
if (typeof window !== 'undefined' && !(window as any).__hostHandlersSetup) {
  hostHandshakeManager.setupHostHandlers();
  (window as any).__hostHandlersSetup = true;
  console.log('✅ [HOST] Enhanced handshake handlers initialized');
}