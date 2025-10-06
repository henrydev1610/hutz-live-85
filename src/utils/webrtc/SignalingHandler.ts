import { ConnectionHandler } from './ConnectionHandler';

export class SignalingHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private connectionHandler: ConnectionHandler | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    _pendingCandidates: Map<string, RTCIceCandidate[]>
  ) {
    this.peerConnections = peerConnections;
  }

  setConnectionHandler(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
  }

  async handleOffer(data: { offer: RTCSessionDescriptionInit; fromUserId: string; fromSocketId: string }): Promise<void> {
    const participantId = data.fromUserId || data.fromSocketId;
    console.log('📞 SignalingHandler: Handling offer from', participantId);
    
    if (!this.connectionHandler) {
      console.error('❌ SignalingHandler: ConnectionHandler not set');
      return;
    }

    try {
      await this.connectionHandler.handleOffer(participantId, data.offer);
    } catch (error) {
      console.error('❌ SignalingHandler: Error handling offer:', error);
    }
  }

  async handleAnswer(data: { answer: RTCSessionDescriptionInit; fromUserId: string; fromSocketId: string }): Promise<void> {
    const participantId = data.fromUserId || data.fromSocketId;
    console.log('✅ SignalingHandler: Handling answer from', participantId);
    
    if (!this.connectionHandler) {
      console.error('❌ SignalingHandler: ConnectionHandler not set');
      return;
    }

    try {
      await this.connectionHandler.handleAnswer(participantId, data.answer);
    } catch (error) {
      console.error('❌ SignalingHandler: Error handling answer:', error);
    }
  }

  async handleIceCandidate(data: { candidate: RTCIceCandidate; fromUserId: string; fromSocketId: string }): Promise<void> {
    const participantId = data.fromUserId || data.fromSocketId;
    console.log('🧊 SignalingHandler: Handling ICE candidate from', participantId);
    
    if (!this.connectionHandler) {
      console.error('❌ SignalingHandler: ConnectionHandler not set');
      return;
    }

    try {
      await this.connectionHandler.handleIceCandidate(participantId, data.candidate);
    } catch (error) {
      console.error('❌ SignalingHandler: Error handling ICE candidate:', error);
    }
  }
}
