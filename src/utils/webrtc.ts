
import signalingService from '@/services/WebSocketSignalingService';

interface WebRTCConfig {
  onTrack?: (participantId: string, track: MediaStreamTrack) => void;
  onConnectionStateChange?: (participantId: string, state: RTCPeerConnectionState) => void;
}

class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private config: WebRTCConfig = {};
  private isHost: boolean = false;

  constructor() {
    this.setupSignalingListeners();
  }

  private setupSignalingListeners() {
    signalingService.setCallbacks({
      onOffer: async (data) => {
        await this.handleOffer(data.fromSocketId, data.offer);
      },
      onAnswer: async (data) => {
        await this.handleAnswer(data.fromSocketId, data.answer);
      },
      onIceCandidate: (data) => {
        this.handleIceCandidate(data.fromSocketId, data.candidate);
      },
      onUserConnected: (data) => {
        console.log('New user connected, creating peer connection:', data.userId);
        if (this.isHost) {
          // Como host, criar offer para novo participante
          setTimeout(() => {
            this.createOffer(data.socketId);
          }, 1000);
        }
      },
      onUserDisconnected: (data) => {
        console.log('User disconnected, cleaning up peer connection:', data.userId);
        this.removePeerConnection(data.socketId);
      }
    });
  }

  async initializeHost(sessionId: string, config: WebRTCConfig) {
    this.isHost = true;
    this.config = config;
    
    console.log('Initializing WebRTC as host for session:', sessionId);
    
    try {
      // Conectar ao serviço de sinalização
      await signalingService.joinRoom(sessionId, `host-${Date.now()}`);
      
      console.log('✅ Host connected to signaling server');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize host WebRTC:', error);
      throw error;
    }
  }

  async initializeParticipant(sessionId: string, config: WebRTCConfig) {
    this.isHost = false;
    this.config = config;
    
    console.log('Initializing WebRTC as participant for session:', sessionId);
    
    try {
      // Obter mídia do usuário
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Local media obtained');

      // Conectar ao serviço de sinalização
      const participantId = `participant-${Date.now()}`;
      await signalingService.joinRoom(sessionId, participantId);
      
      console.log('✅ Participant connected to signaling server');
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to initialize participant WebRTC:', error);
      throw error;
    }
  }

  private async createOffer(targetSocketId: string) {
    try {
      const peerConnection = this.getOrCreatePeerConnection(targetSocketId);
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);
      
      console.log('📤 Sending offer to:', targetSocketId);
      signalingService.sendOffer(offer, targetSocketId);
      
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  private async handleOffer(fromSocketId: string, offer: RTCSessionDescriptionInit) {
    try {
      console.log('📥 Handling offer from:', fromSocketId);
      
      const peerConnection = this.getOrCreatePeerConnection(fromSocketId);
      
      await peerConnection.setRemoteDescription(offer);
      
      // Adicionar stream local se disponível
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      console.log('📤 Sending answer to:', fromSocketId);
      signalingService.sendAnswer(answer, fromSocketId);
      
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(fromSocketId: string, answer: RTCSessionDescriptionInit) {
    try {
      console.log('📥 Handling answer from:', fromSocketId);
      
      const peerConnection = this.peerConnections.get(fromSocketId);
      if (!peerConnection) {
        console.warn('No peer connection found for answer from:', fromSocketId);
        return;
      }
      
      await peerConnection.setRemoteDescription(answer);
      console.log('✅ Answer processed successfully');
      
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  private handleIceCandidate(fromSocketId: string, candidate: RTCIceCandidateInit) {
    try {
      const peerConnection = this.peerConnections.get(fromSocketId);
      if (!peerConnection) {
        console.warn('No peer connection found for ICE candidate from:', fromSocketId);
        return;
      }
      
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private getOrCreatePeerConnection(socketId: string): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) {
      return this.peerConnections.get(socketId)!;
    }

    const iceServers = signalingService.getIceServers();
    console.log('Creating peer connection with ICE servers:', iceServers);

    const peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
    });

    // Event listeners
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingService.sendIceCandidate(event.candidate.toJSON(), socketId);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('🎥 Received track from:', socketId);
      const [remoteStream] = event.streams;
      if (remoteStream && remoteStream.getTracks().length > 0) {
        const track = event.track;
        this.config.onTrack?.(socketId, track);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${socketId}:`, peerConnection.connectionState);
      this.config.onConnectionStateChange?.(socketId, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        console.warn(`Connection failed for ${socketId}, attempting to restart ICE`);
        peerConnection.restartIce();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${socketId}:`, peerConnection.iceConnectionState);
    };

    this.peerConnections.set(socketId, peerConnection);
    return peerConnection;
  }

  private removePeerConnection(socketId: string) {
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
      console.log('🗑️ Peer connection removed for:', socketId);
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  cleanup() {
    console.log('🧹 Cleaning up WebRTC manager');
    
    // Fechar todas as conexões peer
    this.peerConnections.forEach((pc, socketId) => {
      pc.close();
      console.log('Closed peer connection for:', socketId);
    });
    this.peerConnections.clear();

    // Parar stream local
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    // Desconectar do serviço de sinalização
    signalingService.leaveRoom();
  }
}

// Instâncias globais
let hostWebRTC: WebRTCManager | null = null;
let participantWebRTC: WebRTCManager | null = null;

export const initHostWebRTC = async (sessionId: string, onParticipantTrack: (participantId: string, track: MediaStreamTrack) => void) => {
  if (hostWebRTC) {
    hostWebRTC.cleanup();
  }
  
  hostWebRTC = new WebRTCManager();
  
  try {
    await hostWebRTC.initializeHost(sessionId, {
      onTrack: onParticipantTrack,
      onConnectionStateChange: (participantId, state) => {
        console.log(`Host: Participant ${participantId} connection state:`, state);
      }
    });
    
    return hostWebRTC;
  } catch (error) {
    console.error('Failed to initialize host WebRTC:', error);
    throw error;
  }
};

export const initParticipantWebRTC = async (sessionId: string) => {
  if (participantWebRTC) {
    participantWebRTC.cleanup();
  }
  
  participantWebRTC = new WebRTCManager();
  
  try {
    const localStream = await participantWebRTC.initializeParticipant(sessionId, {
      onConnectionStateChange: (hostId, state) => {
        console.log(`Participant: Host ${hostId} connection state:`, state);
      }
    });
    
    return { webrtc: participantWebRTC, localStream };
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    throw error;
  }
};

export const setOnParticipantTrack = (callback: (participantId: string, track: MediaStreamTrack) => void) => {
  // Esta função é mantida para compatibilidade com o código existente
  console.log('setOnParticipantTrack callback set');
};

export const cleanupWebRTC = () => {
  if (hostWebRTC) {
    hostWebRTC.cleanup();
    hostWebRTC = null;
  }
  
  if (participantWebRTC) {
    participantWebRTC.cleanup();
    participantWebRTC = null;
  }
};
