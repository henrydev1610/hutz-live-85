
import signalingService from '@/services/WebSocketSignalingService';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private connectionRetries: Map<string, number> = new Map();
  private maxRetries = 3;
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.onParticipantJoinCallback = callback;
  }

  async initiateCallWithRetry(participantId: string, retryCount: number = 0) {
    try {
      console.log(`📞 Initiating call to: ${participantId} (attempt ${retryCount + 1})`);
      await this.initiateCall(participantId);
    } catch (error) {
      console.error(`❌ Call initiation failed (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 Retrying call in ${delay}ms...`);
        setTimeout(() => {
          this.initiateCallWithRetry(participantId, retryCount + 1);
        }, delay);
      } else {
        console.error(`❌ Max retries reached for participant: ${participantId}`);
      }
    }
  }

  private async initiateCall(participantId: string) {
    console.log(`📞 Initiating call to: ${participantId}`);
    
    const peerConnection = this.createPeerConnection(participantId);
    
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);
    
    signalingService.sendOffer(participantId, offer);
    console.log('📤 Offer sent to:', participantId);
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);
    
    peerConnection.ontrack = (event) => {
      console.log('📺 Received track from:', participantId, event.track.kind);
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('🎥 Processing stream from:', participantId, {
          streamId: stream.id,
          active: stream.active,
          tracks: stream.getTracks().length
        });
        
        if (this.onStreamCallback) {
          console.log('✅ IMMEDIATE stream callback for:', participantId);
          setTimeout(() => {
            this.onStreamCallback!(participantId, stream);
          }, 0);
        }
        
        if (this.onParticipantJoinCallback) {
          console.log('👤 Ensuring participant join for:', participantId);
          setTimeout(() => {
            this.onParticipantJoinCallback!(participantId);
          }, 0);
        }
      }
    };
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', participantId);
        signalingService.sendIceCandidate(participantId, event.candidate);
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`🔗 Connection state for ${participantId}:`, state);
      
      if (state === 'connected') {
        console.log(`✅ Peer connection established with ${participantId}`);
        this.connectionRetries.delete(participantId);
        
        const receivers = peerConnection.getReceivers();
        receivers.forEach(receiver => {
          if (receiver.track && receiver.track.readyState === 'live') {
            console.log('🔄 Verifying stream for connected peer:', participantId);
            if (receiver.track.kind === 'video') {
              const stream = new MediaStream([receiver.track]);
              if (this.onStreamCallback) {
                console.log('🎥 Re-calling stream callback for verification:', participantId);
                this.onStreamCallback(participantId, stream);
              }
            }
          }
        });
      } else if (state === 'failed' || state === 'disconnected') {
        console.error(`❌ Peer connection ${state} with ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };
    
    peerConnection.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state for ${participantId}:`, peerConnection.iceGatheringState);
    };
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state for ${participantId}:`, peerConnection.iceConnectionState);
    };
    
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📹 Adding local stream to peer connection for ${participantId}`);
      localStream.getTracks().forEach(track => {
        console.log(`📹 Adding ${track.kind} track:`, track.id);
        peerConnection.addTrack(track, localStream);
      });
    }
    
    return peerConnection;
  }

  private handleConnectionFailure(participantId: string) {
    const retryCount = this.connectionRetries.get(participantId) || 0;
    
    if (retryCount < this.maxRetries) {
      console.log(`🔄 Retrying connection to ${participantId} (attempt ${retryCount + 1})`);
      this.connectionRetries.set(participantId, retryCount + 1);
      
      const existingConnection = this.peerConnections.get(participantId);
      if (existingConnection) {
        existingConnection.close();
        this.peerConnections.delete(participantId);
      }
      
      setTimeout(() => {
        this.initiateCallWithRetry(participantId, retryCount);
      }, 2000);
    } else {
      console.error(`❌ Max retries reached for participant: ${participantId}`);
      this.connectionRetries.delete(participantId);
    }
  }

  startHeartbeat(participantId: string) {
    const heartbeatInterval = setInterval(() => {
      const connection = this.peerConnections.get(participantId);
      if (connection && connection.connectionState === 'connected') {
        console.log(`💓 Heartbeat for ${participantId}: connected`);
      } else if (!connection) {
        console.log(`💓 Heartbeat stopped for ${participantId}: no connection`);
        clearInterval(heartbeatInterval);
      }
    }, 5000);
  }

  clearRetries(participantId: string) {
    this.connectionRetries.delete(participantId);
  }

  cleanup() {
    this.connectionRetries.clear();
  }
}
