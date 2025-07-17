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
    
    // Link signaling handler with connection handler
    this.signalingHandler.setConnectionHandler(this.connectionHandler);
    
    // Setup stream callback chain - RULE 2: Host reception
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      console.log(`🎥 UNIFIED: Stream received from ${participantId}`);
      
      // RULE 2: Create MediaStream for host reception  
      const remoteStream = new MediaStream();
      stream.getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      
      console.log(`📡 Host recebeu track ${stream.getVideoTracks()[0]?.kind} de participante`);
      
      this.updateConnectionMetrics(participantId, { streamReceived: true });
      this.callbacksManager.triggerStreamCallback(participantId, remoteStream);
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log(`👤 UNIFIED: Participant ${participantId} joined`);
      this.updateConnectionMetrics(participantId, { joined: true });
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  private setupHealthMonitoring() {
    // Aggressive health monitoring for mobile connections
    const healthCheckInterval = this.isMobile ? 2000 : 5000; // 2s for mobile, 5s for desktop
    console.log(`🏥 HEALTH MONITOR: Using ${healthCheckInterval}ms intervals for ${this.isMobile ? 'mobile' : 'desktop'} device`);
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, healthCheckInterval);
  }

  private performHealthCheck() {
    // Check WebSocket connection
    if (unifiedWebSocketService.isConnected()) {
      this.updateConnectionState('websocket', 'connected');
    } else {
      // Only update to failed if we have the necessary IDs for reconnection
      if (this.roomId && this.participantId) {
        this.updateConnectionState('websocket', 'failed');
        this.handleWebSocketFailure();
      } else {
        // If we don't have IDs, just mark as disconnected, not failed
        this.updateConnectionState('websocket', 'disconnected');
      }
    }

    // Enhanced WebRTC peer connection monitoring
    let hasActiveConnections = false;
    let hasFailedConnections = false;
    
    this.peerConnections.forEach((pc, participantId) => {
      const connectionState = pc.connectionState;
      const iceConnectionState = pc.iceConnectionState;
      
      console.log(`🔍 HEALTH CHECK: ${participantId} - Connection: ${connectionState}, ICE: ${iceConnectionState}`);
      
      if (connectionState === 'connected' && 
          (iceConnectionState === 'connected' || iceConnectionState === 'completed')) {
        hasActiveConnections = true;
        this.updateConnectionMetrics(participantId, { 
          connectionState, 
          iceConnectionState, 
          lastHealthCheck: Date.now(),
          healthy: true 
        });
      } else if (connectionState === 'failed' || iceConnectionState === 'failed') {
        hasFailedConnections = true;
        console.log(`🔄 HEALTH CHECK: Connection failed for ${participantId}, initiating recovery`);
        this.handlePeerConnectionFailure(participantId);
      } else if (connectionState === 'disconnected' && iceConnectionState === 'disconnected') {
        console.log(`⚠️ HEALTH CHECK: Connection disconnected for ${participantId}, attempting reconnection`);
        this.handlePeerConnectionFailure(participantId);
      }
    });

    // Update WebRTC connection state
    if (hasActiveConnections) {
      this.updateConnectionState('webrtc', 'connected');
    } else if (hasFailedConnections || this.peerConnections.size > 0) {
      this.updateConnectionState('webrtc', 'failed');
    } else {
      this.updateConnectionState('webrtc', 'disconnected');
    }
    
    // Log overall health status
    console.log(`🏥 HEALTH REPORT: WebSocket: ${this.connectionState.websocket}, WebRTC: ${this.connectionState.webrtc}, Overall: ${this.connectionState.overall}`);
  }

  private updateConnectionState(component: keyof ConnectionState, state: ConnectionState['websocket']) {
    if (component === 'overall') return;
    
    this.connectionState[component] = state;
    
    // Calculate overall state
    if (this.connectionState.websocket === 'connected' && 
        (this.connectionState.webrtc === 'connected' || this.peerConnections.size === 0)) {
      this.connectionState.overall = 'connected';
    } else if (this.connectionState.websocket === 'connecting' || this.connectionState.webrtc === 'connecting') {
      this.connectionState.overall = 'connecting';
    } else if (this.connectionState.websocket === 'failed' || this.connectionState.webrtc === 'failed') {
      this.connectionState.overall = 'failed';
    } else {
      this.connectionState.overall = 'disconnected';
    }
    
    console.log(`📊 Connection state updated:`, this.connectionState);
  }

  private async handleWebSocketFailure() {
    // Only attempt reconnection if we have the necessary IDs
    if (!this.roomId || !this.participantId) {
      console.warn('⚠️ WebSocket failure detected but missing IDs for reconnection');
      console.log(`🔍 FAILURE STATE: roomId=${this.roomId}, participantId=${this.participantId}`);
      return;
    }
    
    console.log('🔄 WebSocket connection failed, attempting recovery...');
    
    try {
      await this.reconnectWebSocket();
    } catch (error) {
      console.error('❌ WebSocket recovery failed:', error);
    }
  }

  private async reconnectWebSocket() {
    if (!this.roomId || !this.participantId) {
      console.warn('⚠️ RECONNECT: Missing room or participant ID, skipping reconnection');
      console.log(`🔍 RECONNECT STATE: roomId=${this.roomId}, participantId=${this.participantId}`);
      return;
    }

    console.log(`🔄 RECONNECT: Attempting with roomId=${this.roomId}, participantId=${this.participantId}`);
    this.updateConnectionState('websocket', 'connecting');
    
    try {
      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(this.roomId, this.participantId);
      
      // Re-setup callbacks
      this.setupWebSocketCallbacks();
      
      console.log('✅ WebSocket reconnected successfully');
      this.updateConnectionState('websocket', 'connected');
      
      // Only trigger WebRTC reconnection if we have valid connections
      if (this.peerConnections.size > 0) {
        this.peerConnections.forEach((_, participantId) => {
          this.initiateConnectionRecovery(participantId);
        });
      }
      
    } catch (error) {
      console.error('❌ WebSocket reconnection failed:', error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  private handlePeerConnectionFailure(participantId: string) {
    console.log(`🔄 Handling peer connection failure for ${participantId}`);
    
    // Clean up failed connection
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
    }
    
    // Attempt recovery
    this.initiateConnectionRecovery(participantId);
  }

  private async initiateConnectionRecovery(participantId: string) {
    const currentAttempts = this.retryAttempts.get(participantId) || 0;
    
    if (currentAttempts >= this.retryConfig.maxRetries) {
      console.error(`❌ Max retry attempts reached for ${participantId}`);
      return;
    }

    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.multiplier, currentAttempts),
      this.retryConfig.maxDelay
    );
    
    console.log(`🔄 Scheduling recovery for ${participantId} (attempt ${currentAttempts + 1}/${this.retryConfig.maxRetries}) in ${delay}ms`);
    
    const timeout = setTimeout(async () => {
      this.retryAttempts.set(participantId, currentAttempts + 1);
      
      try {
        await this.connectionHandler.initiateCallWithRetry(participantId, 1);
        this.retryAttempts.delete(participantId); // Success - reset counter
        console.log(`✅ Recovery successful for ${participantId}`);
      } catch (error) {
        console.error(`❌ Recovery failed for ${participantId}:`, error);
        this.initiateConnectionRecovery(participantId); // Try again
      }
    }, delay);
    
    this.retryTimeouts.set(participantId, timeout);
  }

  private updateConnectionMetrics(participantId: string, metrics: any) {
    const existing = this.connectionMetrics.get(participantId) || {};
    this.connectionMetrics.set(participantId, {
      ...existing,
      ...metrics,
      lastUpdate: Date.now()
    });
  }

  private setupWebSocketCallbacks() {
    if (this.isHost) {
      this.callbacksManager.setupHostCallbacks(
        (data) => {
          console.log(`👤 UNIFIED HOST: New participant connected:`, data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.addParticipant(participantId, data);
          this.callbacksManager.triggerParticipantJoinCallback(participantId);
          this.connectionHandler.startHeartbeat(participantId);
        },
        (data) => {
          console.log(`👤 UNIFIED HOST: Participant disconnected:`, data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.removeParticipant(participantId);
          this.removeParticipantConnection(participantId);
        },
        (participants) => {
          console.log(`👥 UNIFIED HOST: Participants updated:`, participants);
          this.participantManager.updateParticipantsList(participants);
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );
    } else {
      this.callbacksManager.setupParticipantCallbacks(
        this.participantId!,
        (data) => {
          console.log(`🏠 UNIFIED PARTICIPANT: Host or participant connected:`, data);
          const hostId = data.userId || data.id || data.socketId;
          // CRITICAL: Always try to connect to static "host" ID
          if (hostId !== this.participantId && (hostId === "host" || hostId.includes("host"))) {
            console.log(`📞 UNIFIED: Initiating call to host: ${hostId}`);
            this.connectionHandler.initiateCallWithRetry("host"); // Always use static "host"
          }
        },
        (participants) => {
          console.log(`👥 UNIFIED PARTICIPANT: Participants updated:`, participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== this.participantId && !this.peerConnections.has(pId)) {
              console.log(`📞 UNIFIED: Connecting to existing participant ${pId}`);
              this.connectionHandler.initiateCallWithRetry(pId);
            }
          });
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );
    }
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 UNIFIED: Initializing as host for session: ${sessionId}`);
    this.roomId = sessionId;
    this.participantId = `host-${Date.now()}`;
    this.isHost = true;

    try {
      console.log('🔍 HOST: Checking WebSocket connection before join...');
      
      if (!unifiedWebSocketService.isConnected()) {
        console.log('🔗 HOST: Connecting to WebSocket...');
        this.updateConnectionState('websocket', 'connecting');
        await unifiedWebSocketService.connect();
      }
      
      console.log('🚪 HOST: Joining room...');
      this.setupWebSocketCallbacks();
      await unifiedWebSocketService.joinRoom(sessionId, this.participantId);
      
      this.updateConnectionState('websocket', 'connected');
      console.log(`✅ UNIFIED HOST: Connected to signaling server`);
      
    } catch (error) {
      console.error(`❌ UNIFIED HOST: Failed to initialize:`, error);
      this.updateConnectionState('websocket', 'failed');
      
      // Auto-reconnection with error toast
      if (error.message.includes("timeout")) {
        console.log('🔄 HOST: Attempting auto-reconnection in 3s...');
        setTimeout(() => {
          this.initializeAsHost(sessionId);
        }, 3000);
      }
      
      throw error;
    }
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId}`);
    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    try {
      // IMPORTANT: Only use stream provided by useParticipantMedia - no local media creation
      if (stream) {
        this.localStream = stream;
        console.log(`📹 UNIFIED: Using provided stream from useParticipantMedia:`, {
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoSettings: stream.getVideoTracks()[0]?.getSettings()
        });
      } else {
        console.warn(`⚠️ UNIFIED: No stream provided - participant must initialize media first`);
      }

      this.updateConnectionState('websocket', 'connecting');
      await unifiedWebSocketService.connect();
      this.setupWebSocketCallbacks();
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      
      this.updateConnectionState('websocket', 'connected');
      console.log(`✅ UNIFIED PARTICIPANT: Connected to signaling server`);
      
      // CRITICAL: Strategic delay for mobile stability and WebSocket confirmation
      const stabilizationDelay = this.isMobile ? 2000 : 1000;
      console.log(`⏳ STABILIZATION: Waiting ${stabilizationDelay}ms for connection stability...`);
      await new Promise(resolve => setTimeout(resolve, stabilizationDelay));
      
      // Notify stream if available
      if (this.localStream) {
        await this.notifyLocalStream();
        
      // ✅ CRITICAL: Garantir que RTCPeerConnection esteja pronto antes de adicionar tracks
        setTimeout(() => {
          this.peerConnections.forEach((pc, peerId) => {
            if (this.localStream && pc.connectionState !== 'closed') {
              const tracks = this.localStream.getTracks();
              console.log(`🎯 Adicionando ${tracks.length} tracks para ${peerId}`);

              tracks.forEach(track => {
                try {
                  // Check if track already exists to avoid duplicate
                  const existingSenders = pc.getSenders();
                  const trackExists = existingSenders.some(sender => sender.track === track);
                  
                  if (!trackExists) {
                    pc.addTrack(track, this.localStream!);
                    console.log(`✅ Track ${track.kind} enviada para ${peerId}`);
                  } else {
                    console.log(`🔄 Track ${track.kind} já existe para ${peerId}`);
                  }
                } catch (err) {
                  console.warn(`⚠️ Erro ao adicionar track para ${peerId}:`, err);
                }
              });
            }
          });
        }, 1000); // Delay para garantir conexão
      }
      
      // CRITICAL: Start connection monitoring and auto-connect logic
      this.startConnectionInitiationTimer();
      this.setupConnectionTimeouts();
      
    } catch (error) {
      console.error(`❌ UNIFIED PARTICIPANT: Failed to initialize:`, error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  private async notifyLocalStream() {
    if (!this.localStream || !this.participantId) return;

    // Wait for mobile devices to stabilize
    if (this.isMobile) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const streamInfo = {
      streamId: this.localStream.id,
      trackCount: this.localStream.getTracks().length,
      hasVideo: this.localStream.getVideoTracks().length > 0,
      hasAudio: this.localStream.getAudioTracks().length > 0,
      isMobile: this.isMobile,
      connectionType: 'unified'
    };
    
    unifiedWebSocketService.notifyStreamStarted(this.participantId, streamInfo);
    console.log(`📡 UNIFIED: Stream notification sent`);
    
    // ✅ CRÍTICO: Notificação extra via WebSocket para garantir que o host saiba
    unifiedWebSocketService.sendCustomEvent('stream-ready', {
      participantId: this.participantId,
      streamId: this.localStream.id,
      timestamp: Date.now(),
      trackCount: this.localStream.getTracks().length,
      hasVideo: this.localStream.getVideoTracks().length > 0
    });
    console.log(`🚀 STREAM-READY event sent for participant ${this.participantId}`);
  }

  private removeParticipantConnection(participantId: string) {
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
    }
    
    // Clean up retry attempts
    this.retryAttempts.delete(participantId);
    const timeout = this.retryTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(participantId);
    }
    
    this.connectionHandler.clearRetries(participantId);
    this.connectionHandler.clearHeartbeat(participantId);
    this.connectionMetrics.delete(participantId);
  }

  // CRITICAL FIX: Immediate stream transmission
  setOutgoingStream(stream: MediaStream) {
    console.log(`🚀 FIXED: Setting outgoing stream for transmission`, {
      streamId: stream.id,
      tracks: stream.getTracks().length
    });
    
    this.localStream = stream;
    
    // IMMEDIATE: Add to ALL peer connections RIGHT NOW
    this.peerConnections.forEach((pc, peerId) => {
      if (pc.connectionState !== 'closed') {
        console.log(`📤 IMMEDIATE: Adding tracks to ${peerId}`);
        
        stream.getTracks().forEach(track => {
          try {
            // Remove existing tracks first to avoid conflicts
            const existingSenders = pc.getSenders();
            existingSenders.forEach(sender => {
              if (sender.track && sender.track.kind === track.kind) {
                pc.removeTrack(sender);
              }
            });
            
            // Add new track
            pc.addTrack(track, stream);
            console.log(`✅ IMMEDIATE: ${track.kind} track added to ${peerId}`);
          } catch (error) {
            console.warn(`⚠️ Track add error for ${peerId}:`, error);
          }
        });
      }
    });
    
    // EMIT stream-ready event immediately
    if (this.roomId) {
      unifiedWebSocketService.sendCustomEvent('stream-ready', {
        roomId: this.roomId,
        participantId: this.participantId,
        streamId: stream.id,
        tracks: stream.getTracks().length
      });
      console.log(`📡 IMMEDIATE: Emitted stream-ready for room ${this.roomId}`);
    }
  }

  // Public API methods
  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    console.log('📞 UNIFIED: Setting stream callback');
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    console.log('👤 UNIFIED: Setting participant join callback');
    this.callbacksManager.setOnParticipantJoinCallback(callback);
    this.participantManager.setOnParticipantJoinCallback(callback);
  }

  getParticipants() {
    return this.participantManager.getParticipants();
  }

  selectParticipant(participantId: string) {
    this.participantManager.selectParticipant(participantId);
  }

  getConnectionState() {
    return { ...this.connectionState };
  }

  getConnectionMetrics() {
    return new Map(this.connectionMetrics);
  }

  getPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections);
  }

  // CRITICAL: Force connection attempt for specific participant
  async forceParticipantConnection(participantId: string): Promise<void> {
    console.log(`🔧 FORCE CONNECTION: Attempting connection for ${participantId}`);
    
    // Clean up existing connection if any
    const existingConnection = this.peerConnections.get(participantId);
    if (existingConnection) {
      console.log(`🧹 FORCE CONNECTION: Cleaning up existing connection for ${participantId}`);
      existingConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    // Force new connection attempt
    try {
      await this.connectionHandler.initiateCallWithRetry(participantId, 3);
      console.log(`✅ FORCE CONNECTION: Successfully initiated for ${participantId}`);
    } catch (error) {
      console.error(`❌ FORCE CONNECTION: Failed for ${participantId}:`, error);
      throw error;
    }
  }

  // CRITICAL: Force reconnection for all participants
  async forceReconnectAll(): Promise<void> {
    console.log('🔧 FORCE RECONNECT: Attempting reconnection for all participants');
    
    const participantIds = Array.from(this.peerConnections.keys());
    
    for (const participantId of participantIds) {
      try {
        await this.forceParticipantConnection(participantId);
        // Wait a bit between connections to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ FORCE RECONNECT: Failed for ${participantId}:`, error);
      }
    }
  }

  // CRITICAL: Start connection initiation timer for participants
  private startConnectionInitiationTimer() {
    if (this.isHost) return; // Only for participants
    
    console.log('🕐 INITIATION TIMER: Starting connection initiation monitoring...');
    
    // Progressive connection attempts with exponential backoff
    const attemptConnection = (attempt: number = 1) => {
      const maxAttempts = 5;
      const baseDelay = 3000; // Start checking after 3 seconds
      
      if (attempt > maxAttempts) {
        console.error('❌ INITIATION TIMER: Max connection attempts reached');
        return;
      }
      
      const delay = baseDelay * Math.pow(1.5, attempt - 1);
      
      setTimeout(() => {
        console.log(`🔍 INITIATION TIMER: Connection check attempt ${attempt}/${maxAttempts}`);
        
        // Check if we have any active WebRTC connections
        let hasActiveConnections = false;
        this.peerConnections.forEach((pc, participantId) => {
          if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
            hasActiveConnections = true;
          }
        });
        
        if (!hasActiveConnections && unifiedWebSocketService.isConnected()) {
          console.log(`🚀 INITIATION TIMER: No active connections detected, triggering auto-connect...`);
          this.initiateAutoConnection();
        }
        
        // Schedule next attempt
        if (attempt < maxAttempts) {
          attemptConnection(attempt + 1);
        }
      }, delay);
    };
    
    attemptConnection();
  }
  
  // CRITICAL: Auto-connection initiation for participants
  private async initiateAutoConnection() {
    try {
      console.log('🔄 AUTO-CONNECT: Attempting to establish WebRTC connections...');
      
      // Try to connect to host first
      const hostId = `host-${this.roomId}`;
      console.log(`📞 AUTO-CONNECT: Attempting connection to potential host: ${hostId}`);
      
      try {
        await this.connectionHandler.initiateCallWithRetry(hostId, 2);
      } catch (error) {
        console.log(`⚠️ AUTO-CONNECT: Failed to connect to ${hostId}, trying generic host connection`);
        
        // Fallback: try to connect using a generic host identifier
        const genericHostId = 'host';
        await this.connectionHandler.initiateCallWithRetry(genericHostId, 2);
      }
      
    } catch (error) {
      console.error('❌ AUTO-CONNECT: Failed to establish connection:', error);
    }
  }

  // CRITICAL: Test connection functionality
  async testConnection(): Promise<boolean> {
    console.log('🧪 TEST CONNECTION: Starting connection test');
    
    try {
      // Test WebSocket connection
      if (!this.roomId || !this.participantId) {
        console.error('❌ TEST CONNECTION: Missing room or participant ID');
        return false;
      }
      
      // Test signaling server connection
      const isWebSocketHealthy = await this.testWebSocketConnection();
      if (!isWebSocketHealthy) {
        console.error('❌ TEST CONNECTION: WebSocket test failed');
        return false;
      }
      
      // Test peer connections
      const arePeerConnectionsHealthy = this.testPeerConnections();
      if (!arePeerConnectionsHealthy) {
        console.error('❌ TEST CONNECTION: Peer connections test failed');
        return false;
      }
      
      console.log('✅ TEST CONNECTION: All tests passed');
      return true;
      
    } catch (error) {
      console.error('❌ TEST CONNECTION: Test failed:', error);
      return false;
    }
  }

  private async testWebSocketConnection(): Promise<boolean> {
    try {
      if (!unifiedWebSocketService.isConnected()) {
        console.log('🔄 TEST CONNECTION: WebSocket not connected, attempting reconnection');
        await unifiedWebSocketService.connect();
      }
      
      const healthCheck = await unifiedWebSocketService.healthCheck();
      console.log('🧪 TEST CONNECTION: WebSocket health check result:', healthCheck);
      
      return healthCheck;
    } catch (error) {
      console.error('❌ TEST CONNECTION: WebSocket test failed:', error);
      return false;
    }
  }

  private testPeerConnections(): boolean {
    let healthyConnections = 0;
    let totalConnections = this.peerConnections.size;
    
    this.peerConnections.forEach((pc, participantId) => {
      const isHealthy = pc.connectionState === 'connected' && 
                       pc.iceConnectionState === 'connected';
      
      console.log(`🧪 TEST CONNECTION: ${participantId} - ${isHealthy ? 'healthy' : 'unhealthy'}`, {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState
      });
      
      if (isHealthy) {
        healthyConnections++;
      }
    });
    
    // If we have connections, at least 50% should be healthy
    if (totalConnections > 0) {
      const healthRatio = healthyConnections / totalConnections;
      console.log(`🧪 TEST CONNECTION: Health ratio: ${healthRatio} (${healthyConnections}/${totalConnections})`);
      return healthRatio >= 0.5;
    }
    
    // If no connections, that's okay for host
    return true;
  }

  // CRITICAL: Enhanced connection timeout monitoring
  private setupConnectionTimeouts() {
    if (this.isHost) return; // Only for participants
    
    console.log('⏱️ TIMEOUT MONITOR: Setting up connection timeout monitoring...');
    
    // WebRTC negotiation timeout (30 seconds)
    setTimeout(() => {
      let hasSuccessfulConnections = false;
      this.peerConnections.forEach((pc) => {
        if (pc.connectionState === 'connected') {
          hasSuccessfulConnections = true;
        }
      });
      
      if (!hasSuccessfulConnections && this.peerConnections.size > 0) {
        console.warn('⚠️ TIMEOUT MONITOR: WebRTC negotiation timeout detected, forcing reconnection...');
        this.forceReconnectAll();
      }
    }, 30000);
  }

  cleanup() {
    console.log(`🧹 UNIFIED: Cleaning up WebRTC manager`);
    
    // Clear health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.retryAttempts.clear();
    
    // Close peer connections
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`Closing peer connection for ${participantId}`);
      pc.close();
    });
    this.peerConnections.clear();
    
    // Cleanup components
    this.connectionHandler.cleanup();
    this.participantManager.cleanup();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }
    
    // Disconnect WebSocket
    unifiedWebSocketService.disconnect();
    
    // Reset state
    this.roomId = null;
    this.participantId = null;
    this.isHost = false;
    this.connectionState = {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    };
    this.connectionMetrics.clear();
    
    console.log(`✅ UNIFIED: Cleanup completed`);
  }
}

// Create singleton instance
let unifiedWebRTCManagerInstance: UnifiedWebRTCManager | null = null;

export const getUnifiedWebRTCManager = (): UnifiedWebRTCManager => {
  if (!unifiedWebRTCManagerInstance) {
    unifiedWebRTCManagerInstance = new UnifiedWebRTCManager();
  }
  return unifiedWebRTCManagerInstance;
};

export default getUnifiedWebRTCManager();