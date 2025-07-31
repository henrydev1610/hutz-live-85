import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private offerTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private currentParticipantId: string | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
    console.log('📞 WEBRTC DEBUG: Stream callback registrado com sucesso');
    console.log('📞 WEBRTC DEBUG: Callback é válido:', typeof callback === 'function');
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
    console.log('👤 WEBRTC DEBUG: Participant join callback registrado com sucesso');
    console.log('👤 WEBRTC DEBUG: Callback é válido:', typeof callback === 'function');
  }

  // FASE 2: Novo método para iniciar handshake automático
  async initiateHandshake(participantId: string): Promise<void> {
    console.log(`🤝 FASE 2: Auto-initiating handshake with ${participantId}`);
    try {
      const peerConnection = this.createPeerConnection(participantId);
      await this.initiateCall(participantId);
      console.log(`✅ FASE 2: Handshake initiated successfully with ${participantId}`);
    } catch (error) {
      console.error(`❌ FASE 2: Failed to initiate handshake with ${participantId}:`, error);
      throw error;
    }
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 WEBRTC DEBUG: ===== CRIANDO PEER CONNECTION =====`);
    console.log(`🔗 WEBRTC DEBUG: Participante: ${participantId}`);
    console.log(`🔗 WEBRTC DEBUG: Conexões existentes: ${this.peerConnections.size}`);
    console.log(`🔗 WEBRTC DEBUG: Stream callback disponível: ${!!this.streamCallback}`);
    console.log(`🔗 WEBRTC DEBUG: Join callback disponível: ${!!this.participantJoinCallback}`);

    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      const existingPC = this.peerConnections.get(participantId)!;
      console.log(`🔗 WEBRTC DEBUG: Conexão existente encontrada para ${participantId}`);
      console.log(`🔗 WEBRTC DEBUG: Estado da conexão existente: ${existingPC.connectionState}`);
      console.log(`🔗 WEBRTC DEBUG: Estado ICE existente: ${existingPC.iceConnectionState}`);
      
      // FASE 2: Verificar se a conexão existente está em bom estado
      if (existingPC.connectionState === 'connected' || 
          existingPC.connectionState === 'connecting') {
        console.log(`♻️ WEBRTC DEBUG: Reutilizando conexão existente para: ${participantId} (estado: ${existingPC.connectionState})`);
        return existingPC;
      } else {
        console.log(`🔄 WEBRTC DEBUG: Substituindo conexão inválida para: ${participantId} (estado: ${existingPC.connectionState})`);
        existingPC.close();
        this.peerConnections.delete(participantId);
      }
    }

    // Criar nome único para o relay baseado na sessão e timestamp
    const uniqueId = `relay-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    console.log(`🔧 Creating WebRTC connection with unique ID: ${uniqueId}`);
    const peerConnection = new RTCPeerConnection(config);
    
    // Adicionar propriedade única para debug
    (peerConnection as any).__uniqueId = uniqueId;
    
    this.peerConnections.set(participantId, peerConnection);

    peerConnection.onicecandidate = (event) => {
      console.log(`🧊 WEBRTC DEBUG: ===== ICE CANDIDATE EVENT =====`);
      console.log(`🧊 WEBRTC DEBUG: Participante: ${participantId}`);
      console.log(`🧊 WEBRTC DEBUG: Candidate exists: ${!!event.candidate}`);
      
      if (event.candidate) {
        console.log(`🧊 WEBRTC DEBUG: Enviando ICE candidate para: ${participantId}`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          foundation: event.candidate.foundation
        });
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
        console.log(`🧊 WEBRTC DEBUG: ICE candidate enviado via WebSocket`);
      } else {
        console.log(`🧊 WEBRTC DEBUG: ICE gathering completado para: ${participantId}`);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 CONNECTION-CRÍTICO: ${participantId} mudou para: ${peerConnection.connectionState}`);

      // VISUAL LOG: Toast para mudanças de estado
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('webrtc-state-change', {
          detail: { 
            participantId, 
            state: peerConnection.connectionState,
            timestamp: Date.now()
          }
        }));
      }

      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ CONNECTION-CRÍTICO: Conexão estabelecida com: ${participantId}`);
        this.clearOfferTimeout(participantId);
        
        // CORREÇÃO: Usar callback direto ao invés de dependência circular
        console.log(`🔄 CONNECTION-CRÍTICO: Atualizando estado WebRTC para conectado via callback`);
        
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ CONNECTION-CRÍTICO: Falha na conexão com: ${participantId}`);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.connectionState === 'connecting') {
        console.log(`🔄 CONNECTION-CRÍTICO: Conectando com: ${participantId}`);
      } else if (peerConnection.connectionState === 'new') {
        console.log(`🆕 CONNECTION-CRÍTICO: Nova conexão criada para: ${participantId}`);
      }
    };

    // FASE 3: Adicionar evento específico de ICE
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE CONNECTION: ${participantId} state changed to: ${peerConnection.iceConnectionState}`);
      
      // Monitorar estados de ICE que podem indicar problemas
      if (peerConnection.iceConnectionState === 'failed') {
        console.error(`❌ ICE CONNECTION FAILED: Peer ${participantId} ICE negotiation failed`);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.iceConnectionState === 'disconnected') {
        console.warn(`⚠️ ICE CONNECTION DISCONNECTED: Peer ${participantId} ICE connection unstable`);
      }
    };

    // CORREÇÃO CRÍTICA: ontrack com múltiplos fallbacks
    peerConnection.ontrack = (event) => {
      console.log('🎵 WEBRTC→REACT BRIDGE: Track received from participant:', participantId);
      
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('📺 WEBRTC→REACT BRIDGE: Stream válido recebido:', {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          participantId,
          active: stream.active
        });
        
        // PONTE 1: Callback direto React
        if (this.streamCallback) {
          console.log('📞 PONTE 1: Executando callback React IMEDIATO');
          try {
            this.streamCallback(participantId, stream);
            console.log('✅ PONTE 1: Callback React executado com sucesso');
          } catch (error) {
            console.error('❌ PONTE 1: Erro no callback React:', error);
          }
        } else {
          console.error('❌ PONTE 1: Callback React não está definido!');
        }
        
        // PONTE 2: Evento personalizado para ParticipantPreviewGrid
        console.log('📡 PONTE 2: Disparando evento participant-stream-connected');
        window.dispatchEvent(new CustomEvent('participant-stream-connected', {
          detail: { participantId, stream }
        }));
        
        // PONTE 3: Forçar atualização de estado via evento
        console.log('🔄 PONTE 3: Disparando força atualização de streams');
        window.dispatchEvent(new CustomEvent('force-stream-state-update', {
          detail: { 
            participantId, 
            stream,
            streamId: stream.id,
            timestamp: Date.now()
          }
        }));
        
        // PONTE 4: Evento específico para containers de vídeo
        console.log('📹 PONTE 4: Disparando evento stream-received para containers');
        window.dispatchEvent(new CustomEvent('stream-received', {
          detail: { participantId, stream }
        }));
        
        // PONTE 5: BroadcastChannel como último recurso
        try {
          const bc = new BroadcastChannel('webrtc-stream-bridge');
          bc.postMessage({ 
            action: 'stream-received',
            participantId, 
            streamId: stream.id,
            timestamp: Date.now()
          });
          bc.close();
          console.log('📻 PONTE 5: BroadcastChannel enviado');
        } catch (e) {
          console.warn('⚠️ PONTE 5: BroadcastChannel failed:', e);
        }
        
      } else {
        console.warn('⚠️ WEBRTC→REACT BRIDGE: ontrack sem streams válidos');
      }
    };

    // Perfect Negotiation: Define polite/impolite roles based on participant IDs
    const isPolite = participantId < (this.currentParticipantId || '');
    console.log(`🤝 PERFECT NEGOTIATION: Role for ${participantId}: ${isPolite ? 'polite' : 'impolite'}`);

    // Perfect Negotiation: Handle negotiation needed with glare protection
    peerConnection.onnegotiationneeded = async () => {
      console.log(`🔄 PERFECT NEGOTIATION: Negotiation needed for ${participantId}`);
      try {
        if (!isPolite && peerConnection.signalingState !== 'stable') {
          console.log(`⚠️ PERFECT NEGOTIATION: Impolite peer ignoring negotiation (not stable) for ${participantId}`);
          return;
        }
        await this.initiateCall(participantId);
      } catch (error) {
        console.error(`❌ PERFECT NEGOTIATION: Error in negotiation for ${participantId}:`, error);
      }
    };

    // ADICIONAR TRANSCEIVERS: Uso moderno com controle explícito
    const localStream = this.getLocalStream();
    console.log(`📤 WEBRTC TRANSCEIVERS: ===== ADICIONANDO TRANSCEIVERS =====`);
    console.log(`📤 WEBRTC TRANSCEIVERS: Participante: ${participantId}`);
    console.log(`📤 WEBRTC TRANSCEIVERS: LocalStream disponível: ${!!localStream}`);
    
    if (localStream) {
      console.log(`📤 WEBRTC TRANSCEIVERS: Detalhes do LocalStream:`, {
        streamId: localStream.id,
        active: localStream.active,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length,
        totalTracks: localStream.getTracks().length
      });
      
      // Adicionar transceivers primeiro para controle completo do SDP
      localStream.getTracks().forEach((track, index) => {
        console.log(`📹 WEBRTC TRANSCEIVERS: Processando track ${index}:`, {
          kind: track.kind,
          id: track.id,
          label: track.label,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        });

        try {
          // 1. Adicionar transceiver com direção explícita
          const transceiver = peerConnection.addTransceiver(track.kind, {
            direction: 'sendrecv'
          });
          
          console.log(`✅ WEBRTC TRANSCEIVERS: Transceiver ${track.kind} criado:`, {
            direction: transceiver.direction,
            mid: transceiver.mid
          });

          // 2. Adicionar track ao transceiver
          peerConnection.addTrack(track, localStream);
          
          console.log(`✅ WEBRTC TRANSCEIVERS: Track ${track.kind} adicionada ao transceiver`);
          
        } catch (error) {
          console.error(`❌ WEBRTC TRANSCEIVERS: Erro ao adicionar transceiver/track ${track.kind}:`, error);
        }
      });
      
      // Log estado final dos transceivers
      const finalTransceivers = peerConnection.getTransceivers();
      console.log(`📊 WEBRTC TRANSCEIVERS: Estado final - ${finalTransceivers.length} transceivers criados:`);
      finalTransceivers.forEach((transceiver, index) => {
        console.log(`🎯 WEBRTC TRANSCEIVERS: Transceiver ${index}:`, {
          direction: transceiver.direction,
          kind: transceiver.receiver?.track?.kind || 'unknown',
          currentDirection: transceiver.currentDirection,
          mid: transceiver.mid
        });
      });
      
    } else {
      console.warn(`⚠️ WEBRTC TRANSCEIVERS: LocalStream NÃO DISPONÍVEL para: ${participantId}`);
      console.warn(`⚠️ WEBRTC TRANSCEIVERS: getLocalStream retornou:`, localStream);
    }

    return peerConnection;
  }

  async initiateCallWithRetry(participantId: string, maxRetries: number = 1): Promise<void> {
    const currentRetries = this.retryAttempts.get(participantId) || 0;

    if (currentRetries >= maxRetries) {
      console.error(`❌ Max retry attempts (${maxRetries}) reached for: ${participantId}`);
      return;
    }

    this.retryAttempts.set(participantId, currentRetries + 1);
    console.log(`🔄 Initiating call attempt ${currentRetries + 1}/${maxRetries} to: ${participantId}`);

    // FASE 2: Verificar se já existe um timeout pendente
    this.clearOfferTimeout(participantId);

    try {
      await this.initiateCall(participantId);
      
      // FASE 2: Timeout para verificar se a conexão foi estabelecida
      const timeout = setTimeout(() => {
        const pc = this.peerConnections.get(participantId);
        if (pc && (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting')) {
          console.warn(`⏱️ Offer timeout for ${participantId} - connection state: ${pc.connectionState}`);
          
          if (currentRetries + 1 < maxRetries) {
            console.log(`🔄 Auto-retrying call to ${participantId} after timeout`);
            this.initiateCallWithRetry(participantId, maxRetries);
          }
        }
      }, 10000); // 10 segundos para timeout da oferta
      
      this.offerTimeouts.set(participantId, timeout);
      
    } catch (error) {
      console.error(`❌ Call initiation failed for ${participantId} (attempt ${currentRetries + 1}):`, error);

      if (currentRetries + 1 < maxRetries) {
        const retryDelay = Math.min(2000 * Math.pow(2, currentRetries), 10000);
        console.log(`🔄 Retrying call to ${participantId} in ${retryDelay/1000} seconds...`);
        
        setTimeout(() => {
          this.initiateCallWithRetry(participantId, maxRetries);
        }, retryDelay);
      } else {
        console.error(`❌ Failed to establish WebRTC connection with ${participantId} after ${maxRetries} attempts`);
      }
    }
  }

  private clearOfferTimeout(participantId: string): void {
    const existingTimeout = this.offerTimeouts.get(participantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.offerTimeouts.delete(participantId);
      console.log(`🧹 Cleared offer timeout for: ${participantId}`);
    }
  }

  async initiateCall(participantId: string): Promise<void> {
    console.log(`📞 WEBRTC TIMING: ===== INICIANDO CALL =====`);
    console.log(`📞 WEBRTC TIMING: Participante: ${participantId}`);

    // CORREÇÃO FASE 2: Usar conexão existente SEM recriar
    let peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(participantId);
    }

    // CORREÇÃO FASE 1: Validar que tracks já foram adicionadas em createPeerConnection
    const existingSenders = peerConnection.getSenders();
    const hasVideoTrack = existingSenders.some(s => s.track?.kind === 'video');
    const hasAudioTrack = existingSenders.some(s => s.track?.kind === 'audio');
    
    console.log(`🎯 WEBRTC TIMING: Transceivers antes da oferta:`, {
      totalSenders: existingSenders.length,
      hasVideo: hasVideoTrack,
      hasAudio: hasAudioTrack,
      transceivers: peerConnection.getTransceivers().length
    });

    // CORREÇÃO FASE 2: ELIMINAR duplicação de addTrack - tracks já foram adicionadas em createPeerConnection
    // REMOVIDO: Todo o código duplicado de validação e adição de tracks
    
    if (existingSenders.length === 0) {
      console.error(`❌ WEBRTC TIMING: Nenhuma track adicionada antes da oferta para: ${participantId}`);
      throw new Error(`Tracks não foram adicionadas antes da oferta para ${participantId}`);
    }

    // CORREÇÃO FASE 2: Delay aumentado para 1000ms para estabilização mobile
    console.log(`⏱️ WEBRTC TIMING: Aguardando 1000ms para estabilização antes da oferta...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // CORREÇÃO FASE 1+3: Criar oferta com transceivers estabelecidos
    try {
      console.log(`📋 WEBRTC TIMING: Criando oferta para: ${participantId} com ${peerConnection.getSenders().length} senders`);
      
      // FASE 3: Log detalhado dos transceivers antes da oferta
      const transceivers = peerConnection.getTransceivers();
      console.log(`🎯 WEBRTC TIMING: Estado dos transceivers:`, transceivers.map(t => ({
        direction: t.direction,
        kind: t.receiver?.track?.kind || 'unknown',
        senderTrack: !!t.sender?.track,
        currentDirection: t.currentDirection
      })));

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // CORREÇÃO FASE 1: Log detalhado do SDP da oferta
      console.log(`📝 WEBRTC TIMING: Offer SDP:\n`, offer.sdp);
      
      // FASE 1: Verificar presença de m=video no SDP
      const hasVideoInSDP = offer.sdp?.includes('m=video') || false;
      const hasAudioInSDP = offer.sdp?.includes('m=audio') || false;
      console.log(`🎥 WEBRTC TIMING: SDP contém m=video: ${hasVideoInSDP}, m=audio: ${hasAudioInSDP}`);
      
      if (!hasVideoInSDP && !hasAudioInSDP) {
        console.error(`❌ WEBRTC TIMING: SDP não contém seções de mídia válidas!`);
        throw new Error(`SDP inválido gerado para ${participantId}`);
      }
      
      await peerConnection.setLocalDescription(offer);
      
      // FASE 4: Configurar timeout para detectar ontrack
      const ontrackTimeout = setTimeout(() => {
        console.warn(`⏰ WEBRTC TIMING: ontrack timeout para ${participantId} - forçando renegociação`);
        window.dispatchEvent(new CustomEvent('ontrack-timeout', {
          detail: { participantId, timestamp: Date.now() }
        }));
      }, 10000); // 10s timeout para ontrack
      
      // FASE 3: Melhorar ontrack sem sobrescrever - encadear callbacks
      let ontrackReceived = false;
      const originalOntrack = peerConnection.ontrack;
      const enhancedOntrack = (event: RTCTrackEvent) => {
        if (!ontrackReceived) {
          ontrackReceived = true;
          clearTimeout(ontrackTimeout);
          console.log(`✅ WEBRTC TIMING: ontrack recebido dentro do prazo para ${participantId}`);
          
          // FASE 5: Log estado final dos transceivers após conexão estável
          if (peerConnection.signalingState === 'stable') {
            const finalTransceivers = peerConnection.getTransceivers();
            console.log(`🎯 WEBRTC FINAL: Transceivers finais para ${participantId}:`);
            finalTransceivers.forEach((transceiver, index) => {
              console.log(`🎯 WEBRTC FINAL: Transceiver ${index} currentDirection:`, transceiver.currentDirection);
            });
          }
        }
        
        // Encadear callback original se existir
        if (originalOntrack) {
          originalOntrack.call(peerConnection, event);
        }
      };
      
      // Substituir ontrack preservando encadeamento
      peerConnection.ontrack = enhancedOntrack;
      
      console.log(`📤 WEBRTC TIMING: Enviando oferta para: ${participantId}`);
      unifiedWebSocketService.sendOffer(participantId, offer);
      
      console.log(`✅ WEBRTC TIMING: Oferta enviada com sucesso para: ${participantId}`);
    } catch (error) {
      console.error(`❌ WEBRTC TIMING: Falha ao criar/enviar oferta para: ${participantId}`, error);
      throw error;
    }
  }

  async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 Handling offer from: ${participantId}`);

    const peerConnection = this.createPeerConnection(participantId);
    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    unifiedWebSocketService.sendAnswer(participantId, answer);
    console.log(`📤 Answer sent to: ${participantId}`);
  }

  async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 Handling answer from: ${participantId}`);

    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
      console.log(`✅ Remote description set for: ${participantId}`);
    } else {
      console.warn(`⚠️ No peer connection found for answer from: ${participantId}`);
    }
  }

  async handleIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log(`✅ ICE candidate added for: ${participantId}`);
      } catch (error) {
        console.error(`❌ Failed to add ICE candidate for: ${participantId}`, error);
      }
    } else {
      console.warn(`⚠️ No peer connection found for ICE candidate from: ${participantId}`);
    }
  }

  handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);
    
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    this.clearOfferTimeout(participantId);
    this.clearHeartbeat(participantId);
    
    // Retry connection after delay
    setTimeout(() => {
      console.log(`🔄 Retrying connection to: ${participantId}`);
      this.initiateCallWithRetry(participantId);
    }, 5000);
  }

  startHeartbeat(participantId: string): void {
    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat for: ${participantId} - connection healthy`);
      } else {
        console.warn(`💔 Heartbeat failed for: ${participantId}`);
        this.clearHeartbeat(participantId);
        this.handleConnectionFailure(participantId);
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.set(participantId, interval);
  }

  clearHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`🧹 Cleared heartbeat for: ${participantId}`);
    }
  }

  hasActiveStream(participantId: string): boolean {
    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) return false;
    
    const receivers = peerConnection.getReceivers();
    return receivers.some(receiver => receiver.track && receiver.track.readyState === 'live');
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ConnectionHandler');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`🧹 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();
    
    // Clear all retry attempts
    this.retryAttempts.clear();
    
    // Clear all offer timeouts
    this.offerTimeouts.forEach((timeout, participantId) => {
      clearTimeout(timeout);
      console.log(`🧹 Cleared offer timeout for: ${participantId}`);
    });
    this.offerTimeouts.clear();
  }
}