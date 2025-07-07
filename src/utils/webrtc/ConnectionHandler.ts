
import signalingService from '@/services/WebSocketSignalingService';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
    console.log('📞 ConnectionHandler: Stream callback set');
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
    console.log('👤 ConnectionHandler: Participant join callback set');
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 Creating peer connection for: ${participantId}`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to: ${participantId}`);
        signalingService.sendIceCandidate(participantId, event.candidate);
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ Peer connection established with: ${participantId}`);
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // CRITICAL: Stream handling for incoming tracks
    peerConnection.ontrack = (event) => {
      console.log(`🎥 CRITICAL: Track received from ${participantId}:`, {
        kind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamIds: event.streams.map(s => s.id)
      });

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 CRITICAL: Processing stream from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // IMMEDIATE callback trigger
        if (this.streamCallback) {
          console.log(`🚀 IMMEDIATE: Triggering stream callback for ${participantId}`);
          this.streamCallback(participantId, stream);
        } else {
          console.error(`❌ CRITICAL: No stream callback set when receiving stream from ${participantId}`);
        }
      } else {
        console.warn(`⚠️ Track received from ${participantId} but no streams attached`);
      }
    };

    // Add local stream if available (for participants)
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 Adding local stream to peer connection for: ${participantId}`);
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        console.log(`➕ Added ${track.kind} track to peer connection`);
      });
    }

    return peerConnection;
  }

  async initiateCallWithRetry(participantId: string, maxRetries: number = 3): Promise<void> {
    const currentRetries = this.retryAttempts.get(participantId) || 0;
    
    if (currentRetries >= maxRetries) {
      console.error(`❌ Max retry attempts reached for: ${participantId}`);
      return;
    }

    this.retryAttempts.set(participantId, currentRetries + 1);
    
    try {
      await this.initiateCall(participantId);
      this.retryAttempts.delete(participantId); // Reset on success
    } catch (error) {
      console.error(`❌ Call initiation failed for ${participantId} (attempt ${currentRetries + 1}):`, error);
      
      if (currentRetries + 1 < maxRetries) {
        console.log(`🔄 Retrying call to ${participantId} in 2 seconds...`);
        setTimeout(() => {
          this.initiateCallWithRetry(participantId, maxRetries);
        }, 2000);
      }
    }
  }

  private async initiateCall(participantId: string): Promise<void> {
    console.log(`📞 Initiating call to: ${participantId}`);

    const peerConnection = this.createPeerConnection(participantId);
    
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await peerConnection.setLocalDescription(offer);
      console.log(`📤 Sending offer to: ${participantId}`);
      
      signalingService.sendOffer(participantId, offer);
    } catch (error) {
      console.error(`❌ Failed to create/send offer to ${participantId}:`, error);
      throw error;
    }
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);
    
    // Clean up failed connection
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    // Clear heartbeat
    this.clearHeartbeat(participantId);
    
    // Attempt retry after delay
    setTimeout(() => {
      this.initiateCallWithRetry(participantId);
    }, 3000);
  }

  startHeartbeat(participantId: string): void {
    console.log(`💓 Starting heartbeat for: ${participantId}`);
    
    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat sent to: ${participantId}`);
        // Could send heartbeat via data channel or signaling
      } else {
        console.log(`💔 No active connection for heartbeat: ${participantId}`);
        this.clearHeartbeat(participantId);
      }
    }, 30000); // 30 second heartbeat
    
    this.heartbeatIntervals.set(participantId, interval);
  }

  clearHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`💔 Heartbeat cleared for: ${participantId}`);
    }
  }

  clearRetries(participantId: string): void {
    this.retryAttempts.delete(participantId);
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ConnectionHandler');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();
    
    // Clear retry attempts
    this.retryAttempts.clear();
  }
}
