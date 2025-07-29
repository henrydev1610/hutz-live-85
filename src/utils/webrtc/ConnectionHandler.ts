import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private offerTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
    console.log('📞 ConnectionHandler: Stream callback set');
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
    console.log('👤 ConnectionHandler: Participant join callback set');
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
    console.log(`🔗 Creating peer connection for: ${participantId}`);

    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      const existingPC = this.peerConnections.get(participantId)!;
      
      // FASE 2: Verificar se a conexão existente está em bom estado
      if (existingPC.connectionState === 'connected' || 
          existingPC.connectionState === 'connecting') {
        console.log(`♻️ Reusing existing peer connection for: ${participantId} in state: ${existingPC.connectionState}`);
        return existingPC;
      } else {
        console.log(`🔄 Replacing stale peer connection for: ${participantId} in state: ${existingPC.connectionState}`);
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
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to: ${participantId}`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port
        });
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
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

    // FASE 5: Enhanced track handling with retry and timeout
    peerConnection.ontrack = (event) => {
      console.log('🎵 CRÍTICO: Track received from participant:', participantId);
      
      const remoteStream = event.streams[0];
      if (remoteStream) {
        console.log('📺 CRÍTICO: Remote stream received:', {
          streamId: remoteStream.id,
          tracks: remoteStream.getTracks().length,
          participantId,
          active: remoteStream.active
        });
        
        // CORREÇÃO CRÍTICA: Disparar callback imediatamente
        if (this.streamCallback) {
          console.log('📞 CRÍTICO: Disparando stream callback');
          this.streamCallback(participantId, remoteStream);
        }
        
        // CORREÇÃO: Atualização única do grid
        window.dispatchEvent(new CustomEvent('participant-stream-received', {
          detail: { participantId, stream: remoteStream }
        }));
      } else {
        console.warn('⚠️ CRÍTICO: ontrack disparado mas sem stream válido');
      }

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 STREAM-CRÍTICO: Processando stream de ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        // VISUAL LOG: Toast quando stream é processado
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('stream-processed', {
            detail: { 
              participantId, 
              streamId: stream.id,
              trackCount: stream.getTracks().length
            }
          }));
        }

        const triggerCallback = () => {
          if (this.streamCallback) {
            console.log(`🚀 CALLBACK-CRÍTICO: Disparando callback de stream para ${participantId}`);
            try {
              this.streamCallback(participantId, stream);
              
              // VISUAL LOG: Toast quando callback é executado
              if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('stream-callback-executed', {
                  detail: { participantId, success: true }
                }));
              }
            } catch (error) {
              console.error(`❌ CALLBACK-CRÍTICO: Erro no callback para ${participantId}:`, error);
              
              // VISUAL LOG: Toast quando callback falha
              if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('stream-callback-error', {
                  detail: { participantId, error: error.message }
                }));
              }
              
              // Retry callback
              setTimeout(() => {
                if (this.streamCallback) {
                  this.streamCallback(participantId, stream);
                }
              }, 50);
            }
          } else {
            console.error(`❌ CALLBACK-CRÍTICO: Nenhum callback definido para ${participantId}`);
          }
        };

        // CORREÇÃO: Disparo único para evitar spam
        triggerCallback();

      } else {
        console.warn(`⚠️ TRACK-CRÍTICO: Track de ${participantId} sem streams anexados`);
        if (event.track) {
          const syntheticStream = new MediaStream([event.track]);
          console.log(`🔧 STREAM-CRÍTICO: Stream sintético criado para ${participantId}`);
          if (this.streamCallback) {
            this.streamCallback(participantId, syntheticStream);
          }
        }
      }
    };

    // FASE 3: Adicionar os tracks de forma mais robusta
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 Preparing to push local tracks to: ${participantId}`, {
        streamId: localStream.id,
        active: localStream.active,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      // Limpar senders existentes se necessário
      const senders = peerConnection.getSenders();
      if (senders.length > 0) {
        console.log(`🧹 Cleaning up ${senders.length} existing senders before adding tracks`);
      }

      localStream.getTracks().forEach(newTrack => {
        const existingSender = senders.find(s => s.track?.kind === newTrack.kind);
        if (existingSender) {
          console.log(`🔁 Replacing ${newTrack.kind} track for: ${participantId}`);
          existingSender.replaceTrack(newTrack).catch(err =>
            console.error(`❌ Failed to replace ${newTrack.kind} track for ${participantId}:`, err)
          );
        } else {
          console.log(`➕ Adding new ${newTrack.kind} track to: ${participantId}`);
          try {
            peerConnection.addTrack(newTrack, localStream);
          } catch (error) {
            console.error(`❌ Failed to add ${newTrack.kind} track:`, error);
          }
        }
      });
    } else {
      console.warn(`⚠️ No local stream available when creating connection for ${participantId}`);
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
    console.log(`📞 CRÍTICO: Iniciando chamada para: ${participantId}`);

    // CRÍTICO: Usar conexão existente ou criar nova
    const peerConnection = this.createPeerConnection(participantId);

    // CORREÇÃO CRÍTICA: Verificar stream ANTES de criar oferta
    const localStream = this.getLocalStream?.();
    if (!localStream) {
      console.error(`❌ CRÍTICO: LocalStream não disponível para: ${participantId}`);
      // VISUAL LOG: Toast para stream não encontrado
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('stream-missing-error', {
          detail: { participantId, error: 'LocalStream não encontrado' }
        }));
      }
      throw new Error(`LocalStream não disponível para ${participantId}`);
    }

    console.log(`🎥 CRÍTICO: Verificando e adicionando tracks para: ${participantId}`, {
      streamId: localStream.id,
      active: localStream.active,
      videoTracks: localStream.getVideoTracks().length,
      audioTracks: localStream.getAudioTracks().length,
      totalTracks: localStream.getTracks().length
    });
    
    // Verificar se tracks já foram adicionados
    const existingSenders = peerConnection.getSenders();
    const existingTrackKinds = existingSenders.map(s => s.track?.kind).filter(Boolean);
    
    console.log(`🔍 CRÍTICO: Senders existentes: ${existingSenders.length}, Tracks: [${existingTrackKinds.join(', ')}]`);
    
    // CORREÇÃO: Apenas adicionar tracks que não existem E são válidos
    let tracksAdded = 0;
    const validTracks = localStream.getTracks().filter(t => t.readyState === 'live');
    
    if (validTracks.length === 0) {
      console.error(`❌ CRÍTICO: Nenhuma track válida no stream para: ${participantId}`);
      throw new Error(`Stream sem tracks válidas para ${participantId}`);
    }
    
    for (const track of validTracks) {
      const hasExistingSender = existingSenders.some(s => s.track && s.track.kind === track.kind);
      
      if (!hasExistingSender) {
        try {
          peerConnection.addTrack(track, localStream);
          tracksAdded++;
          console.log(`📹 CRÍTICO: Track ${track.kind} adicionada para: ${participantId} (${track.readyState})`);
          
          // VISUAL LOG: Toast quando track é adicionado
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('track-added-to-pc', {
              detail: { participantId, trackKind: track.kind, trackId: track.id }
            }));
          }
        } catch (error) {
          console.error(`❌ Failed to add ${track.kind} track:`, error);
          
          // VISUAL LOG: Toast para erro ao adicionar track
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('track-add-error', {
              detail: { participantId, trackKind: track.kind, error: error.message }
            }));
          }
        }
      } else {
        console.log(`⚪ Track ${track.kind} já existe para: ${participantId}`);
      }
    }
    
    console.log(`📊 CRÍTICO: ${tracksAdded} tracks adicionadas de ${validTracks.length} válidas para: ${participantId}`);
    
    // VERIFICAÇÃO FINAL: Garantir que pelo menos uma track foi adicionada
    if (tracksAdded === 0 && existingSenders.length === 0) {
      console.error(`❌ CRÍTICO: Nenhuma track foi adicionada para: ${participantId}`);
      throw new Error(`Falha ao adicionar tracks para ${participantId}`);
    }

    // AGUARDAR para tracks serem estabilizadas
    console.log(`⏳ CRÍTICO: Aguardando estabilização das tracks para: ${participantId}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      console.log(`📋 CRÍTICO: Criando oferta para: ${participantId} com ${peerConnection.getSenders().length} senders`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log(`📝 CRÍTICO: Definindo descrição local para: ${participantId}`);
      await peerConnection.setLocalDescription(offer);
      
      // VISUAL LOG: Toast quando oferta é criada
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('offer-created', {
          detail: { 
            participantId, 
            offerType: offer.type,
            senderCount: peerConnection.getSenders().length 
          }
        }));
      }
      
      console.log(`📤 CRÍTICO: Enviando oferta para: ${participantId}`);
      unifiedWebSocketService.sendOffer(participantId, offer);
      
      console.log(`✅ CRÍTICO: Oferta enviada com sucesso para: ${participantId}`);
    } catch (error) {
      console.error(`❌ CRÍTICO: Falha ao criar/enviar oferta para: ${participantId}`, error);
      
      // VISUAL LOG: Toast para erro na oferta
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('offer-error', {
          detail: { participantId, error: error.message }
        }));
      }
      
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