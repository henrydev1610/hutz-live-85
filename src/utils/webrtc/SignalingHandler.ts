
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
    console.log('📤 FASE 2: Handling offer from:', data.fromUserId || data.fromSocketId);
    console.log('🔍 FASE 2: Offer data structure:', { hasOffer: !!data.offer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const targetUserId = data.targetUserId;
    
    console.log('🎯 FASE 2: Detectando tipo de receptor:', {
      participantId,
      targetUserId,
      isForHost: targetUserId === 'host'
    });
    
    // Use connection handler if available, otherwise create directly
    const peerConnection = this.connectionHandler 
      ? this.connectionHandler.createPeerConnection(participantId)
      : this.createBasicPeerConnection(participantId);
    
    try {
      // FASE 2: Para hosts, garantir transceivers receive-only ANTES de processar offer
      if (targetUserId === 'host') {
        console.log('🖥️ FASE 2: Configurando HOST para receber offer');
        
        // Verificar se já tem transceivers, se não, criar
        const existingTransceivers = peerConnection.getTransceivers();
        if (existingTransceivers.length === 0) {
          console.log('📡 FASE 2: Criando transceivers receive-only para host');
          peerConnection.addTransceiver('video', { direction: 'recvonly' });
          peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        }
      }
      
      console.log('📋 FASE 2: Setting remote description for offer');
      await peerConnection.setRemoteDescription(data.offer);
      
      console.log('🔄 FASE 2: Creating answer');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // FASE 2: Verificar se answer contém receive-only
      if (answer.sdp) {
        const hasRecvOnlyVideo = answer.sdp.includes('a=recvonly') || answer.sdp.includes('a=inactive');
        console.log('🔍 FASE 2: Answer SDP analysis:', {
          hasRecvOnlyVideo,
          sdpLength: answer.sdp.length,
          containsVideo: answer.sdp.includes('m=video')
        });
      }
      
      console.log('📤 FASE 2: Sending answer to:', participantId);
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log('✅ FASE 2: Answer sent successfully to:', participantId);
    } catch (error) {
      console.error('❌ FASE 2: Failed to handle offer:', error);
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
