// ============= Host WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { webrtcGlobalDebugger } from '@/utils/webrtc/WebRTCGlobalDebug';

const hostPeerConnections = new Map<string, RTCPeerConnection>();
const participantICEBuffers = new Map<string, RTCIceCandidate[]>();
const handshakeTimeouts = new Map<string, NodeJS.Timeout>();

// FASE 3: ICE Candidate Diagnostics
interface ICEStats {
  candidatesSent: number;
  candidatesReceived: number;
  lastActivity: number;
}

class HostHandshakeManager {
  private iceStats = new Map<string, ICEStats>();
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

      // FASE 4: ENHANCED EVENT HANDLERS WITH STREAM VALIDATION
      pc.ontrack = (event) => {
        const correlationId = `host-ontrack-${participantId}-${Date.now()}`;
        
        console.log(`🚨 CRÍTICO [${correlationId}] [HOST] ontrack DISPARADO para ${participantId}:`, {
          streamCount: event.streams.length,
          trackKind: event.track.kind,
          trackEnabled: event.track.enabled,
          trackReadyState: event.track.readyState,
          timestamp: Date.now(),
          correlationId
        });
        
        if (event.streams.length > 0) {
          const stream = event.streams[0];
          
          // FASE 4: VALIDAÇÃO CRÍTICA DO STREAM
          const videoTrack = stream.getVideoTracks()[0];
          if (!videoTrack) {
            console.error(`❌ FASE 4 [${correlationId}] Stream sem video track de ${participantId}`);
            return;
          }
          
          if (videoTrack.readyState !== 'live') {
            console.error(`❌ FASE 4 [${correlationId}] Video track not live de ${participantId}:`, videoTrack.readyState);
            return;
          }
          
          console.log(`✅ FASE 4 [${correlationId}] Stream válido recebido de ${participantId}:`, {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            videoEnabled: videoTrack.enabled,
            videoMuted: videoTrack.muted,
            videoReadyState: videoTrack.readyState,
            trackDetails: stream.getVideoTracks().map(t => ({
              id: t.id,
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState
            }))
          });
          
          // FASE 4: DISPATCH TO CENTRALIZED STREAM DISPLAY MANAGER
          console.log(`🚨 CRÍTICO [${correlationId}] [HOST] Dispatching participant-stream-connected event para ${participantId}`);
          window.dispatchEvent(new CustomEvent('participant-stream-connected', {
            detail: { 
              participantId, 
              stream, 
              correlationId,
              source: 'host-handshake',
              timestamp: Date.now()
            }
          }));
          
          console.log(`✅ CRÍTICO [${correlationId}] [HOST] Event participant-stream-connected dispatched para ${participantId}`);
          
        } else {
          console.warn(`⚠️ [${correlationId}] [HOST] ontrack disparado mas sem streams para ${participantId}`);
        }
      };
      
      // FASE 3: CRITICAL - Validar que ontrack foi registrado ANTES de qualquer operação SDP
      console.log(`✅ FASE 3 [HOST] pc.ontrack handler registered for ${participantId} BEFORE any SDP operation`);
      
      // FASE 3: Adicionar listener de debug para verificar se handler é chamado
      const originalOnTrack = pc.ontrack;
      pc.ontrack = (event) => {
        console.log(`🚨 CRÍTICO FASE 3 [HOST] ontrack CALLED for ${participantId} - handler is ACTIVE`);
        if (originalOnTrack) {
          originalOnTrack.call(pc, event);
        }
      };

      // Add receive-only transceiver for video BEFORE setRemoteDescription
      pc.addTransceiver('video', { direction: 'recvonly' });
      console.log(`[HOST] addTransceiver('video', recvonly) for ${participantId}`);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // FASE 3: Rastrear ICE enviado
          const stats = this.iceStats.get(participantId) || { 
            candidatesSent: 0, 
            candidatesReceived: 0, 
            lastActivity: Date.now() 
          };
          stats.candidatesSent++;
          stats.lastActivity = Date.now();
          this.iceStats.set(participantId, stats);
          
          console.log(`[ICE] candidate ${stats.candidatesSent} generated for ${participantId}, sending`);
          unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
        }
      };
      
      // FASE 5: Listener para icegatheringstatechange
      pc.onicegatheringstatechange = () => {
        const gatheringState = pc.iceGatheringState;
        console.log(`🧊 FASE 5 [HOST]: ICE gathering state changed to: ${gatheringState} for ${participantId}`);
        if (gatheringState === 'complete') {
          console.log(`✅ FASE 5 [HOST]: ICE gathering complete for ${participantId}`);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`[HOST] Connection state for ${participantId}: ${state}`);
        
        if (state === 'connected') {
          // FASE 1: Notificar manager de conexão bem-sucedida
          console.log(`✅ [HOST] WebRTC peer ${participantId} CONECTADO`);
          window.dispatchEvent(new CustomEvent('webrtc-peer-connected', {
            detail: { participantId, timestamp: Date.now() }
          }));
          
          // Clear timeout on successful connection
          const timeout = handshakeTimeouts.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            handshakeTimeouts.delete(participantId);
          }
          
          // FASE 4: Clear handshake monitor
          const monitorTimeout = handshakeTimeouts.get(participantId + '-monitor');
          if (monitorTimeout) {
            clearTimeout(monitorTimeout);
            handshakeTimeouts.delete(participantId + '-monitor');
          }
        } else if (state === 'failed' || state === 'closed') {
          console.log(`[HOST] Connection failed/closed for ${participantId}, cleaning up`);
          
          // FASE 1: Notificar manager de falha
          window.dispatchEvent(new CustomEvent('webrtc-peer-failed', {
            detail: { participantId, state, timestamp: Date.now() }
          }));
          
          this.cleanupHostHandshake(participantId);
        } else if (state === 'connecting') {
          // FASE 1: Log explícito de tentativa de conexão
          console.log(`🔄 [HOST] WebRTC peer ${participantId} está CONNECTING`);
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
      
      // Desktop-optimized timeout: 10 seconds max
      const timeout = setTimeout(() => {
        console.log(`[HOST] Desktop handshake timeout for ${participantId} (10s) - force cleanup`);
        this.cleanupHostHandshake(participantId);
        
        // Dispatch desktop timeout event
        window.dispatchEvent(new CustomEvent('desktop-handshake-timeout', {
          detail: { participantId, timeout: 10000 }
        }));
      }, 10000); // Desktop: 10 seconds timeout
      
      handshakeTimeouts.set(participantId, timeout);
      
      // FASE 4: Adicionar timeout para detecção de handshake travado
      const handshakeMonitor = setTimeout(() => {
        const pc = hostPeerConnections.get(participantId);
        if (pc && pc.connectionState !== 'connected') {
          console.warn(`⚠️ [HOST] Handshake travado para ${participantId}:`, {
            connectionState: pc.connectionState,
            iceState: pc.iceConnectionState,
            signalingState: pc.signalingState,
            iceStats: this.iceStats.get(participantId)
          });
          
          // Disparar evento de diagnóstico
          window.dispatchEvent(new CustomEvent('webrtc-handshake-stuck', {
            detail: { 
              participantId, 
              connectionState: pc.connectionState,
              iceState: pc.iceConnectionState,
              iceStats: this.iceStats.get(participantId)
            }
          }));
          
          // Tentar forçar renegociação
          console.log(`🔄 [HOST] Tentando renegociar com ${participantId}...`);
          this.requestOfferFromParticipant(participantId);
        }
      }, 8000); // 8 segundos para detectar travamento
      
      handshakeTimeouts.set(participantId + '-monitor', handshakeMonitor);
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

      // PATCH: Validate that offer contains m=video BEFORE applying
      const offerSdp = data.offer.sdp;
      const hasVideoInSDP = offerSdp.includes('m=video');
      
      if (!hasVideoInSDP) {
        console.error('❌ PATCH [HOST] Offer WITHOUT m=video - rejecting invalid SDP:', {
          participantId: data.participantId,
          sdpPreview: offerSdp.substring(0, 200)
        });
        return;
      }
      
      console.log(`✅ PATCH [HOST] Offer validated - contains m=video for ${data.participantId}`);

      // PASSO 1: Obter ou criar peer connection
      const pc = this.getOrCreatePC(data.participantId);
      console.log(`🚨 CRÍTICO [HOST] RTCPeerConnection state: ${pc.connectionState}, signaling: ${pc.signalingState}`);
      
      // PATCH: Validate PC is ready to receive offer
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        console.warn(`⚠️ PATCH [HOST] PC in unexpected state ${pc.signalingState} - closing and recreating`);
        pc.close();
        hostPeerConnections.delete(data.participantId);
        const newPc = this.getOrCreatePC(data.participantId);
        console.log(`✅ PATCH [HOST] Fresh PC created for ${data.participantId}`);
      }
      
      // PASSO 2: Set remote description (MUST happen before creating answer)
      console.log(`🚨 CRÍTICO [HOST] Setting remote description for ${data.participantId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log(`✅ PATCH [HOST] Remote description set - signaling state now: ${pc.signalingState}`);

      // PATCH: Apply buffered candidates IMMEDIATELY after setRemoteDescription
      const bufferedCandidates = participantICEBuffers.get(data.participantId) || [];
      if (bufferedCandidates.length > 0) {
        console.log(`🚨 PATCH [HOST] Flushing ${bufferedCandidates.length} buffered ICE candidates for ${data.participantId}`);
        
        for (let i = 0; i < bufferedCandidates.length; i++) {
          const candidate = bufferedCandidates[i];
          try {
            await pc.addIceCandidate(candidate);
            console.log(`✅ PATCH [HOST] Candidate ${i + 1}/${bufferedCandidates.length} applied`);
          } catch (error) {
            console.error(`❌ PATCH [HOST] Error applying buffered candidate ${i + 1}:`, error);
          }
        }
        participantICEBuffers.delete(data.participantId);
        console.log(`✅ PATCH [HOST] All ${bufferedCandidates.length} buffered candidates applied for ${data.participantId}`);
      }

      // PASSO 3: Criar answer (MUST happen after setRemoteDescription)
      console.log(`🚨 CRÍTICO [HOST] Creating answer for ${data.participantId}`);
      const answer = await pc.createAnswer();
      
      // PATCH: Validate answer contains m=video and a=recvonly
      const answerSdp = answer.sdp || '';
      const answerHasVideo = answerSdp.includes('m=video');
      const answerHasRecvOnly = answerSdp.includes('a=recvonly') || answerSdp.includes('a=sendrecv');
      
      console.log(`🚨 PATCH [HOST] Answer validation for ${data.participantId}:`, {
        hasVideo: answerHasVideo,
        hasRecvOnly: answerHasRecvOnly,
        sdpPreview: answerSdp.substring(0, 200)
      });
      
      if (!answerHasVideo) {
        console.error(`❌ PATCH [HOST] Answer WITHOUT m=video - this should not happen!`);
        throw new Error('Answer missing video section');
      }
      
      console.log(`✅ PATCH [HOST] Answer created and validated for ${data.participantId}`);
      
      // PASSO 4: Set local description
      console.log(`🚨 CRÍTICO [HOST] Setting local description for ${data.participantId}`);
      await pc.setLocalDescription(answer);
      console.log(`✅ PATCH [HOST] Local description set - signaling state now: ${pc.signalingState}`);

      // PASSO 5: Enviar answer via WebSocket
      console.log(`🚨 CRÍTICO [HOST] Sending answer to ${data.participantId}`);
      unifiedWebSocketService.emit('webrtc-answer', {
        answer,
        toSocketId: data.fromSocketId,
        hostId: 'host',
        participantId: data.participantId,
        timestamp: Date.now()
      });

      console.log(`✅ CRÍTICO PATCH [HOST] Answer sent successfully to ${data.participantId} - SDP exchange complete, waiting for ICE and ontrack...`);

    } catch (error) {
      console.error('❌ CRÍTICO [HOST] Error handling offer:', error);
      
      // PATCH: Clean up failed connection attempt
      if (data.participantId) {
        this.cleanupHostHandshake(data.participantId);
      }
    }
  }

  handleRemoteCandidate(data: any): void {
    const participantId = data.participantId || data.fromUserId;
    const candidate = data.candidate;

    // FASE 3: Rastrear ICE recebido
    const stats = this.iceStats.get(participantId) || { 
      candidatesSent: 0, 
      candidatesReceived: 0, 
      lastActivity: Date.now() 
    };
    stats.candidatesReceived++;
    stats.lastActivity = Date.now();
    this.iceStats.set(participantId, stats);

    console.log(`🚨 CRÍTICO [HOST] Received webrtc-candidate ${stats.candidatesReceived}:`, {
      participantId,
      hasCandidate: !!candidate,
      candidateType: candidate?.candidate?.includes('host') ? 'host' : 
                    candidate?.candidate?.includes('srflx') ? 'srflx' : 'relay',
      iceStats: stats
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
        console.log(`✅ [HOST] ICE candidate ${stats.candidatesReceived} aplicado imediatamente para ${participantId}`);
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

    // FASE 3: Listener para participant-ready - FORÇAR REQUEST DE OFFER
    unifiedWebSocketService.on('participant-ready', (payload: any) => {
      console.log('🚀 CRÍTICO [HOST] Received participant-ready:', {
        participantId: payload.participantId,
        hasStream: payload.hasStream,
        streamInfo: payload.streamInfo,
        timestamp: Date.now()
      });

      // Forçar request de offer após 1 segundo
      setTimeout(() => {
        console.log(`📞 [HOST] Solicitando offer de ${payload.participantId}`);
        this.requestOfferFromParticipant(payload.participantId);
      }, 1000);
    });

    console.log('✅ [HOST] Enhanced handshake handlers registered (com participant-ready)');
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
    
    // FASE 3: Clear ICE stats
    this.iceStats.delete(participantId);

    // Clear timeout
    const timeout = handshakeTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      handshakeTimeouts.delete(participantId);
    }
    
    // FASE 4: Clear handshake monitor timeout
    const monitorTimeout = handshakeTimeouts.get(participantId + '-monitor');
    if (monitorTimeout) {
      clearTimeout(monitorTimeout);
      handshakeTimeouts.delete(participantId + '-monitor');
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