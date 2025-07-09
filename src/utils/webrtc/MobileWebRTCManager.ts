import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface MobileWebRTCConfig {
  iceServers: RTCIceServer[];
}

const MOBILE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

const MOBILE_PEER_CONFIG: RTCConfiguration = {
  iceServers: MOBILE_ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
};

export class MobileWebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private participantId: string | null = null;
  private onStreamCallback?: (participantId: string, stream: MediaStream) => void;

  constructor() {
    console.log('📱 MOBILE WebRTC Manager initialized');
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`📱 MOBILE WebRTC: Initializing as participant ${participantId} for session ${sessionId}`);
    
    this.sessionId = sessionId;
    this.participantId = participantId;
    this.localStream = stream || null;

    // Setup signaling callbacks
    unifiedWebSocketService.setCallbacks({
      onOffer: async (data) => {
        console.log('📱 MOBILE WebRTC: Received offer');
        await this.handleOffer(data);
      },
      onAnswer: async (data) => {
        console.log('📱 MOBILE WebRTC: Received answer');
        await this.handleAnswer(data);
      },
      onIceCandidate: async (data) => {
        console.log('📱 MOBILE WebRTC: Received ICE candidate');
        await this.handleIceCandidate(data);
      },
      onUserConnected: async (userId: string) => {
        console.log('📱 MOBILE WebRTC: User connected, creating peer connection');
        await this.createPeerConnection(userId);
      }
    });

    console.log('✅ MOBILE WebRTC: Participant initialized');
  }

  private async createPeerConnection(remoteParticipantId: string): Promise<RTCPeerConnection> {
    console.log(`📱 MOBILE WebRTC: Creating peer connection for ${remoteParticipantId}`);

    const peerConnection = new RTCPeerConnection(MOBILE_PEER_CONFIG);
    this.peerConnections.set(remoteParticipantId, peerConnection);

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
        console.log(`📱 MOBILE WebRTC: Added ${track.kind} track to peer connection`);
      });
    }

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log('📱 MOBILE WebRTC: Received remote stream');
      const [remoteStream] = event.streams;
      if (this.onStreamCallback) {
        this.onStreamCallback(remoteParticipantId, remoteStream);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📱 MOBILE WebRTC: Sending ICE candidate');
        unifiedWebSocketService.sendIceCandidate(remoteParticipantId, event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`📱 MOBILE WebRTC: Connection state: ${peerConnection.connectionState}`);
    };

    return peerConnection;
  }

  private async handleOffer(data: any): Promise<void> {
    const { fromUserId, offer } = data;
    console.log(`📱 MOBILE WebRTC: Handling offer from ${fromUserId}`);

    const peerConnection = await this.createPeerConnection(fromUserId);
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('📱 MOBILE WebRTC: Remote description set');

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('📱 MOBILE WebRTC: Answer created and set');

      unifiedWebSocketService.sendAnswer(fromUserId, answer);
      console.log('📱 MOBILE WebRTC: Answer sent');
    } catch (error) {
      console.error('📱 MOBILE WebRTC: Error handling offer:', error);
    }
  }

  private async handleAnswer(data: any): Promise<void> {
    const { fromUserId, answer } = data;
    console.log(`📱 MOBILE WebRTC: Handling answer from ${fromUserId}`);

    const peerConnection = this.peerConnections.get(fromUserId);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('📱 MOBILE WebRTC: Remote description set for answer');
      } catch (error) {
        console.error('📱 MOBILE WebRTC: Error handling answer:', error);
      }
    }
  }

  private async handleIceCandidate(data: any): Promise<void> {
    const { fromUserId, candidate } = data;
    console.log(`📱 MOBILE WebRTC: Handling ICE candidate from ${fromUserId}`);

    const peerConnection = this.peerConnections.get(fromUserId);
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('📱 MOBILE WebRTC: ICE candidate added');
      } catch (error) {
        console.error('📱 MOBILE WebRTC: Error adding ICE candidate:', error);
      }
    }
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
  }

  cleanup() {
    console.log('📱 MOBILE WebRTC: Cleaning up');
    
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`📱 MOBILE WebRTC: Closing connection for ${participantId}`);
      pc.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    console.log('✅ MOBILE WebRTC: Cleanup completed');
  }
}

export default new MobileWebRTCManager();