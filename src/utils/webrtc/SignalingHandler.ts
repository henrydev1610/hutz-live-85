
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
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
      
      // FASE 5: Mark remote description set and flush buffered ICE
      const { iceBuffer } = await import('@/utils/webrtc/ICECandidateBuffer');
      const bufferedCandidates = iceBuffer.markHostRemoteDescriptionSet(participantId);
      
      console.log(`📤 FASE 5: Answer sent to: ${participantId}`);
      if (DEBUG && answer.sdp) {
        const hasRecvOnlyVideo = answer.sdp.includes('a=recvonly');
        console.log('🔍 FASE 5: Answer SDP:', {
          hasRecvOnlyVideo,
          sdpLength: answer.sdp.length,
          containsVideo: answer.sdp.includes('m=video')
        });
      }
      
      unifiedWebSocketService.sendAnswer(participantId, answer);
      
      // FASE 5: Apply buffered ICE candidates
      if (bufferedCandidates.length > 0) {
        console.log(`🚀 FASE 5: Applying ${bufferedCandidates.length} buffered ICE candidates for ${participantId}`);
        
        for (const buffered of bufferedCandidates) {
          try {
            await peerConnection.addIceCandidate(buffered.candidate);
            console.log(`✅ FASE 5: Applied buffered ICE candidate from ${participantId}`);
          } catch (error) {
            console.error(`❌ FASE 5: Failed to apply buffered ICE: ${error}`);
          }
        }
      }
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
    console.log(`🧊 FASE 5: ICE from: ${data.fromUserId || data.fromSocketId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔍 FASE 5: ICE data:', { hasCandidate: !!data.candidate, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    // FASE 5: Import ICE buffer for host-side coordination
    const { iceBuffer } = await import('@/utils/webrtc/ICECandidateBuffer');
    
    if (peerConnection) {
      // FASE 5: Only apply ICE if remote description is set
      if (iceBuffer.shouldApplyHostICE(participantId)) {
        try {
          await peerConnection.addIceCandidate(data.candidate);
          if (DEBUG) console.log(`✅ FASE 5: ICE applied immediately: ${participantId}`);
        } catch (error) {
          console.error(`❌ FASE 5: Failed to add ICE: ${error}`);
        }
      } else {
        // FASE 5: Buffer ICE until remote description is set
        console.log(`📦 FASE 5: Buffering ICE from ${participantId} (remote description not set)`);
        iceBuffer.bufferHostICE(data.candidate, participantId);
      }
    } else {
      console.warn(`⚠️ FASE 5: No peer connection for ICE: ${participantId}`);
      // FASE 5: Buffer for when peer connection is created
      iceBuffer.bufferHostICE(data.candidate, participantId);
    }
  }

}
