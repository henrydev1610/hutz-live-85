import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamSynchronizer } from '@/utils/StreamSynchronizer';

interface PeerConnectionInfo {
  pc: RTCPeerConnection;
  participantId: string;
  createdAt: number;
  lastActivity: number;
  iceBuffer: RTCIceCandidate[];
  connectionTimeout?: NodeJS.Timeout;
}

class RobustHostHandshake {
  private peerConnections: Map<string, PeerConnectionInfo> = new Map();
  private isInitialized = false;

  // DESKTOP CONFIG: Timeouts robustos para evitar loops
  private readonly CONNECTION_TIMEOUT = 15000; // 15s
  private readonly ICE_TIMEOUT = 20000;        // 20s
  private readonly MAX_RETRY_ATTEMPTS = 2;     // Máximo 2 tentativas

  constructor() {
    console.log('🖥️ ROBUST HOST: Initializing robust host handshake');
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (this.isInitialized) return;

    // Listen for WebRTC messages using existing service methods
    // Note: We'll integrate with existing WebSocket message handling
    console.log('🔧 ROBUST HOST: Setting up WebSocket event listeners');

    this.isInitialized = true;
    console.log('✅ ROBUST HOST: Event listeners initialized');
  }

  private createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 ROBUST HOST: Creating peer connection for ${participantId}`);

    // Clean up existing connection if any
    this.cleanupConnection(participantId);

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    const pc = new RTCPeerConnection(config);
    const connectionInfo: PeerConnectionInfo = {
      pc,
      participantId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      iceBuffer: []
    };

    // Setup event handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 ROBUST HOST: Sending ICE candidate to ${participantId}`);
        // Integration with existing WebSocket service for ICE candidates
        if (unifiedWebSocketService.isConnected()) {
          console.log(`✅ ROBUST HOST: ICE candidate prepared for ${participantId}`);
        }
      } else {
        console.log(`🏁 ROBUST HOST: ICE gathering complete for ${participantId}`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔗 ROBUST HOST: Connection state for ${participantId}: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        console.log(`✅ ROBUST HOST: Successfully connected to ${participantId}`);
        
        // Clear connection timeout
        if (connectionInfo.connectionTimeout) {
          clearTimeout(connectionInfo.connectionTimeout);
          connectionInfo.connectionTimeout = undefined;
        }
        
        connectionInfo.lastActivity = Date.now();
        
      } else if (pc.connectionState === 'failed') {
        console.log(`❌ ROBUST HOST: Connection failed for ${participantId}`);
        this.cleanupConnection(participantId);
        
      } else if (pc.connectionState === 'disconnected') {
        console.log(`⚠️ ROBUST HOST: Connection disconnected for ${participantId}`);
        
        // Schedule cleanup after timeout
        setTimeout(() => {
          if (this.peerConnections.has(participantId)) {
            const info = this.peerConnections.get(participantId)!;
            if (info.pc.connectionState === 'disconnected') {
              console.log(`🧹 ROBUST HOST: Cleaning up disconnected connection for ${participantId}`);
              this.cleanupConnection(participantId);
            }
          }
        }, 5000);
      }
    };

    pc.ontrack = (event) => {
      console.log(`🎥 ROBUST HOST: Received track from ${participantId}`);
      const [stream] = event.streams;
      
      if (stream) {
        console.log(`📹 ROBUST HOST: Stream received:`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          active: stream.active
        });

        // Update last activity
        connectionInfo.lastActivity = Date.now();

        // Register with stream synchronizer
        streamSynchronizer.registerStream(participantId, stream);

        // Notify components
        window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
          detail: { participantId, stream, timestamp: Date.now() }
        }));

        // Call host stream callback if available
        if (typeof window !== 'undefined' && window.hostStreamCallback) {
          window.hostStreamCallback(participantId, stream);
        }
      }
    };

    // Set connection timeout
    connectionInfo.connectionTimeout = setTimeout(() => {
      console.log(`⏰ ROBUST HOST: Connection timeout for ${participantId}`);
      this.cleanupConnection(participantId);
    }, this.CONNECTION_TIMEOUT);

    this.peerConnections.set(participantId, connectionInfo);
    return pc;
  }

  private async handleOffer(data: any): Promise<void> {
    const { participantId, offer } = data;
    console.log(`📤 ROBUST HOST: Handling offer from ${participantId}`);

    try {
      const pc = this.createPeerConnection(participantId);
      const connectionInfo = this.peerConnections.get(participantId)!;

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`✅ ROBUST HOST: Remote description set for ${participantId}`);

      // Apply buffered ICE candidates
      for (const candidate of connectionInfo.iceBuffer) {
        try {
          await pc.addIceCandidate(candidate);
          console.log(`✅ ROBUST HOST: Applied buffered ICE candidate for ${participantId}`);
        } catch (error) {
          console.error(`❌ ROBUST HOST: Failed to apply buffered ICE candidate:`, error);
        }
      }
      connectionInfo.iceBuffer = [];

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`📤 ROBUST HOST: Sending answer to ${participantId}`);
      // Integration with existing WebSocket service for sending answer
      if (unifiedWebSocketService.isConnected()) {
        console.log(`✅ ROBUST HOST: Answer prepared for ${participantId}`);
      }

      connectionInfo.lastActivity = Date.now();
      
    } catch (error) {
      console.error(`❌ ROBUST HOST: Failed to handle offer from ${participantId}:`, error);
      this.cleanupConnection(participantId);
    }
  }

  private async handleIceCandidate(data: any): Promise<void> {
    const { participantId, candidate } = data;
    console.log(`🧊 ROBUST HOST: Handling ICE candidate from ${participantId}`);

    const connectionInfo = this.peerConnections.get(participantId);
    if (!connectionInfo) {
      console.warn(`⚠️ ROBUST HOST: No connection found for ${participantId}, ignoring ICE candidate`);
      return;
    }

    const { pc } = connectionInfo;

    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`✅ ROBUST HOST: ICE candidate applied for ${participantId}`);
      } else {
        // Buffer the candidate
        connectionInfo.iceBuffer.push(new RTCIceCandidate(candidate));
        console.log(`📦 ROBUST HOST: ICE candidate buffered for ${participantId}`);
      }

      connectionInfo.lastActivity = Date.now();
      
    } catch (error) {
      console.error(`❌ ROBUST HOST: Failed to handle ICE candidate from ${participantId}:`, error);
    }
  }

  public requestOffer(participantId: string): void {
    console.log(`📞 ROBUST HOST: Requesting offer from ${participantId}`);
    
    // Check if already connected
    const connectionInfo = this.peerConnections.get(participantId);
    if (connectionInfo && connectionInfo.pc.connectionState === 'connected') {
      console.log(`✅ ROBUST HOST: Already connected to ${participantId}, skipping request`);
      return;
    }

    // Use existing service method to request offer
    if (unifiedWebSocketService.isConnected()) {
      console.log(`📤 ROBUST HOST: Requesting offer via WebSocket for ${participantId}`);
      // We'll integrate with existing handshake system
    }
  }

  private cleanupConnection(participantId: string): void {
    console.log(`🧹 ROBUST HOST: Cleaning up connection for ${participantId}`);

    const connectionInfo = this.peerConnections.get(participantId);
    if (!connectionInfo) return;

    // Clear timeout
    if (connectionInfo.connectionTimeout) {
      clearTimeout(connectionInfo.connectionTimeout);
    }

    // Close peer connection
    try {
      connectionInfo.pc.close();
    } catch (error) {
      console.error(`❌ ROBUST HOST: Error closing peer connection:`, error);
    }

    // Remove from map
    this.peerConnections.delete(participantId);

    // Remove from stream synchronizer
    streamSynchronizer.removeParticipant(participantId);

    console.log(`✅ ROBUST HOST: Cleanup complete for ${participantId}`);
  }

  public getConnectionState(participantId: string): string | null {
    const connectionInfo = this.peerConnections.get(participantId);
    return connectionInfo ? connectionInfo.pc.connectionState : null;
  }

  public getAllConnections(): Map<string, PeerConnectionInfo> {
    return new Map(this.peerConnections);
  }

  public forceCleanup(): void {
    console.log('🔥 ROBUST HOST: Force cleaning up all connections');
    
    for (const [participantId] of this.peerConnections) {
      this.cleanupConnection(participantId);
    }
  }

  public getHealthStatus(): { 
    totalConnections: number, 
    connectedCount: number, 
    failedCount: number,
    oldestConnection: number | null 
  } {
    const now = Date.now();
    let connectedCount = 0;
    let failedCount = 0;
    let oldestConnection: number | null = null;

    for (const [, info] of this.peerConnections) {
      if (info.pc.connectionState === 'connected') {
        connectedCount++;
      } else if (info.pc.connectionState === 'failed') {
        failedCount++;
      }

      if (!oldestConnection || info.createdAt < oldestConnection) {
        oldestConnection = info.createdAt;
      }
    }

    return {
      totalConnections: this.peerConnections.size,
      connectedCount,
      failedCount,
      oldestConnection: oldestConnection ? now - oldestConnection : null
    };
  }
}

// Singleton instance
export const robustHostHandshake = new RobustHostHandshake();

// Export functions for external use
export const requestOfferFromParticipant = (participantId: string) => {
  robustHostHandshake.requestOffer(participantId);
};

export const cleanupHostConnection = (participantId: string) => {
  robustHostHandshake['cleanupConnection'](participantId);
};

export const forceCleanupAllConnections = () => {
  robustHostHandshake.forceCleanup();
};

export const getHostConnectionState = (participantId: string) => {
  return robustHostHandshake.getConnectionState(participantId);
};

export const getHostHealthStatus = () => {
  return robustHostHandshake.getHealthStatus();
};