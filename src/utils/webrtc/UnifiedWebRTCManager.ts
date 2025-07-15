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
    // FASE 1: FORÇAR DETECÇÃO MOBILE CORRETA
    const urlParams = new URLSearchParams(window.location.search);
    const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
    const hasMobileParam = urlParams.has('mobile') || urlParams.get('mobile') === 'true';
    const accessedViaQR = hasQRParam || hasMobileParam || 
                         document.referrer.includes('qr') || 
                         sessionStorage.getItem('accessedViaQR') === 'true';
    
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasTouchScreen = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
    
    // CRITICAL: QR access always indicates mobile
    this.isMobile = accessedViaQR || (userAgentMobile && hasTouchScreen);
    
    // Store mobile status for consistent detection
    if (this.isMobile) {
      sessionStorage.setItem('isMobile', 'true');
      sessionStorage.setItem('accessedViaQR', 'true');
    }
    
    console.log(`📱 MOBILE-DETECTION: Device type: ${this.isMobile ? 'MOBILE' : 'DESKTOP'}`, {
      accessedViaQR,
      userAgentMobile,
      hasTouchScreen,
      hasQRParam,
      hasMobileParam,
      finalResult: this.isMobile
    });
  }

  private initializeComponents() {
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());
    
    // Link signaling handler with connection handler
    this.signalingHandler.setConnectionHandler(this.connectionHandler);
    
    // Setup stream callback chain
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      console.log(`🎥 UNIFIED: Stream received from ${participantId}`);
      this.updateConnectionMetrics(participantId, { streamReceived: true });
      this.callbacksManager.triggerStreamCallback(participantId, stream);
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log(`👤 UNIFIED: Participant ${participantId} joined`);
      this.updateConnectionMetrics(participantId, { joined: true });
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  private setupHealthMonitoring() {
    // Aggressive health monitoring for mobile connections
    const healthCheckInterval = this.isMobile ? 3000 : 10000; // 3s for mobile, 10s for desktop
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
      this.updateConnectionState('websocket', 'failed');
      this.handleWebSocketFailure();
    }

    // Check WebRTC peer connections
    let hasActiveConnections = false;
    this.peerConnections.forEach((pc, participantId) => {
      if (pc.connectionState === 'connected') {
        hasActiveConnections = true;
      } else if (pc.connectionState === 'failed') {
        console.log(`🔄 Peer connection failed for ${participantId}, attempting recovery`);
        this.handlePeerConnectionFailure(participantId);
      }
    });

    if (hasActiveConnections) {
      this.updateConnectionState('webrtc', 'connected');
    } else if (this.peerConnections.size > 0) {
      this.updateConnectionState('webrtc', 'failed');
    }
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
    console.log('🔄 WebSocket connection failed, attempting recovery...');
    
    try {
      await this.reconnectWebSocket();
    } catch (error) {
      console.error('❌ WebSocket recovery failed:', error);
    }
  }

  private async reconnectWebSocket() {
    if (!this.roomId || !this.participantId) {
      console.error('❌ Cannot reconnect: missing room or participant ID');
      return;
    }

    this.updateConnectionState('websocket', 'connecting');
    
    try {
      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(this.roomId, this.participantId);
      
      // Re-setup callbacks
      this.setupWebSocketCallbacks();
      
      console.log('✅ WebSocket reconnected successfully');
      this.updateConnectionState('websocket', 'connected');
      
      // Trigger WebRTC reconnection for existing participants
      this.peerConnections.forEach((_, participantId) => {
        this.initiateConnectionRecovery(participantId);
      });
      
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
          if (hostId !== this.participantId) {
            console.log(`📞 UNIFIED: Initiating call to ${hostId}`);
            this.connectionHandler.initiateCallWithRetry(hostId);
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
      this.updateConnectionState('websocket', 'connecting');
      await unifiedWebSocketService.connect();
      this.setupWebSocketCallbacks();
      await unifiedWebSocketService.joinRoom(sessionId, this.participantId);
      
      this.updateConnectionState('websocket', 'connected');
      console.log(`✅ UNIFIED HOST: Connected to signaling server`);
      
    } catch (error) {
      console.error(`❌ UNIFIED HOST: Failed to initialize:`, error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId}`);
    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    try {
      // FASE 1: CRITICAL - Only use VALIDATED stream from useParticipantMedia
      if (stream) {
        console.log(`📹 UNIFIED-MOBILE: Processing VALIDATED stream:`, {
          streamId: stream.id,
          active: stream.active,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          isMobile: this.isMobile,
          tracksReady: stream.getTracks().every(t => t.readyState === 'live'),
          videoSettings: stream.getVideoTracks()[0]?.getSettings()
        });
        
        // CRITICAL: Additional mobile stream validation before proceeding
        if (this.isMobile) {
          const isValidMobileStream = stream.active && 
                                    stream.getTracks().length > 0 && 
                                    stream.getTracks().every(t => t.readyState === 'live');
          
          if (!isValidMobileStream) {
            throw new Error('MOBILE: Stream validation failed - stream not ready for WebRTC');
          }
          
          console.log('✅ MOBILE-STREAM: Validation passed, proceeding with WebRTC setup');
        }
        
        this.localStream = stream;
        
        // FASE 1: CRITICAL - Ensure tracks are added to ALL peer connections IMMEDIATELY
        if (this.localStream) {
          console.log(`📤 MOBILE-CRITICAL: Adding stream tracks to ALL peer connections:`, {
            streamId: this.localStream.id,
            trackCount: this.localStream.getTracks().length,
            videoTracks: this.localStream.getVideoTracks().length,
            audioTracks: this.localStream.getAudioTracks().length
          });
          
          // Add tracks to any existing peer connections
          this.peerConnections.forEach((peerConnection, participantId) => {
            this.localStream!.getTracks().forEach((track, index) => {
              try {
                console.log(`➕ MOBILE-CRITICAL: Adding track ${index + 1} to ${participantId}:`, {
                  kind: track.kind,
                  id: track.id,
                  enabled: track.enabled,
                  readyState: track.readyState
                });
                
                peerConnection.addTrack(track, this.localStream!);
                console.log(`✅ MOBILE-CRITICAL: Successfully added ${track.kind} track to ${participantId}`);
              } catch (trackError) {
                console.error(`❌ MOBILE-CRITICAL: Failed to add track to ${participantId}:`, trackError);
              }
            });
          });
        }
      } else {
        console.warn(`⚠️ UNIFIED: No stream provided - participant in degraded mode`);
      }

      this.updateConnectionState('websocket', 'connecting');
      await unifiedWebSocketService.connect();
      this.setupWebSocketCallbacks();
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      
      this.updateConnectionState('websocket', 'connected');
      console.log(`✅ UNIFIED PARTICIPANT: Connected to signaling server`);
      
      // FASE 1: Ensure stream is ready for transmission BEFORE notifying
      if (this.localStream) {
        console.log('📡 UNIFIED-MOBILE: Preparing to notify stream...');
        await this.notifyLocalStreamWithValidation();
      }
      
    } catch (error) {
      console.error(`❌ UNIFIED PARTICIPANT: Failed to initialize:`, error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  private async notifyLocalStreamWithValidation() {
    if (!this.localStream || !this.participantId) return;

    // FASE 2: Enhanced mobile stabilization
    if (this.isMobile) {
      console.log('⏳ MOBILE-STABILIZATION: Extended wait for mobile devices...');
      await new Promise(resolve => setTimeout(resolve, 2500)); // Increased from 2000
      
      // Additional validation after wait
      if (!this.localStream.active || this.localStream.getTracks().some(t => t.readyState !== 'live')) {
        console.error('❌ MOBILE: Stream became invalid during stabilization');
        return;
      }
    }

    const streamInfo = {
      streamId: this.localStream.id,
      trackCount: this.localStream.getTracks().length,
      hasVideo: this.localStream.getVideoTracks().length > 0,
      hasAudio: this.localStream.getAudioTracks().length > 0,
      isMobile: this.isMobile,
      connectionType: 'unified',
      deviceType: this.isMobile ? 'mobile' : 'desktop',
      timestamp: Date.now(),
      // FASE 3: CRITICAL - Enhanced mobile metadata
      participantType: this.isMobile ? 'mobile-participant' : 'desktop-participant',
      mobileFlags: {
        detectedMobile: this.isMobile,
        accessedViaQR: sessionStorage.getItem('accessedViaQR') === 'true',
        userAgent: navigator.userAgent,
        touchScreen: 'ontouchstart' in window && navigator.maxTouchPoints > 0
      },
      videoConstraints: this.isMobile && this.localStream.getVideoTracks()[0] ? 
        this.localStream.getVideoTracks()[0].getSettings() : null
    };
    
    console.log(`📡 UNIFIED-MOBILE: Sending enhanced stream notification:`, streamInfo);
    unifiedWebSocketService.notifyStreamStarted(this.participantId, streamInfo);
    
    // FASE 2: Additional verification for mobile
    if (this.isMobile) {
      setTimeout(() => {
        console.log('🔄 MOBILE-BACKUP: Sending backup stream notification...');
        unifiedWebSocketService.notifyStreamStarted(this.participantId, {
          ...streamInfo,
          isBackup: true,
          backupTimestamp: Date.now()
        });
      }, 1500);
    }
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