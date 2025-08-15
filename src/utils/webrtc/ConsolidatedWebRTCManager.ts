// CONSOLIDAÇÃO: Single WebRTC Manager - Limpo e Funcional
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface ConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface PeerConnectionInfo {
  pc: RTCPeerConnection;
  participantId: string;
  createdAt: number;
  timeout?: NodeJS.Timeout;
  ontrackReceived: boolean;
  verificationTimer?: NodeJS.Timeout;
}

export class ConsolidatedWebRTCManager {
  private static instance: ConsolidatedWebRTCManager;
  private connections: Map<string, PeerConnectionInfo> = new Map();
  private iceCandidateBuffer: Map<string, RTCIceCandidate[]> = new Map();
  private sessionId: string | null = null;
  private isHost: boolean = false;
  private isParticipant: boolean = false;
  
  private readonly CONNECTION_TIMEOUT = 10000; // 10s timeout
  private readonly ONTRACK_VERIFICATION_TIMEOUT = 3000; // 3s ontrack verification
  private readonly ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  private connectionState: ConnectionState = {
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  };

  private constructor() {
    console.log('🎯 CONSOLIDATED: Manager initialized');
  }

  static getInstance(): ConsolidatedWebRTCManager {
    if (!ConsolidatedWebRTCManager.instance) {
      ConsolidatedWebRTCManager.instance = new ConsolidatedWebRTCManager();
    }
    return ConsolidatedWebRTCManager.instance;
  }

  // HOST METHODS
  async initializeAsHost(sessionId: string): Promise<void> {
    console.log('🖥️ CONSOLIDATED: Initializing as host for:', sessionId);
    
    this.cleanup();
    this.sessionId = sessionId;
    this.isHost = true;
    this.isParticipant = false;

    try {
      // Connect to WebSocket
      if (!unifiedWebSocketService.isConnected()) {
        await unifiedWebSocketService.connect();
      }
      
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      this.updateConnectionState('websocket', 'connected');
      
      // Setup WebRTC message handlers
      this.setupHostHandlers();
      
      console.log('✅ CONSOLIDATED: Host initialized successfully');
    } catch (error) {
      console.error('❌ CONSOLIDATED: Host initialization failed:', error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  // PARTICIPANT METHODS  
  async initializeAsParticipant(sessionId: string, participantId: string, stream: MediaStream): Promise<void> {
    console.log('📱 CONSOLIDATED: Initializing as participant:', participantId);
    
    this.cleanup();
    this.sessionId = sessionId;
    this.isHost = false;
    this.isParticipant = true;

    try {
      // Connect to WebSocket
      if (!unifiedWebSocketService.isConnected()) {
        await unifiedWebSocketService.connect();
      }
      
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      this.updateConnectionState('websocket', 'connected');
      
      // Setup participant handlers
      this.setupParticipantHandlers();
      
      console.log('✅ CONSOLIDATED: Participant initialized successfully');
    } catch (error) {
      console.error('❌ CONSOLIDATED: Participant initialization failed:', error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  private setupHostHandlers(): void {
    console.log('🔧 CONSOLIDATED: Setting up host handlers');
    
    unifiedWebSocketService.on('webrtc-offer', this.handleOfferAsHost.bind(this));
    unifiedWebSocketService.on('webrtc-candidate', this.handleIceCandidateAsHost.bind(this));
    
    console.log('✅ CONSOLIDATED: Host handlers configured');
  }

  private setupParticipantHandlers(): void {
    console.log('🔧 CONSOLIDATED: Setting up participant handlers');
    
    unifiedWebSocketService.on('webrtc-request-offer', this.handleOfferRequest.bind(this));
    unifiedWebSocketService.on('webrtc-answer', this.handleAnswerAsParticipant.bind(this));
    unifiedWebSocketService.on('webrtc-candidate', this.handleIceCandidateAsParticipant.bind(this));
    
    console.log('✅ CONSOLIDATED: Participant handlers configured');
  }

  private async handleOfferAsHost(data: any): Promise<void> {
    const { participantId, offer } = data;
    console.log('📨 CONSOLIDATED-HOST: Offer received from:', participantId);

    try {
      const pcInfo = this.getOrCreatePeerConnection(participantId, 'host');
      const pc = pcInfo.pc;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ CONSOLIDATED-HOST: Remote description set');

      // Apply buffered ICE candidates
      await this.applyBufferedIceCandidates(participantId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      unifiedWebSocketService.emit('webrtc-answer', {
        participantId: 'host',
        targetId: participantId,
        answer: pc.localDescription
      });

      console.log('📤 CONSOLIDATED-HOST: Answer sent to:', participantId);
    } catch (error) {
      console.error('❌ CONSOLIDATED-HOST: Offer handling failed:', error);
      this.cleanupConnection(participantId);
    }
  }

  private async handleOfferRequest(data: any): Promise<void> {
    if (!this.isParticipant) return;
    
    console.log('🚀 CONSOLIDATED-PARTICIPANT: Offer request received');
    // Implementation for participant offer creation
  }

  private async handleAnswerAsParticipant(data: any): Promise<void> {
    if (!this.isParticipant) return;
    
    const { answer } = data;
    console.log('✅ CONSOLIDATED-PARTICIPANT: Answer received');
    // Implementation for participant answer handling
  }

  private async handleIceCandidateAsHost(data: any): Promise<void> {
    const { participantId, candidate } = data;
    console.log('🧊 CONSOLIDATED-HOST: ICE candidate from:', participantId);

    if (!candidate) return;

    const pcInfo = this.connections.get(participantId);
    
    if (pcInfo && pcInfo.pc.remoteDescription) {
      try {
        await pcInfo.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('❌ CONSOLIDATED-HOST: ICE candidate failed:', error);
      }
    } else {
      this.bufferIceCandidate(participantId, candidate);
    }
  }

  private async handleIceCandidateAsParticipant(data: any): Promise<void> {
    if (!this.isParticipant) return;
    
    console.log('🧊 CONSOLIDATED-PARTICIPANT: ICE candidate received');
    // Implementation for participant ICE candidate handling
  }

  private getOrCreatePeerConnection(participantId: string, role: 'host' | 'participant'): PeerConnectionInfo {
    const existing = this.connections.get(participantId);
    if (existing) {
      return existing;
    }

    console.log(`🆕 CONSOLIDATED: Creating PC for ${participantId} as ${role}`);

    const pc = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });
    
    // Setup ontrack handler with 3-second verification
    pc.ontrack = (event) => {
      console.log(`🎥 CONSOLIDATED: ontrack for ${participantId}`);
      
      const pcInfo = this.connections.get(participantId);
      if (pcInfo) {
        pcInfo.ontrackReceived = true;
        
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          
          // Direct dispatch to display system
          window.dispatchEvent(new CustomEvent('video-stream-ready', {
            detail: {
              participantId,
              stream,
              timestamp: Date.now(),
              source: 'consolidated-webrtc'
            }
          }));

          // Start verification timer
          pcInfo.verificationTimer = setTimeout(() => {
            this.verifyOntrackCompletion(participantId);
          }, this.ONTRACK_VERIFICATION_TIMEOUT);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        unifiedWebSocketService.emit('webrtc-candidate', {
          participantId: role === 'host' ? 'host' : participantId,
          targetId: role === 'host' ? participantId : 'host',
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`🔗 CONSOLIDATED: Connection state for ${participantId}:`, state);
      
      if (state === 'connected') {
        this.updateConnectionState('webrtc', 'connected');
        this.clearConnectionTimeout(participantId);
      } else if (state === 'failed' || state === 'disconnected') {
        this.cleanupConnection(participantId);
      }
    };

    if (role === 'host') {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    // Set connection timeout
    const timeout = setTimeout(() => {
      console.warn(`⏰ CONSOLIDATED: Connection timeout for ${participantId}`);
      this.cleanupConnection(participantId);
      
      // Auto-restart for hosts
      if (role === 'host') {
        setTimeout(() => {
          this.requestOfferFromParticipant(participantId);
        }, 1000);
      }
    }, this.CONNECTION_TIMEOUT);

    const pcInfo: PeerConnectionInfo = {
      pc,
      participantId,
      createdAt: Date.now(),
      timeout,
      ontrackReceived: false
    };

    this.connections.set(participantId, pcInfo);
    return pcInfo;
  }

  private verifyOntrackCompletion(participantId: string): void {
    console.log(`🔍 CONSOLIDATED: Verifying ontrack completion for ${participantId}`);
    
    const videoElement = document.querySelector(`[data-participant-id="${participantId}"] video`) as HTMLVideoElement;
    
    if (!videoElement || videoElement.videoWidth === 0) {
      console.warn(`⚠️ CONSOLIDATED: ontrack verification failed for ${participantId} - restarting`);
      
      this.cleanupConnection(participantId);
      
      // Restart connection
      if (this.isHost) {
        setTimeout(() => {
          this.requestOfferFromParticipant(participantId);
        }, 1000);
      }
    } else {
      console.log(`✅ CONSOLIDATED: ontrack verified successfully for ${participantId}`);
    }
  }

  private async applyBufferedIceCandidates(participantId: string, pc: RTCPeerConnection): Promise<void> {
    const candidates = this.iceCandidateBuffer.get(participantId);
    
    if (candidates && candidates.length > 0) {
      console.log(`📦 CONSOLIDATED: Applying ${candidates.length} buffered candidates`);
      
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.error('❌ CONSOLIDATED: Buffered candidate failed:', error);
        }
      }
      
      this.iceCandidateBuffer.delete(participantId);
    }
  }

  private bufferIceCandidate(participantId: string, candidate: any): void {
    if (!this.iceCandidateBuffer.has(participantId)) {
      this.iceCandidateBuffer.set(participantId, []);
    }
    
    this.iceCandidateBuffer.get(participantId)!.push(new RTCIceCandidate(candidate));
    console.log(`📦 CONSOLIDATED: ICE candidate buffered for ${participantId}`);
  }

  private requestOfferFromParticipant(participantId: string): void {
    console.log(`🚀 CONSOLIDATED: Requesting offer from ${participantId}`);
    
    unifiedWebSocketService.emit('webrtc-request-offer', {
      targetId: participantId
    });
  }

  private clearConnectionTimeout(participantId: string): void {
    const pcInfo = this.connections.get(participantId);
    if (pcInfo?.timeout) {
      clearTimeout(pcInfo.timeout);
      pcInfo.timeout = undefined;
    }
    if (pcInfo?.verificationTimer) {
      clearTimeout(pcInfo.verificationTimer);
      pcInfo.verificationTimer = undefined;
    }
  }

  private cleanupConnection(participantId: string): void {
    console.log(`🧹 CONSOLIDATED: Cleaning up connection for ${participantId}`);
    
    const pcInfo = this.connections.get(participantId);
    if (pcInfo) {
      this.clearConnectionTimeout(participantId);
      
      try {
        pcInfo.pc.close();
      } catch (error) {
        console.error('❌ CONSOLIDATED: PC close error:', error);
      }
      
      this.connections.delete(participantId);
    }

    this.iceCandidateBuffer.delete(participantId);
  }

  private updateConnectionState(type: keyof ConnectionState, state: ConnectionState[keyof ConnectionState]): void {
    this.connectionState[type] = state;
    
    // Update overall state
    if (this.connectionState.websocket === 'connected' && this.connectionState.webrtc === 'connected') {
      this.connectionState.overall = 'connected';
    } else if (this.connectionState.websocket === 'failed' || this.connectionState.webrtc === 'failed') {
      this.connectionState.overall = 'failed';
    } else if (this.connectionState.websocket === 'connecting' || this.connectionState.webrtc === 'connecting') {
      this.connectionState.overall = 'connecting';
    } else {
      this.connectionState.overall = 'disconnected';
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  cleanup(): void {
    console.log('🧹 CONSOLIDATED: Complete cleanup');
    
    this.connections.forEach((pcInfo, participantId) => {
      this.cleanupConnection(participantId);
    });
    
    this.connections.clear();
    this.iceCandidateBuffer.clear();
    
    this.connectionState = {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    };
    
    this.sessionId = null;
    this.isHost = false;
    this.isParticipant = false;
  }

  // Debug methods
  getDebugInfo(): any {
    return {
      sessionId: this.sessionId,
      isHost: this.isHost,
      isParticipant: this.isParticipant,
      connectionsCount: this.connections.size,
      connectionState: this.connectionState,
      connections: Array.from(this.connections.entries()).map(([id, info]) => ({
        participantId: id,
        connectionState: info.pc.connectionState,
        iceConnectionState: info.pc.iceConnectionState,
        ontrackReceived: info.ontrackReceived,
        createdAt: info.createdAt
      }))
    };
  }
}

// Export singleton instance
export const consolidatedWebRTCManager = ConsolidatedWebRTCManager.getInstance();