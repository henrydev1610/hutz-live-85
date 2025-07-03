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
      await signalingService.joinRoom(sessionId, `host-${Date.now()}`);
      
      if (signalingService.isMockMode()) {
        console.log('✅ Host initialized in mock mode');
        // Simular alguns participantes mock para teste
        setTimeout(() => {
          this.simulateMockParticipants();
        }, 2000);
      } else {
        console.log('✅ Host connected to signaling server');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize host WebRTC:', error);
      throw error;
    }
  }

  private simulateMockParticipants() {
    if (!signalingService.isMockMode()) return;
    
    console.log('🔧 Simulating mock participants for testing');
    
    // Simular 2 participantes para teste
    const mockParticipants = [
      { userId: 'mock-participant-1', socketId: 'mock-socket-1' },
      { userId: 'mock-participant-2', socketId: 'mock-socket-2' }
    ];
    
    mockParticipants.forEach((participant, index) => {
      setTimeout(() => {
        console.log(`🔧 Adding mock participant: ${participant.userId}`);
        this.config.onConnectionStateChange?.(participant.socketId, 'connected');
        
        // Simular um track de vídeo mock
        this.simulateMockVideoTrack(participant.socketId);
      }, (index + 1) * 1000);
    });
  }

  private simulateMockVideoTrack(participantId: string) {
    if (!signalingService.isMockMode()) return;
    
    try {
      // Criar um canvas para simular vídeo
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Desenhar um placeholder colorido
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Mock Participant`, canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText(`${participantId}`, canvas.width / 2, canvas.height / 2 + 20);
        
        // Converter canvas para stream
        const stream = canvas.captureStream(30);
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack) {
          console.log(`🔧 Created mock video track for ${participantId}`);
          this.config.onTrack?.(participantId, videoTrack);
        }
      }
    } catch (error) {
      console.warn('Failed to create mock video track:', error);
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

      const participantId = `participant-${Date.now()}`;
      await signalingService.joinRoom(sessionId, participantId);
      
      if (signalingService.isMockMode()) {
        console.log('✅ Participant initialized in mock mode');
      } else {
        console.log('✅ Participant connected to signaling server');
      }
      
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
    
    this.peerConnections.forEach((pc, socketId) => {
      pc.close();
      console.log('Closed peer connection for:', socketId);
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

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
