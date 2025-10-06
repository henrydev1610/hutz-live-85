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
    const correlationId = `host-offer-${data.participantId}-${Date.now()}`;
    
    try {
      console.log(`🚨 CRÍTICO [${correlationId}] [HOST] Offer recebido de participante`, {
        participantId: data.participantId,
        fromSocketId: data.fromSocketId,
        hasOffer: !!data.offer,
        dataKeys: Object.keys(data),
        offerType: data.offer?.type,
        offerSdpLength: data.offer?.sdp?.length,
        timestamp: Date.now()
      });

      // VALIDAÇÃO 1: Dados obrigatórios
      if (!data.participantId) {
        console.error(`❌ CRÍTICO [${correlationId}] [HOST] Missing participantId:`, data);
        return;
      }

      if (!data.offer || !data.offer.sdp || !data.offer.type) {
        console.error(`❌ CRÍTICO [${correlationId}] [HOST] Invalid offer data:`, {
          hasOffer: !!data.offer,
          hasSdp: !!data.offer?.sdp,
          hasType: !!data.offer?.type
        });
        return;
      }

      // VALIDAÇÃO 2: Offer deve conter m=video
      const offerSdp = data.offer.sdp;
      const hasVideoInSDP = offerSdp.includes('m=video');
      
      if (!hasVideoInSDP) {
        console.error(`❌ CRÍTICO [${correlationId}] [HOST] Offer SEM m=video - rejeitando SDP inválido`);
        return;
      }
      
      console.log(`✅ [${correlationId}] [HOST] Offer validado - contém m=video`);

      // PASSO 1: Obter ou criar peer connection
      const pc = this.getOrCreatePC(data.participantId);
      console.log(`🚨 [${correlationId}] [HOST] PC state: connection=${pc.connectionState}, signaling=${pc.signalingState}, ice=${pc.iceConnectionState}`);
      
      // VALIDAÇÃO 3: PC deve estar em estado válido para receber offer
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        console.warn(`⚠️ [${correlationId}] [HOST] PC em estado inesperado ${pc.signalingState} - recriando...`);
        pc.close();
        hostPeerConnections.delete(data.participantId);
        const newPc = this.getOrCreatePC(data.participantId);
        console.log(`✅ [${correlationId}] [HOST] Novo PC criado - signaling state: ${newPc.signalingState}`);
      }
      
      // PASSO 2: Aplicar remote description
      console.log(`🚨 [${correlationId}] [HOST] ANTES setRemoteDescription - signaling: ${pc.signalingState}`);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log(`✅ [${correlationId}] [HOST] APÓS setRemoteDescription - signaling: ${pc.signalingState}`);
      } catch (error) {
        console.error(`❌ [${correlationId}] [HOST] ERRO em setRemoteDescription:`, error);
        throw error;
      }

      // PASSO 3: Aplicar ICE candidates bufferizados IMEDIATAMENTE
      const bufferedCandidates = participantICEBuffers.get(data.participantId) || [];
      if (bufferedCandidates.length > 0) {
        console.log(`🚨 [${correlationId}] [HOST] Aplicando ${bufferedCandidates.length} ICE candidates bufferizados`);
        
        for (let i = 0; i < bufferedCandidates.length; i++) {
          const candidate = bufferedCandidates[i];
          try {
            await pc.addIceCandidate(candidate);
            console.log(`✅ [${correlationId}] [HOST] Candidate ${i + 1}/${bufferedCandidates.length} aplicado`);
          } catch (error) {
            console.error(`❌ [${correlationId}] [HOST] Erro aplicando candidate ${i + 1}:`, error);
          }
        }
        participantICEBuffers.delete(data.participantId);
        console.log(`✅ [${correlationId}] [HOST] Todos os ${bufferedCandidates.length} candidates bufferizados aplicados`);
      } else {
        console.log(`ℹ️ [${correlationId}] [HOST] Nenhum ICE candidate bufferizado`);
      }

      // PASSO 4: Criar answer
      console.log(`🚨 [${correlationId}] [HOST] ANTES createAnswer - signaling: ${pc.signalingState}`);
      
      let answer: RTCSessionDescriptionInit;
      try {
        answer = await pc.createAnswer();
        console.log(`✅ [${correlationId}] [HOST] APÓS createAnswer - type: ${answer.type}, sdpLength: ${answer.sdp?.length}`);
      } catch (error) {
        console.error(`❌ [${correlationId}] [HOST] ERRO em createAnswer:`, error);
        throw error;
      }
      
      // VALIDAÇÃO 4: Answer deve conter m=video
      const answerSdp = answer.sdp || '';
      const answerHasVideo = answerSdp.includes('m=video');
      
      if (!answerHasVideo) {
        console.error(`❌ [${correlationId}] [HOST] Answer SEM m=video!`);
        throw new Error('Answer missing video section');
      }
      
      console.log(`✅ [${correlationId}] [HOST] Answer validado - contém m=video`);
      
      // PASSO 5: Aplicar local description
      console.log(`🚨 [${correlationId}] [HOST] ANTES setLocalDescription - signaling: ${pc.signalingState}`);
      
      try {
        await pc.setLocalDescription(answer);
        console.log(`✅ [${correlationId}] [HOST] APÓS setLocalDescription - signaling: ${pc.signalingState}`);
      } catch (error) {
        console.error(`❌ [${correlationId}] [HOST] ERRO em setLocalDescription:`, error);
        throw error;
      }

      // PASSO 6: Enviar answer via WebSocket
      console.log(`🚨 [${correlationId}] [HOST] Enviando answer para ${data.participantId}`);
      
      // CORREÇÃO CRÍTICA: Usar o formato correto do servidor
      const answerPayload = {
        roomId: data.roomId,
        participantId: data.participantId,
        answer: answer,
        fromUserId: 'host',
        timestamp: Date.now()
      };
      
      console.log(`📤 [${correlationId}] [HOST] Answer payload:`, {
        roomId: answerPayload.roomId,
        participantId: answerPayload.participantId,
        answerType: answerPayload.answer.type,
        answerSdpLength: answerPayload.answer.sdp?.length
      });
      
      // Emitir diretamente via socket
      unifiedWebSocketService.emit('webrtc-answer', answerPayload);

      console.log(`✅ ✅ ✅ [${correlationId}] [HOST] Answer enviado com sucesso - aguardando ICE e ontrack...`);

    } catch (error) {
      console.error(`❌ ❌ ❌ [${correlationId}] [HOST] ERRO FATAL ao processar offer:`, error);
      console.error(`Stack trace:`, (error as Error).stack);
      
      // Cleanup em caso de erro
      if (data.participantId) {
        console.log(`🧹 [${correlationId}] [HOST] Limpando conexão após erro`);
        this.cleanupHostHandshake(data.participantId);
      }
    }
  }

  handleRemoteCandidate(data: any): void {
    const correlationId = `host-ice-${data.participantId}-${Date.now()}`;
    const participantId = data.participantId || data.fromUserId;
    const candidate = data.candidate;

    console.log(`🚨 [${correlationId}] [HOST] ICE candidate recebido:`, {
      participantId,
      fromUserId: data.fromUserId,
      hasCandidate: !!candidate,
      candidatePreview: candidate?.candidate?.substring(0, 50)
    });

    // VALIDAÇÃO: Dados obrigatórios
    if (!candidate || !participantId) {
      console.error(`❌ [${correlationId}] [HOST] ICE candidate inválido:`, {
        hasCandidate: !!candidate,
        hasParticipantId: !!participantId
      });
      return;
    }

    // FASE 3: Rastrear ICE recebido
    const stats = this.iceStats.get(participantId) || { 
      candidatesSent: 0, 
      candidatesReceived: 0, 
      lastActivity: Date.now() 
    };
    stats.candidatesReceived++;
    stats.lastActivity = Date.now();
    this.iceStats.set(participantId, stats);

    const candidateType = candidate?.candidate?.includes('typ host') ? 'host' : 
                          candidate?.candidate?.includes('typ srflx') ? 'srflx' : 
                          candidate?.candidate?.includes('typ relay') ? 'relay' : 'unknown';

    console.log(`📊 [${correlationId}] [HOST] ICE stats:`, {
      candidatesReceived: stats.candidatesReceived,
      candidateType,
      participantId
    });

    const pc = hostPeerConnections.get(participantId);

    if (!pc) {
      console.warn(`⚠️ [${correlationId}] [HOST] PC não existe para ${participantId} - bufferizando candidate`);
      if (!participantICEBuffers.has(participantId)) {
        participantICEBuffers.set(participantId, []);
      }
      participantICEBuffers.get(participantId)!.push(new RTCIceCandidate(candidate));
      console.log(`📦 [${correlationId}] [HOST] Candidate bufferizado (total: ${participantICEBuffers.get(participantId)!.length})`);
      return;
    }

    console.log(`🔍 [${correlationId}] [HOST] PC state:`, {
      connectionState: pc.connectionState,
      signalingState: pc.signalingState,
      iceState: pc.iceConnectionState,
      hasRemoteDescription: !!pc.remoteDescription
    });

    if (pc.remoteDescription) {
      // PC pronto, aplicar candidate imediatamente
      console.log(`🚀 [${correlationId}] [HOST] Aplicando ICE candidate ${stats.candidatesReceived} imediatamente`);
      
      pc.addIceCandidate(new RTCIceCandidate(candidate))
        .then(() => {
          console.log(`✅ [${correlationId}] [HOST] ICE candidate ${stats.candidatesReceived} aplicado com sucesso`);
        })
        .catch((error) => {
          console.error(`❌ [${correlationId}] [HOST] Erro ao aplicar ICE candidate:`, error);
        });
    } else {
      // PC não pronto, buffer candidate
      console.log(`📦 [${correlationId}] [HOST] Remote description ainda não aplicada - bufferizando candidate`);
      
      if (!participantICEBuffers.has(participantId)) {
        participantICEBuffers.set(participantId, []);
      }
      participantICEBuffers.get(participantId)!.push(new RTCIceCandidate(candidate));
      
      const bufferSize = participantICEBuffers.get(participantId)!.length;
      console.log(`📦 [${correlationId}] [HOST] Candidate bufferizado (total no buffer: ${bufferSize})`);
    }
  }

  setupHostHandlers(): void {
    console.log('🚨 CRÍTICO [HOST] Setting up WebRTC handlers');
    console.log('🚨 CRÍTICO [HOST] unifiedWebSocketService available:', !!unifiedWebSocketService);
    console.log('🚨 CRÍTICO [HOST] unifiedWebSocketService.on available:', typeof unifiedWebSocketService.on);
    
    // CORREÇÃO CRÍTICA: Verificar se o método on existe antes de registrar
    if (!unifiedWebSocketService || typeof unifiedWebSocketService.on !== 'function') {
      console.error('❌ CRÍTICO [HOST] unifiedWebSocketService.on não está disponível!');
      return;
    }
    
    // Handler para webrtc-offer
    unifiedWebSocketService.on('webrtc-offer', (payload: any) => {
      console.log('🚨 CRÍTICO [HOST] ✅ webrtc-offer EVENT RECEIVED:', {
        hasParticipantId: !!payload.participantId,
        hasOffer: !!payload.offer,
        dataKeys: Object.keys(payload || {}),
        participantId: payload.participantId,
        fromSocketId: payload.fromSocketId,
        timestamp: Date.now()
      });
      this.handleOfferFromParticipant(payload);
    });
    console.log('✅ [HOST] webrtc-offer handler registered');

    // Handler para webrtc-candidate
    unifiedWebSocketService.on('webrtc-candidate', (payload: any) => {
      console.log('🚨 CRÍTICO [HOST] ✅ webrtc-candidate EVENT RECEIVED:', {
        hasParticipantId: !!payload.participantId,
        hasCandidate: !!payload.candidate,
        dataKeys: Object.keys(payload || {}),
        participantId: payload.participantId,
        timestamp: Date.now()
      });
      this.handleRemoteCandidate(payload);
    });
    console.log('✅ [HOST] webrtc-candidate handler registered');

    // FASE 3: Listener para participant-ready - FORÇAR REQUEST DE OFFER
    unifiedWebSocketService.on('participant-ready', (payload: any) => {
      console.log('🚀 CRÍTICO [HOST] ✅ participant-ready EVENT RECEIVED:', {
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
    console.log('✅ [HOST] participant-ready handler registered');

    console.log('✅ ✅ ✅ [HOST] ALL Enhanced handshake handlers registered successfully');
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

// Initialize handlers once - COM DELAY para garantir que o UnifiedWebSocketService esteja pronto
if (typeof window !== 'undefined' && !(window as any).__hostHandlersSetup) {
  console.log('🔧 [HOST] Scheduling handler initialization...');
  
  // FASE CRÍTICA: Adicionar monitor global de eventos WebRTC
  console.log('🔧 [HOST] Setting up global WebRTC event monitor...');
  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function(event: Event) {
    if (event.type.includes('webrtc-')) {
      console.log(`🚨 GLOBAL EVENT MONITOR: ${event.type} dispatched`, {
        type: event.type,
        detail: (event as CustomEvent).detail,
        target: this.constructor.name
      });
    }
    return originalDispatchEvent.call(this, event);
  };
  
  // Tentar imediatamente
  hostHandshakeManager.setupHostHandlers();
  (window as any).__hostHandlersSetup = true;
  console.log('✅ [HOST] Enhanced handshake handlers initialized IMMEDIATELY');
  
  // Também agendar para 2 segundos depois (garantia dupla)
  setTimeout(() => {
    console.log('🔧 [HOST] Re-registering handlers after 2s (safety measure)...');
    hostHandshakeManager.setupHostHandlers();
    console.log('✅ [HOST] Enhanced handshake handlers RE-INITIALIZED after 2s');
  }, 2000);
}