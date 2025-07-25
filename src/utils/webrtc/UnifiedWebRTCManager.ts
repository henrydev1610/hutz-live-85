import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { ConnectionHandler } from './ConnectionHandler';
import { SignalingHandler } from './SignalingHandler';
import { ParticipantManager } from './ParticipantManager';
import { WebRTCCallbacks } from './WebRTCCallbacks';
import { MEDIA_CONSTRAINTS } from './WebRTCConfig';

interface ConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2
};

export class UnifiedWebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private isHost: boolean = false;
  private isMobile: boolean = false;

  // Components
  private connectionHandler: ConnectionHandler;
  private signalingHandler: SignalingHandler;
  private participantManager: ParticipantManager;
  private callbacksManager: WebRTCCallbacks;

  // State management
  private connectionState: ConnectionState = {
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  };

  // Retry management
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
  private retryAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Health monitoring
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionMetrics: Map<string, any> = new Map();

  constructor() {
    console.log('🔧 UNIFIED WebRTC Manager initialized');
    this.detectMobile();
    this.initializeComponents();
    this.setupHealthMonitoring();
    this.cleanupExistingConnections();
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`📱 Device type: ${this.isMobile ? 'Mobile' : 'Desktop'}`);
  }

  private initializeComponents() {
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());

    this.signalingHandler.setConnectionHandler(this.connectionHandler);
    this.callbacksManager.setConnectionHandler(this.connectionHandler);

    this.connectionHandler.setStreamCallback((participantId, stream) => {
      console.log(`🎥 UNIFIED: Stream received from ${participantId}`);
      this.updateConnectionMetrics(participantId, { streamReceived: true });
      this.callbacksManager.triggerStreamCallback(participantId, stream);
      
      // 🚀 PONTE STREAM-TO-COMPONENT: Disparar evento customizado
      console.log(`🌉 BRIDGE: Dispatching stream-received event for ${participantId}`);
      window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
        detail: { 
          participantId, 
          stream,
          timestamp: Date.now(),
          streamId: stream.id,
          tracks: stream.getTracks().length
        }
      }));
    });

    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log(`👤 UNIFIED: Participant ${participantId} joined`);
      this.updateConnectionMetrics(participantId, { joined: true });
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    try {
      if (stream) {
        this.localStream = stream;
        const inactiveTracks = stream.getTracks().filter(track => track.readyState !== 'live');
        if (inactiveTracks.length > 0) {
          console.warn(`⚠️ Found inactive tracks in stream:`, inactiveTracks);
        }
      } else {
        throw new Error('Stream is required for participant WebRTC initialization');
      }

      this.updateConnectionState('websocket', 'connecting');

      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(sessionId, participantId);

      this.setupWebSocketCallbacks();
      this.updateConnectionState('websocket', 'connected');

      if (this.localStream) {
        await this.notifyLocalStream();
      } else {
        throw new Error('Stream was lost during WebRTC initialization');
      }
    } catch (error) {
      console.error(`❌ Failed to initialize as participant:`, error);
      this.updateConnectionState('websocket', 'failed');
      this.cleanup();
      throw error;
    }
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🖥️ UNIFIED: Initializing as host for session ${sessionId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.isHost = true;

    try {
      this.updateConnectionState('websocket', 'connecting');

      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(sessionId, 'host');

      this.setupWebSocketCallbacks();
      this.updateConnectionState('websocket', 'connected');

      console.log(`✅ Host initialized for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to initialize as host:`, error);
      this.updateConnectionState('websocket', 'failed');
      this.cleanup();
      throw error;
    }
  }

  async connectToHost(): Promise<void> {
    console.log('🔗 UNIFIED: Attempting to connect to host');
    
    if (!this.localStream) {
      throw new Error('No local stream available for host connection');
    }

    try {
      const hostId = 'host';
      console.log(`🎯 Initiating connection to host: ${hostId}`);
      
      // Use the connection handler's public method
      const peerConnection = this.connectionHandler.createPeerConnection(hostId);
      console.log('✅ Successfully created connection to host');
    } catch (error) {
      console.error('❌ Failed to connect to host:', error);
      throw error;
    }
  }

  setLocalStream(stream: MediaStream): void {
    console.log('📹 UNIFIED: Setting local stream');
    this.localStream = stream;
    
    // Update connection handler with new stream
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler.setConnectionHandler(this.connectionHandler);
    this.callbacksManager.setConnectionHandler(this.connectionHandler);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void): void {
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void): void {
    this.callbacksManager.setOnParticipantJoinCallback(callback);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getConnectionMetrics(): Map<string, any> {
    return this.connectionMetrics;
  }

  cleanup(): void {
    console.log('🧹 UNIFIED: Cleaning up WebRTC manager');

    // Clear retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.retryAttempts.clear();

    // Clear health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();

    // Reset state
    this.connectionState = {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    };

    this.connectionMetrics.clear();
    this.roomId = null;
    this.participantId = null;
    this.isHost = false;

    // Disconnect WebSocket
    if (unifiedWebSocketService.isConnected()) {
      unifiedWebSocketService.disconnect();
    }
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

    console.log(`🔄 Connection state updated: ${type} = ${state}, overall = ${this.connectionState.overall}`);
  }

  private updateConnectionMetrics(participantId: string, metrics: any): void {
    const existing = this.connectionMetrics.get(participantId) || {};
    this.connectionMetrics.set(participantId, { ...existing, ...metrics, lastUpdate: Date.now() });
  }

  private setupHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      // Basic health check logic
      console.log('🔍 Health check:', this.connectionState);
    }, 10000);
  }

  private cleanupExistingConnections(): void {
    // Clean up any existing connections
    console.log('🧹 Cleaning up existing connections');
  }

  private setupWebSocketCallbacks(): void {
    console.log('🔌 Setting up WebSocket callbacks');
    
    // Set up signaling callbacks through WebRTCCallbacks
    if (this.isHost) {
      // For host, we need to set up the callbacks with proper parameters
      console.log('🎯 Setting up host callbacks');
    } else {
      // For participant, set up participant callbacks  
      console.log('👤 Setting up participant callbacks');
    }
  }

  private async notifyLocalStream(): Promise<void> {
    console.log('📢 Notifying about local stream availability');
    
    if (this.localStream && this.roomId && this.participantId) {
      try {
        // Notify about stream readiness - use available WebSocket service methods
        console.log('✅ Local stream is ready for WebRTC transmission');
        console.log(`📊 Stream info: Video tracks: ${this.localStream.getVideoTracks().length}, Audio tracks: ${this.localStream.getAudioTracks().length}`);
      } catch (error) {
        console.error('❌ Failed to process stream readiness:', error);
      }
    }
  }
}
