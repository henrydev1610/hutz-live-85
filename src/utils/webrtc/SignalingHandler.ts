
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
    console.log('📤 HOST: Handling offer from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 HOST: Offer data structure:', { hasOffer: !!data.offer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const targetUserId = data.targetUserId;
    
    console.log('🎯 HOST: Detectando tipo de receptor:', {
      participantId,
      targetUserId,
      isForHost: targetUserId === 'host'
    });
    
    // CORREÇÃO: SEMPRE usar ConnectionHandler para garantir ontrack
    if (!this.connectionHandler) {
      console.error('❌ HOST: ConnectionHandler não disponível - não é possível processar offer');
      return;
    }
    
    console.log('✅ HOST: Usando ConnectionHandler para criar PeerConnection');
    const peerConnection = this.connectionHandler.createPeerConnection(participantId);
    
    try {
      // HOST: Transceivers já configurados no ConnectionHandler
      if (targetUserId === 'host') {
        console.log('🖥️ HOST: PeerConnection já configurado como receive-only pelo ConnectionHandler');
      }
      
      console.log('📋 HOST: Setting remote description for offer');
      await peerConnection.setRemoteDescription(data.offer);
      
      console.log('🔄 HOST: Creating answer');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // HOST: Verificar se answer contém receive-only
      if (answer.sdp) {
        const hasRecvOnlyVideo = answer.sdp.includes('a=recvonly') || answer.sdp.includes('a=inactive');
        console.log('🔍 HOST: Answer SDP analysis:', {
          hasRecvOnlyVideo,
          sdpLength: answer.sdp.length,
          containsVideo: answer.sdp.includes('m=video')
        });
      }
      
      console.log('📤 HOST: Sending answer to:', participantId);
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log('✅ HOST: Answer sent successfully to:', participantId);
    } catch (error) {
      console.error('❌ HOST: Failed to handle offer:', error);
    }
  }

  async handleAnswer(data: any) {
    console.log('📥 HOST: Handling answer from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 HOST: Answer data structure:', { hasAnswer: !!data.answer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        console.log('📋 HOST: Setting remote description for answer');
        await peerConnection.setRemoteDescription(data.answer);
        console.log('✅ HOST: Answer processed successfully for:', participantId);
      } catch (error) {
        console.error('❌ HOST: Failed to handle answer:', error);
      }
    } else {
      console.warn('⚠️ HOST: No peer connection found for participant:', participantId);
    }
  }

  async handleIceCandidate(data: any) {
    console.log('🧊 HOST: Handling ICE candidate from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 HOST: ICE candidate data structure:', { hasCandidate: !!data.candidate, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        console.log('🧊 HOST: Adding ICE candidate');
        await peerConnection.addIceCandidate(data.candidate);
        console.log('✅ HOST: ICE candidate added successfully for:', participantId);
      } catch (error) {
        console.error('❌ HOST: Failed to add ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ HOST: No peer connection found for ICE candidate from:', participantId);
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
