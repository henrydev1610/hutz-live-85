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
    console.log(`🔗 Creating peer connection for: ${participantId}`);

    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      console.log(`♻️ Reusing existing peer connection for: ${participantId}`);
      return this.peerConnections.get(participantId)!;
    }

    // Criar nome único para o relay baseado na sessão e timestamp
    const uniqueId = `relay-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    console.log(`🔧 Creating WebRTC connection with unique ID: ${uniqueId}`);
    const peerConnection = new RTCPeerConnection(config);
    
    // Adicionar propriedade única para debug
    (peerConnection as any).__uniqueId = uniqueId;
    
    this.peerConnections.set(participantId, peerConnection);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to: ${participantId}`);
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 WEBRTC CONNECTION: ${participantId} state changed to: ${peerConnection.connectionState}`);

      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ WEBRTC SUCCESS: Peer connection established with: ${participantId}`);
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ WEBRTC FAILED: Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.connectionState === 'connecting') {
        console.log(`🔄 WEBRTC CONNECTING: Establishing connection with: ${participantId}`);
      } else if (peerConnection.connectionState === 'new') {
        console.log(`🆕 WEBRTC NEW: New connection created for: ${participantId}`);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`🎥 MOBILE-CRITICAL: Track received from ${participantId}:`, {
        kind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamIds: event.streams.map(s => s.id),
        readyState: event.track.readyState,
        enabled: event.track.enabled
      });

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 MOBILE-CRITICAL: Processing stream from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        const triggerCallback = () => {
          if (this.streamCallback) {
            console.log(`🚀 MOBILE-IMMEDIATE: Triggering stream callback for ${participantId}`);
            try {
              this.streamCallback(participantId, stream);
            } catch (error) {
              console.error(`❌ Stream callback error for ${participantId}:`, error);
              setTimeout(() => {
                if (this.streamCallback) {
                  this.streamCallback(participantId, stream);
                }
              }, 50);
            }
          } else {
            console.error(`❌ MOBILE-CRITICAL: No stream callback set for ${participantId}`);
          }
        };

        triggerCallback();
        setTimeout(() => triggerCallback(), 100);
        setTimeout(() => triggerCallback(), 500);

      } else {
        console.warn(`⚠️ MOBILE: Track received from ${participantId} but no streams attached`);
        if (event.track) {
          const syntheticStream = new MediaStream([event.track]);
          console.log(`🔧 MOBILE-FIX: Created synthetic stream for ${participantId}`);
          if (this.streamCallback) {
            this.streamCallback(participantId, syntheticStream);
          }
        }
      }
    };

    // ✅ ALTERAÇÃO: usar replaceTrack ao invés de addTrack redundante
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 Preparing to push local tracks to: ${participantId}`);
      const senders = peerConnection.getSenders();

      localStream.getTracks().forEach(newTrack => {
        const existingSender = senders.find(s => s.track?.kind === newTrack.kind);
        if (existingSender) {
          console.log(`🔁 Replacing ${newTrack.kind} track for: ${participantId}`);
          existingSender.replaceTrack(newTrack).catch(err =>
            console.error(`❌ Failed to replace ${newTrack.kind} track for ${participantId}:`, err)
          );
        } else {
          console.log(`➕ Adding new ${newTrack.kind} track to: ${participantId}`);
          peerConnection.addTrack(newTrack, localStream);
        }
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
      this.retryAttempts.delete(participantId);
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

      unifiedWebSocketService.sendOffer(participantId, offer);
    } catch (error) {
      console.error(`❌ Failed to create/send offer to ${participantId}:`, error);
      throw error;
    }
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);

    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }

    this.clearHeartbeat(participantId);

    setTimeout(() => {
      this.initiateCallWithRetry(participantId);
    }, 3000);
  }

  startHeartbeat(participantId: string): void {
    console.log(`💓 Starting heartbeat for: ${participantId}`);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const heartbeatInterval = isMobile ? 5000 : 30000;

    console.log(`💓 MOBILE-OPTIMIZED: Using ${heartbeatInterval}ms heartbeat for ${participantId} (${isMobile ? 'Mobile' : 'Desktop'})`);

    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat sent to: ${participantId}`);

        if (isMobile) {
          console.log(`📱 MOBILE HEARTBEAT: ICE state: ${peerConnection.iceConnectionState}`);
          if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
            console.warn(`⚠️ MOBILE HEARTBEAT: Unstable ICE connection for ${participantId}`);
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

    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();

    this.retryAttempts.clear();
  }
}
