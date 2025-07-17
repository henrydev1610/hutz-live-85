
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
    console.log('📤 CRITICAL: Handling offer from:', data.fromUserId || data.fromSocketId, {
      offerType: data.offer?.type,
      sdpLines: data.offer?.sdp?.split('\n').length || 0,
      hasVideo: data.offer?.sdp?.includes('video') || false,
      hasAudio: data.offer?.sdp?.includes('audio') || false
    });
    
    const participantId = data.fromUserId || data.fromSocketId;
    
    // Use connection handler if available, otherwise create directly
    const peerConnection = this.connectionHandler 
      ? this.connectionHandler.createPeerConnection(participantId)
      : this.createBasicPeerConnection(participantId);
    
    try {
      console.log(`📋 CRITICAL: Setting remote description for ${participantId}`);
      await peerConnection.setRemoteDescription(data.offer);
      
      console.log(`📋 CRITICAL: Remote description set for ${participantId}`, {
        signalingState: peerConnection.signalingState,
        iceConnectionState: peerConnection.iceConnectionState
      });
      
      const answer = await peerConnection.createAnswer();
      console.log(`📋 CRITICAL: Answer created for ${participantId}:`, {
        type: answer.type,
        sdpLines: answer.sdp?.split('\n').length || 0
      });
      
      await peerConnection.setLocalDescription(answer);
      console.log(`📋 CRITICAL: Local description set for ${participantId}`, {
        signalingState: peerConnection.signalingState
      });
      
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log('📥 CRITICAL: Answer sent to:', participantId);
      
    } catch (error) {
      console.error('❌ CRITICAL: Failed to handle offer:', error);
      throw error;
    }
  }

  async handleAnswer(data: any) {
    console.log('📥 CRITICAL: Handling answer from:', data.fromUserId || data.fromSocketId, {
      answerType: data.answer?.type,
      sdpLines: data.answer?.sdp?.split('\n').length || 0,
      hasVideo: data.answer?.sdp?.includes('m=video') || false,
      hasAudio: data.answer?.sdp?.includes('m=audio') || false
    });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        // Validate answer before setting
        if (!data.answer || !data.answer.sdp || !data.answer.type) {
          throw new Error('Invalid answer format');
        }
        
        // Check signaling state
        if (peerConnection.signalingState !== 'have-local-offer') {
          console.warn(`⚠️ CRITICAL: Unexpected signaling state for answer: ${peerConnection.signalingState}`);
        }
        
        console.log(`📋 CRITICAL: Setting remote description (answer) for ${participantId}`);
        await peerConnection.setRemoteDescription(data.answer);
        
        console.log('✅ CRITICAL: Answer processed for:', participantId, {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState
        });
        
        // Log current senders/receivers
        const senders = peerConnection.getSenders();
        const receivers = peerConnection.getReceivers();
        console.log(`📊 CRITICAL: Connection stats for ${participantId}:`, {
          senders: senders.map(s => ({kind: s.track?.kind, active: !!s.track})),
          receivers: receivers.map(r => ({kind: r.track?.kind, active: !!r.track}))
        });
        
      } catch (error) {
        console.error('❌ CRITICAL: Failed to handle answer:', error);
        throw error;
      }
    } else {
      console.error('❌ CRITICAL: No peer connection found for answer from:', participantId);
    }
  }

  async handleIceCandidate(data: any) {
    console.log('🧊 CRITICAL: Handling ICE candidate from:', data.fromUserId || data.fromSocketId, {
      candidateType: data.candidate?.type,
      protocol: data.candidate?.protocol,
      address: data.candidate?.address
    });
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
        console.log('✅ CRITICAL: ICE candidate added for:', participantId);
      } catch (error) {
        console.error('❌ CRITICAL: Failed to add ICE candidate:', error);
        // Don't throw - ICE candidates can fail and that's sometimes normal
      }
    } else {
      console.error('❌ CRITICAL: No peer connection found for ICE candidate from:', participantId);
    }
  }

  private createBasicPeerConnection(participantId: string): RTCPeerConnection {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    const peerConnection = new RTCPeerConnection(config);
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
