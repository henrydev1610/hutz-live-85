
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
    console.log(`📤 [SIG] Offer from: ${data.fromUserId || data.fromSocketId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔍 [SIG] Offer data:', { hasOffer: !!data.offer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const targetUserId = data.targetUserId;
    
    if (DEBUG) {
      console.log('🎯 [SIG] Target detection:', {
        participantId,
        targetUserId,
        isForHost: targetUserId === 'host'
      });
    }
    
    // CORREÇÃO: SEMPRE usar ConnectionHandler para garantir ontrack
    if (!this.connectionHandler) {
      console.error('❌ [SIG] ConnectionHandler não disponível');
      return;
    }
    
    console.log('✅ [SIG] Using ConnectionHandler for PeerConnection');
    const peerConnection = this.connectionHandler.createPeerConnection(participantId);
    
    try {
      if (targetUserId === 'host' && DEBUG) {
        console.log('🖥️ [SIG] Host PeerConnection configured as receive-only');
      }
      
      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      console.log(`📤 [SIG] Answer sent to: ${participantId}`);
      if (DEBUG && answer.sdp) {
        const hasRecvOnlyVideo = answer.sdp.includes('a=recvonly');
        console.log('🔍 [SIG] Answer SDP:', {
          hasRecvOnlyVideo,
          sdpLength: answer.sdp.length,
          containsVideo: answer.sdp.includes('m=video')
        });
      }
      
      unifiedWebSocketService.sendAnswer(participantId, answer);
    } catch (error) {
      console.error('❌ [SIG] Failed to handle offer:', error);
    }
  }

  async handleAnswer(data: any) {
    console.log(`📥 [SIG] Answer from: ${data.fromUserId || data.fromSocketId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔍 [SIG] Answer data:', { hasAnswer: !!data.answer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(data.answer);
        if (DEBUG) console.log(`✅ [SIG] Answer processed: ${participantId}`);
      } catch (error) {
        console.error(`❌ [SIG] Failed to handle answer: ${error}`);
      }
    } else {
      console.warn(`⚠️ [SIG] No peer connection for: ${participantId}`);
    }
  }

  async handleIceCandidate(data: any) {
    console.log(`🧊 [SIG] ICE from: ${data.fromUserId || data.fromSocketId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔍 [SIG] ICE data:', { hasCandidate: !!data.candidate, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
        if (DEBUG) console.log(`✅ [SIG] ICE added: ${participantId}`);
      } catch (error) {
        console.error(`❌ [SIG] Failed to add ICE: ${error}`);
      }
    } else {
      console.warn(`⚠️ [SIG] No peer connection for ICE: ${participantId}`);
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
