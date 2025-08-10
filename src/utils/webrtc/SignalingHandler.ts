
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
    console.log('📤 PLANO CIRÚRGICO: Handling offer from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 PLANO CIRÚRGICO: Offer data structure:', { hasOffer: !!data.offer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    
    // Use connection handler if available, otherwise create directly
    const peerConnection = this.connectionHandler 
      ? this.connectionHandler.createPeerConnection(participantId)
      : this.createBasicPeerConnection(participantId);
    
    try {
      console.log('📋 PLANO CIRÚRGICO: Setting remote description for offer');
      await peerConnection.setRemoteDescription(data.offer);
      
      console.log('🔄 PLANO CIRÚRGICO: Creating answer');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      console.log('📤 PLANO CIRÚRGICO: Sending answer to:', participantId);
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log('✅ PLANO CIRÚRGICO: Answer sent successfully to:', participantId);
    } catch (error) {
      console.error('❌ PLANO CIRÚRGICO: Failed to handle offer:', error);
    }
  }

  async handleAnswer(data: any) {
    console.log('📥 PLANO CIRÚRGICO: Handling answer from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 PLANO CIRÚRGICO: Answer data structure:', { hasAnswer: !!data.answer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        console.log('📋 PLANO CIRÚRGICO: Setting remote description for answer');
        await peerConnection.setRemoteDescription(data.answer);
        console.log('✅ PLANO CIRÚRGICO: Answer processed successfully for:', participantId);
      } catch (error) {
        console.error('❌ PLANO CIRÚRGICO: Failed to handle answer:', error);
      }
    } else {
      console.warn('⚠️ PLANO CIRÚRGICO: No peer connection found for participant:', participantId);
    }
  }

  async handleIceCandidate(data: any) {
    console.log('🧊 PLANO CIRÚRGICO: Handling ICE candidate from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 PLANO CIRÚRGICO: ICE candidate data structure:', { hasCandidate: !!data.candidate, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        console.log('🧊 PLANO CIRÚRGICO: Adding ICE candidate');
        await peerConnection.addIceCandidate(data.candidate);
        console.log('✅ PLANO CIRÚRGICO: ICE candidate added successfully for:', participantId);
      } catch (error) {
        console.error('❌ PLANO CIRÚRGICO: Failed to add ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ PLANO CIRÚRGICO: No peer connection found for ICE candidate from:', participantId);
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
