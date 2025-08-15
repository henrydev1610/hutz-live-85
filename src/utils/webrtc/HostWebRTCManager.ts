// FASE 2: Sistema WebRTC Desktop Dedicado - Limpo e Funcional
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface PeerConnectionInfo {
  pc: RTCPeerConnection;
  participantId: string;
  createdAt: number;
  timeout?: NodeJS.Timeout;
}

interface IceCandidateBuffer {
  participantId: string;
  candidate: RTCIceCandidate;
  timestamp: number;
}

export class HostWebRTCManager {
  private static instance: HostWebRTCManager;
  private connections: Map<string, PeerConnectionInfo> = new Map();
  private iceCandidateBuffer: Map<string, IceCandidateBuffer[]> = new Map();
  private isInitialized: boolean = false;
  private sessionId: string | null = null;

  // FASE 2: Configuration - 10s timeout definitivo, zero retry
  private readonly CONNECTION_TIMEOUT = 10000; // 10s timeout definitivo
  private readonly ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  private constructor() {
    console.log('🖥️ HOST-WEBRTC: Manager criado');
  }

  static getInstance(): HostWebRTCManager {
    if (!HostWebRTCManager.instance) {
      HostWebRTCManager.instance = new HostWebRTCManager();
    }
    return HostWebRTCManager.instance;
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log('🖥️ HOST-WEBRTC: Inicializando como host para sessão:', sessionId);
    
    this.cleanup();
    this.sessionId = sessionId;

    try {
      // Connect to WebSocket first
      if (!unifiedWebSocketService.isConnected()) {
        await unifiedWebSocketService.connect();
      }
      
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      
      // Setup WebRTC message handlers
      this.setupWebSocketHandlers();
      
      this.isInitialized = true;
      console.log('✅ HOST-WEBRTC: Host inicializado com sucesso');
    } catch (error) {
      console.error('❌ HOST-WEBRTC: Falha na inicialização:', error);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    console.log('🔧 HOST-WEBRTC: Configurando handlers WebSocket');
    
    // FASE 2: Handlers únicos e diretos - sem camadas extras
    unifiedWebSocketService.on('webrtc-offer', this.handleOffer.bind(this));
    unifiedWebSocketService.on('webrtc-candidate', this.handleIceCandidate.bind(this));
    
    console.log('✅ HOST-WEBRTC: Handlers WebSocket configurados');
  }

  private async handleOffer(data: any): Promise<void> {
    const { participantId, offer } = data;
    console.log('📨 HOST-WEBRTC: Offer recebido de:', participantId);

    try {
      // Create or get peer connection
      const pcInfo = this.getOrCreatePeerConnection(participantId);
      const pc = pcInfo.pc;

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ HOST-WEBRTC: Remote description definida para:', participantId);

      // Apply buffered ICE candidates
      await this.applyBufferedIceCandidates(participantId, pc);

      // Create and set answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log('📤 HOST-WEBRTC: Enviando answer para:', participantId);
      
      // Send answer back
      unifiedWebSocketService.emit('webrtc-answer', {
        participantId: 'host',
        targetId: participantId,
        answer: pc.localDescription
      });

      console.log('✅ HOST-WEBRTC: Answer enviado para:', participantId);
    } catch (error) {
      console.error('❌ HOST-WEBRTC: Erro ao processar offer de:', participantId, error);
      this.cleanupConnection(participantId);
    }
  }

  private async handleIceCandidate(data: any): Promise<void> {
    const { participantId, candidate } = data;
    console.log('🧊 HOST-WEBRTC: ICE candidate recebido de:', participantId);

    if (!candidate) {
      console.log('🏁 HOST-WEBRTC: ICE gathering completo para:', participantId);
      return;
    }

    const pcInfo = this.connections.get(participantId);
    
    if (pcInfo && pcInfo.pc.remoteDescription) {
      try {
        await pcInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ HOST-WEBRTC: ICE candidate aplicado para:', participantId);
      } catch (error) {
        console.error('❌ HOST-WEBRTC: Erro ao aplicar ICE candidate:', error);
      }
    } else {
      // Buffer candidate for later application
      console.log('📦 HOST-WEBRTC: Bufferizando ICE candidate para:', participantId);
      
      if (!this.iceCandidateBuffer.has(participantId)) {
        this.iceCandidateBuffer.set(participantId, []);
      }
      
      this.iceCandidateBuffer.get(participantId)!.push({
        participantId,
        candidate: new RTCIceCandidate(candidate),
        timestamp: Date.now()
      });
    }
  }

  private getOrCreatePeerConnection(participantId: string): PeerConnectionInfo {
    const existing = this.connections.get(participantId);
    if (existing) {
      console.log('🔄 HOST-WEBRTC: Reusando conexão existente para:', participantId);
      return existing;
    }

    console.log('🆕 HOST-WEBRTC: Criando nova peer connection para:', participantId);

    const pc = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });
    
    // FASE 2: ontrack direto - sem camadas intermediárias
    pc.ontrack = (event) => {
      console.log('🎥 HOST-WEBRTC: ontrack disparado para:', participantId);
      
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('✅ HOST-WEBRTC: Stream recebido:', {
          participantId,
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // FASE 2: Disparo direto para DOM - sem layers
        window.dispatchEvent(new CustomEvent('video-stream-ready', {
          detail: {
            participantId,
            stream,
            timestamp: Date.now(),
            source: 'host-webrtc-manager'
          }
        }));

      } else {
        console.warn('⚠️ HOST-WEBRTC: ontrack sem streams para:', participantId);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 HOST-WEBRTC: Enviando ICE candidate para:', participantId);
        
        unifiedWebSocketService.emit('webrtc-candidate', {
          participantId: 'host',
          targetId: participantId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 HOST-WEBRTC: Connection state mudou:', participantId, '→', state);
      
      if (state === 'connected') {
        console.log('✅ HOST-WEBRTC: Conexão estabelecida com:', participantId);
        // Clear timeout on success
        const pcInfo = this.connections.get(participantId);
        if (pcInfo?.timeout) {
          clearTimeout(pcInfo.timeout);
          pcInfo.timeout = undefined;
        }
      } else if (state === 'failed' || state === 'disconnected') {
        console.log('❌ HOST-WEBRTC: Conexão falhou/desconectou:', participantId);
        this.cleanupConnection(participantId);
      }
    };

    // Add receive-only transceiver for video
    pc.addTransceiver('video', { direction: 'recvonly' });

    // FASE 2: Timeout definitivo de 10s - sem retry
    const timeout = setTimeout(() => {
      console.warn('⏰ HOST-WEBRTC: Timeout de conexão para:', participantId);
      this.cleanupConnection(participantId);
    }, this.CONNECTION_TIMEOUT);

    const pcInfo: PeerConnectionInfo = {
      pc,
      participantId,
      createdAt: Date.now(),
      timeout
    };

    this.connections.set(participantId, pcInfo);
    console.log('📊 HOST-WEBRTC: Total de conexões:', this.connections.size);

    return pcInfo;
  }

  private async applyBufferedIceCandidates(participantId: string, pc: RTCPeerConnection): Promise<void> {
    const bufferedCandidates = this.iceCandidateBuffer.get(participantId);
    
    if (!bufferedCandidates || bufferedCandidates.length === 0) {
      return;
    }

    console.log('📦 HOST-WEBRTC: Aplicando', bufferedCandidates.length, 'ICE candidates buffered para:', participantId);

    for (const { candidate } of bufferedCandidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ HOST-WEBRTC: Erro ao aplicar buffered ICE candidate:', error);
      }
    }

    // Clear buffer after applying
    this.iceCandidateBuffer.delete(participantId);
    console.log('✅ HOST-WEBRTC: Buffer de ICE candidates limpo para:', participantId);
  }

  private cleanupConnection(participantId: string): void {
    console.log('🧹 HOST-WEBRTC: Limpando conexão para:', participantId);
    
    const pcInfo = this.connections.get(participantId);
    if (pcInfo) {
      if (pcInfo.timeout) {
        clearTimeout(pcInfo.timeout);
      }
      
      try {
        pcInfo.pc.close();
      } catch (error) {
        console.error('❌ HOST-WEBRTC: Erro ao fechar PC:', error);
      }
      
      this.connections.delete(participantId);
    }

    // Clear ICE candidate buffer
    this.iceCandidateBuffer.delete(participantId);
    
    console.log('✅ HOST-WEBRTC: Conexão limpa para:', participantId, '| Total restantes:', this.connections.size);
  }

  cleanup(): void {
    console.log('🧹 HOST-WEBRTC: Limpeza completa do manager');
    
    // Cleanup all connections
    this.connections.forEach((pcInfo, participantId) => {
      this.cleanupConnection(participantId);
    });
    
    this.connections.clear();
    this.iceCandidateBuffer.clear();
    this.isInitialized = false;
    this.sessionId = null;
    
    console.log('✅ HOST-WEBRTC: Limpeza completa realizada');
  }

  getConnectionsState(): Record<string, string> {
    const state: Record<string, string> = {};
    
    this.connections.forEach((pcInfo, participantId) => {
      state[participantId] = pcInfo.pc.connectionState;
    });
    
    return state;
  }

  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const hostWebRTCManager = HostWebRTCManager.getInstance();