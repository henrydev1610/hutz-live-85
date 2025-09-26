// FASE 2: Implementação de negociação "Polite Peer" para WebRTC estável

export interface PoliteWebRTCConfig {
  isPolite: boolean;
  participantId: string;
  onStreamReceived: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onOffer: (offer: RTCSessionDescriptionInit) => void;
  onAnswer: (answer: RTCSessionDescriptionInit) => void;
}

export class PoliteWebRTCHandler {
  private peerConnection: RTCPeerConnection;
  private isPolite: boolean;
  private participantId: string;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private config: PoliteWebRTCConfig;

  // FASE 2: Transceivers pré-alocados (fixed)
  private videoTransceiver: RTCRtpTransceiver | null = null;

  constructor(rtcConfig: RTCConfiguration, politeConfig: PoliteWebRTCConfig) {
    this.peerConnection = new RTCPeerConnection(rtcConfig);
    this.isPolite = politeConfig.isPolite;
    this.participantId = politeConfig.participantId;
    this.config = politeConfig;
    
    this.setupEventHandlers();
    this.preallocateTransceivers();
  }

  private preallocateTransceivers() {
    // FASE 2: Pré-alocar transceiver de vídeo com direção baseada no tipo
    if (this.isPolite) {
      // Host: recvonly
      this.videoTransceiver = this.peerConnection.addTransceiver('video', {
        direction: 'recvonly'
      });
      console.log(`📡 POLITE: Host transceiver criado (recvonly) para ${this.participantId}`);
    } else {
      // Participante: sendonly
      this.videoTransceiver = this.peerConnection.addTransceiver('video', {
        direction: 'sendonly'
      });
      console.log(`📡 POLITE: Participante transceiver criado (sendonly) para ${this.participantId}`);
    }
  }

  private setupEventHandlers() {
    // FASE 2: Ontrack com transceiver dedicado
    this.peerConnection.ontrack = (event) => {
      console.log(`🎥 POLITE: ontrack received para ${this.participantId}`);
      const [stream] = event.streams;
      if (stream) {
        this.config.onStreamReceived(stream);
      }
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onIceCandidate(event.candidate);
      }
    };

    // Negotiation needed - "polite peer" pattern
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        console.log(`🤝 POLITE: Negotiation needed para ${this.participantId}, polite: ${this.isPolite}`);
        this.makingOffer = true;
        await this.peerConnection.setLocalDescription();
        
        if (this.peerConnection.localDescription) {
          this.config.onOffer(this.peerConnection.localDescription);
        }
      } catch (err) {
        console.error(`❌ POLITE: Erro na negociação para ${this.participantId}:`, err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 POLITE: Connection state ${this.participantId}: ${this.peerConnection.connectionState}`);
    };
  }

  // FASE 2: Adicionar stream usando replaceTrack ao invés de addTrack
  async addStream(stream: MediaStream): Promise<void> {
    if (!this.videoTransceiver) {
      console.error(`❌ POLITE: Nenhum transceiver disponível para ${this.participantId}`);
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && this.videoTransceiver.sender) {
      try {
        await this.videoTransceiver.sender.replaceTrack(videoTrack);
        console.log(`✅ POLITE: Video track replaced para ${this.participantId}`);
      } catch (error) {
        console.error(`❌ POLITE: Erro ao replace track para ${this.participantId}:`, error);
      }
    }
  }

  // FASE 2: Substituir track (para troca de câmera)
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (this.videoTransceiver?.sender) {
      await this.videoTransceiver.sender.replaceTrack(newTrack);
      console.log(`🔄 POLITE: Video track substituído para ${this.participantId}`);
    }
  }

  // FASE 2: Processar ofertas com "polite peer" logic
  async processOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    const offerCollision = this.makingOffer || this.peerConnection.signalingState !== 'stable';
    
    this.ignoreOffer = !this.isPolite && offerCollision;
    if (this.ignoreOffer) {
      console.log(`🚫 POLITE: Ignorando offer colidente para ${this.participantId} (impolite)`);
      return;
    }

    this.isSettingRemoteAnswerPending = true;
    await this.peerConnection.setRemoteDescription(offer);
    this.isSettingRemoteAnswerPending = false;

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.config.onAnswer(answer);
    console.log(`✅ POLITE: Answer criado para ${this.participantId}`);
  }

  // FASE 2: Processar answers
  async processAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.isSettingRemoteAnswerPending) return;
    
    await this.peerConnection.setRemoteDescription(answer);
    console.log(`✅ POLITE: Answer processado para ${this.participantId}`);
  }

  // FASE 2: Adicionar ICE candidates
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log(`✅ POLITE: ICE candidate adicionado para ${this.participantId}`);
    } catch (error) {
      if (!this.ignoreOffer) {
        console.error(`❌ POLITE: Erro ao adicionar ICE candidate:`, error);
      }
    }
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState;
  }

  close(): void {
    this.peerConnection.close();
  }

  // FASE 5: Diagnóstico objetivo
  getVideoMetrics(): { width: number; height: number; receiving: boolean } {
    if (!this.videoTransceiver?.receiver?.track) {
      return { width: 0, height: 0, receiving: false };
    }

    const track = this.videoTransceiver.receiver.track;
    const settings = track.getSettings();
    
    return {
      width: settings.width || 0,
      height: settings.height || 0,
      receiving: track.readyState === 'live'
    };
  }
}