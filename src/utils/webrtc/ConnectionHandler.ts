
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

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
    console.log(`🔗 CRITICAL: Creating peer connection for: ${participantId}`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);

    console.log(`✅ CRITICAL: Peer connection created for ${participantId}`, {
      iceGatheringState: peerConnection.iceGatheringState,
      connectionState: peerConnection.connectionState,
      signalingState: peerConnection.signalingState
    });

    // ICE candidate handling with detailed logging
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 CRITICAL: ICE candidate generated for ${participantId}:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port
        });
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      } else {
        console.log(`🧊 CRITICAL: ICE gathering completed for ${participantId}`);
      }
    };

    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 CRITICAL: ICE connection state changed for ${participantId}:`, peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
        console.log(`✅ CRITICAL: ICE connection established for ${participantId}`);
      } else if (peerConnection.iceConnectionState === 'failed') {
        console.error(`❌ CRITICAL: ICE connection failed for ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 CRITICAL: Connection state for ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ CRITICAL: Peer connection established with: ${participantId}`);
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ CRITICAL: Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // CRITICAL: Enhanced stream handling for incoming tracks with mobile optimization
    peerConnection.ontrack = (event) => {
      console.log(`🎥 UNIFIED-CRITICAL: Track received from ${participantId}:`, {
        kind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamIds: event.streams.map(s => s.id),
        readyState: event.track.readyState,
        enabled: event.track.enabled,
        timestamp: Date.now()
      });

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 UNIFIED-CRITICAL: Processing stream from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active,
          timestamp: Date.now()
        });

        // Enhanced callback trigger with mobile-first approach
        const triggerCallback = () => {
          if (this.streamCallback) {
            console.log(`🚀 UNIFIED-CRITICAL: Triggering stream callback for ${participantId}`);
            try {
              this.streamCallback(participantId, stream);
              console.log(`✅ UNIFIED-CRITICAL: Stream callback executed successfully for ${participantId}`);
            } catch (error) {
              console.error(`❌ UNIFIED-CRITICAL: Stream callback error for ${participantId}:`, error);
            }
          } else {
            console.error(`❌ UNIFIED-CRITICAL: No stream callback set for ${participantId}`);
          }
        };

        // IMMEDIATE trigger - highest priority
        triggerCallback();
        
        // Backup trigger for mobile stability
        setTimeout(() => {
          console.log(`🔄 UNIFIED-BACKUP: Backup trigger for ${participantId}`);
          triggerCallback();
        }, 50);
        
      } else {
        console.warn(`⚠️ UNIFIED: Track received from ${participantId} but no streams attached`);
        // Try to create stream from track for mobile compatibility
        if (event.track) {
          const syntheticStream = new MediaStream([event.track]);
          console.log(`🔧 UNIFIED-FIX: Created synthetic stream for ${participantId}`);
          if (this.streamCallback) {
            this.streamCallback(participantId, syntheticStream);
          }
        }
      }
    };

    // CRITICAL: Add local stream if available (for participants)
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 CRITICAL: Adding local stream to peer connection for: ${participantId}`, {
        streamId: localStream.id,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      localStream.getTracks().forEach(track => {
        try {
          peerConnection.addTrack(track, localStream);
          console.log(`➕ CRITICAL: Added ${track.kind} track to peer connection for ${participantId}`, {
            trackId: track.id,
            enabled: track.enabled,
            readyState: track.readyState
          });
        } catch (error) {
          console.error(`❌ CRITICAL: Failed to add track for ${participantId}:`, error);
        }
      });
    } else {
      console.log(`⚠️ CRITICAL: No local stream available for ${participantId}`);
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
    console.log(`📞 CRITICAL: Initiating call to: ${participantId}`);

    const peerConnection = this.createPeerConnection(participantId);
    
    try {
      // Create offer with detailed options
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        iceRestart: false
      });
      
      console.log(`📋 CRITICAL: Offer created for ${participantId}:`, {
        type: offer.type,
        sdpLines: offer.sdp?.split('\n').length || 0,
        hasVideo: offer.sdp?.includes('video') || false,
        hasAudio: offer.sdp?.includes('audio') || false
      });
      
      await peerConnection.setLocalDescription(offer);
      console.log(`📤 CRITICAL: Local description set for ${participantId}`, {
        signalingState: peerConnection.signalingState,
        iceGatheringState: peerConnection.iceGatheringState
      });
      
      console.log(`📤 CRITICAL: Sending offer to: ${participantId}`);
      unifiedWebSocketService.sendOffer(participantId, offer);
      
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to create/send offer to ${participantId}:`, error);
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
    
    // Enhanced heartbeat frequency for mobile connections
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const heartbeatInterval = isMobile ? 5000 : 30000; // 5s for mobile, 30s for desktop
    
    console.log(`💓 MOBILE-OPTIMIZED: Using ${heartbeatInterval}ms heartbeat for ${participantId} (${isMobile ? 'Mobile' : 'Desktop'})`);
    
    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat sent to: ${participantId}`);
        // Enhanced heartbeat for mobile - check connection quality
        if (isMobile) {
          // Send ping via data channel or check ICE connection state
          console.log(`📱 MOBILE HEARTBEAT: Connection state: ${peerConnection.connectionState}, ICE state: ${peerConnection.iceConnectionState}`);
          
          // If ICE connection is not stable, trigger recovery
          if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
            console.warn(`⚠️ MOBILE HEARTBEAT: Unstable ICE connection detected for ${participantId}: ${peerConnection.iceConnectionState}`);
            this.handleConnectionFailure(participantId);
          }
        }
      } else {
        console.log(`💔 No active connection for heartbeat: ${participantId}`);
        this.clearHeartbeat(participantId);
      }
    }, heartbeatInterval);
    
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
