
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { ConnectionHandler } from './ConnectionHandler';

export class SignalingHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private participants: Map<string, any>;
  private connectionHandler: ConnectionHandler | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    participants: Map<string, any>
  ) {
    this.peerConnections = peerConnections;
    this.participants = participants;
  }

  setConnectionHandler(connectionHandler: ConnectionHandler) {
    this.connectionHandler = connectionHandler;
  }

  async handleOffer(data: any) {
    console.log('📤 Handling offer from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    
    // Use connection handler if available, otherwise create directly
    const peerConnection = this.connectionHandler 
      ? this.connectionHandler.createPeerConnection(participantId)
      : this.createBasicPeerConnection(participantId);
    
    try {
      await peerConnection.setRemoteDescription(data.offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log('📥 Answer sent to:', participantId);
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
    }
  }

  async handleAnswer(data: any) {
    console.log('📥 Handling answer from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(data.answer);
        console.log('✅ Answer processed for:', participantId);
      } catch (error) {
        console.error('❌ Failed to handle answer:', error);
      }
    }
  }

  async handleIceCandidate(data: any) {
    console.log('🧊 Handling ICE candidate from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
        console.log('✅ ICE candidate added for:', participantId);
      } catch (error) {
        console.error('❌ Failed to add ICE candidate:', error);
      }
    }
  }

  private createBasicPeerConnection(participantId: string): RTCPeerConnection {
    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      console.log(`♻️ Reusing existing basic peer connection for: ${participantId}`);
      return this.peerConnections.get(participantId)!;
    }

    // Criar nome único para o relay baseado na sessão e timestamp
    const uniqueId = `relay-basic-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    console.log(`🔧 Creating basic WebRTC connection with unique ID: ${uniqueId}`);
    const peerConnection = new RTCPeerConnection(config);
    
    // Adicionar propriedade única para debug
    (peerConnection as any).__uniqueId = uniqueId;
    
    this.peerConnections.set(participantId, peerConnection);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', participantId);
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };
    
    return peerConnection;
  }
}
