
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
      console.log(`🔗 WEBRTC CONNECTION: ${participantId} state changed to: ${peerConnection.connectionState}`);

      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ WEBRTC SUCCESS: Peer connection established with: ${participantId}`);
        // FASE 2: Limpar timeout de oferta ao conectar com sucesso
        this.clearOfferTimeout(participantId);
        
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ WEBRTC FAILED: Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.connectionState === 'connecting') {
        console.log(`🔄 WEBRTC CONNECTING: Establishing connection with: ${participantId}`);
      } else if (peerConnection.connectionState === 'new') {
        console.log(`🆕 WEBRTC NEW: New connection created for: ${participantId}`);
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

    peerConnection.ontrack = (event) => {
      console.log(`🎥 MOBILE-CRITICAL: Track received from ${participantId}:`, {
        kind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamIds: event.streams.map(s => s.id),
        readyState: event.track.readyState,
        enabled: event.track.enabled
      });

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 MOBILE-CRITICAL: Processing stream from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        const triggerCallback = () => {
          if (this.streamCallback) {
            console.log(`🚀 MOBILE-IMMEDIATE: Triggering stream callback for ${participantId}`);
            try {
              this.streamCallback(participantId, stream);
            } catch (error) {
              console.error(`❌ Stream callback error for ${participantId}:`, error);
              setTimeout(() => {
                if (this.streamCallback) {
                  this.streamCallback(participantId, stream);
                }
              }, 50);
            }
          } else {
            console.error(`❌ MOBILE-CRITICAL: No stream callback set for ${participantId}`);
          }
        };

        triggerCallback();
        setTimeout(() => triggerCallback(), 100);
        setTimeout(() => triggerCallback(), 500);

      } else {
        console.warn(`⚠️ MOBILE: Track received from ${participantId} but no streams attached`);
        if (event.track) {
          const syntheticStream = new MediaStream([event.track]);
          console.log(`🔧 MOBILE-FIX: Created synthetic stream for ${participantId}`);
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

  async initiateCallWithRetry(participantId: string, maxRetries: number = 3): Promise<void> {
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
    console.log(`📞 Initiating call to: ${participantId}`);

    // FASE 3: Verificar se a conexão peer existe e está em bom estado
    const peerConnection = this.createPeerConnection(participantId);

    try {
      // FASE 3: Melhorar criação de oferta com mais logs
      console.log(`📝 Creating offer for: ${participantId}`);
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      console.log(`📝 Setting local description for: ${participantId}`);
      await peerConnection.setLocalDescription(offer);
      console.log(`📤 Sending offer to: ${participantId}`, {
        sdpType: offer.type,
        sdpLength: offer.sdp.length,
        hasVideo: offer.sdp.includes('m=video'),
        hasAudio: offer.sdp.includes('m=audio')
      });

      unifiedWebSocketService.sendOffer(participantId, offer);
      console.log(`✅ Offer sent successfully to: ${participantId}`);
    } catch (error) {
      console.error(`❌ Failed to create/send offer to ${participantId}:`, error);
      throw error;
    }
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);

    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      console.log(`🔌 Closing failed connection for: ${participantId}`);
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }

    this.clearHeartbeat(participantId);
    this.clearOfferTimeout(participantId);

    // FASE 3: Delay maior antes de tentar novamente
    console.log(`⏱️ Scheduling recovery for ${participantId} in 3 seconds`);
    setTimeout(() => {
      this.initiateCallWithRetry(participantId);
    }, 3000);
  }

  startHeartbeat(participantId: string): void {
    console.log(`💓 Starting heartbeat for: ${participantId}`);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const heartbeatInterval = isMobile ? 5000 : 30000;

    console.log(`💓 MOBILE-OPTIMIZED: Using ${heartbeatInterval}ms heartbeat for ${participantId} (${isMobile ? 'Mobile' : 'Desktop'})`);

    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat sent to: ${participantId}`);

        if (isMobile) {
          console.log(`📱 MOBILE HEARTBEAT: ICE state: ${peerConnection.iceConnectionState}`);
          if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
            console.warn(`⚠️ MOBILE HEARTBEAT: Unstable ICE connection for ${participantId}`);
            this.handleConnectionFailure(participantId);
          }
        }
      } else {
        console.log(`💔 No active connection for heartbeat: ${participantId}`);
        this.clearHeartbeat(participantId);
      }
    }, heartbeatInterval);

    this.heartbeatIntervals.set(participantId, interval);
  }

  clearHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`💔 Heartbeat cleared for: ${participantId}`);
    }
  }

  clearRetries(participantId: string): void {
    this.retryAttempts.delete(participantId);
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ConnectionHandler');

    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();

    this.retryAttempts.clear();
  }
}
