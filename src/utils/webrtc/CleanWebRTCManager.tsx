/**
 * FASE 5: WebRTC Manager limpo e simplificado
 * Substitui UnifiedWebRTCManager com implementação focada e sem duplicidades
 * Remove lógica desnecessária e consolida funcionalidades principais
 */

import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { getDeviceSpecificConstraints } from '@/utils/media/mediaConstraints';

export interface WebRTCCallbacks {
  onParticipantJoin?: (participantId: string, data?: any) => void;
  onParticipantStream?: (participantId: string, stream: MediaStream) => void;
  onParticipantDisconnect?: (participantId: string) => void;
  onConnectionStateChange?: (participantId: string, state: RTCPeerConnectionState) => void;
}

export interface ConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

export class CleanWebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private isHost: boolean = false;
  private callbacks: WebRTCCallbacks = {};
  
  private connectionState: ConnectionState = {
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  };

  // FASE 5: Configuração WebRTC simplificada e otimizada
  private readonly webrtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
  };

  constructor() {
    console.log('🧹 CLEAN WebRTC Manager: Initialized with simplified architecture');
  }

  setCallbacks(callbacks: WebRTCCallbacks): void {
    this.callbacks = callbacks;
    console.log('📞 CLEAN: Callbacks registered');
  }

  // FASE 5: Inicialização limpa como HOST
  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 CLEAN: Initializing as host for session: ${sessionId}`);
    
    this.cleanup(); // Limpar estado anterior
    
    this.roomId = sessionId;
    this.participantId = `host-${Date.now()}`;
    this.isHost = true;

    try {
      this.updateConnectionState('websocket', 'connecting');
      
      // Setup WebSocket callbacks
      this.setupWebSocketCallbacks();
      
      this.updateConnectionState('websocket', 'connected');
      this.updateConnectionState('webrtc', 'connected'); // Host não precisa de WebRTC inicialmente
      
      console.log('✅ CLEAN HOST: Initialization completed');
    } catch (error) {
      console.error('❌ CLEAN HOST: Initialization failed:', error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  // FASE 5: Inicialização limpa como PARTICIPANTE
  async initializeAsParticipant(sessionId: string, participantId: string, stream: MediaStream): Promise<void> {
    console.log(`👤 CLEAN: Initializing as participant ${participantId}`);
    
    this.cleanup(); // Limpar estado anterior
    
    if (!stream || !stream.active) {
      throw new Error('Valid stream required for participant initialization');
    }

    this.roomId = sessionId;
    this.participantId = participantId;
    this.localStream = stream;
    this.isHost = false;

    try {
      this.updateConnectionState('websocket', 'connecting');
      
      // Setup WebSocket callbacks
      this.setupWebSocketCallbacks();
      
      this.updateConnectionState('websocket', 'connected');
      
      console.log('✅ CLEAN PARTICIPANT: Initialization completed');
    } catch (error) {
      console.error('❌ CLEAN PARTICIPANT: Initialization failed:', error);
      this.updateConnectionState('websocket', 'failed');
      throw error;
    }
  }

  // FASE 5: Setup simplificado de callbacks WebSocket
  private setupWebSocketCallbacks(): void {
    if (this.isHost) {
      // HOST: Escutar novos participantes
      unifiedWebSocketService.setCallbacks({
        onUserConnected: (userId) => {
          console.log(`👤 CLEAN HOST: New participant: ${userId}`);
          this.callbacks.onParticipantJoin?.(userId);
          this.createPeerConnection(userId);
        },
        onUserDisconnected: (userId) => {
          console.log(`👤 CLEAN HOST: Participant left: ${userId}`);
          this.callbacks.onParticipantDisconnect?.(userId);
          this.removePeerConnection(userId);
        },
        onOffer: this.handleOffer.bind(this),
        onAnswer: this.handleAnswer.bind(this),
        onIceCandidate: this.handleIceCandidate.bind(this)
      });
    } else {
      // PARTICIPANT: Escutar hosts e outros participantes
      unifiedWebSocketService.setCallbacks({
        onUserConnected: (userId) => {
          console.log(`🏠 CLEAN PARTICIPANT: Connecting to: ${userId}`);
          if (userId !== this.participantId) {
            this.createPeerConnection(userId);
            this.initiateCall(userId);
          }
        },
        onOffer: this.handleOffer.bind(this),
        onAnswer: this.handleAnswer.bind(this),
        onIceCandidate: this.handleIceCandidate.bind(this)
      });
    }
  }

  // FASE 5: Criação simplificada de peer connection
  private createPeerConnection(participantId: string): RTCPeerConnection {
    if (this.peerConnections.has(participantId)) {
      console.log(`♻️ CLEAN: Reusing existing connection for: ${participantId}`);
      return this.peerConnections.get(participantId)!;
    }

    console.log(`🔧 CLEAN: Creating peer connection for: ${participantId}`);
    const peerConnection = new RTCPeerConnection(this.webrtcConfig);
    
    // Add local stream if available (participant only)
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Event handlers
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`🎬 CLEAN: Received stream from: ${participantId}`);
      const [remoteStream] = event.streams;
      this.callbacks.onParticipantStream?.(participantId, remoteStream);
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 CLEAN: Connection state for ${participantId}: ${peerConnection.connectionState}`);
      this.callbacks.onConnectionStateChange?.(participantId, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(participantId);
      }
    };

    this.peerConnections.set(participantId, peerConnection);
    this.updateWebRTCState();
    
    return peerConnection;
  }

  // FASE 5: Iniciar chamada simplificada
  private async initiateCall(participantId: string): Promise<void> {
    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      console.error(`❌ CLEAN: No peer connection for: ${participantId}`);
      return;
    }

    try {
      console.log(`📞 CLEAN: Creating offer for: ${participantId}`);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      unifiedWebSocketService.sendOffer(participantId, offer);
    } catch (error) {
      console.error(`❌ CLEAN: Failed to create offer for ${participantId}:`, error);
    }
  }

  // FASE 5: Handlers de sinalização simplificados
  private async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📤 CLEAN: Handling offer from: ${fromUserId}`);
    
    const peerConnection = this.createPeerConnection(fromUserId);
    
    try {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      unifiedWebSocketService.sendAnswer(fromUserId, answer);
    } catch (error) {
      console.error(`❌ CLEAN: Failed to handle offer from ${fromUserId}:`, error);
    }
  }

  private async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 CLEAN: Handling answer from: ${fromUserId}`);
    
    const peerConnection = this.peerConnections.get(fromUserId);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(answer);
      } catch (error) {
        console.error(`❌ CLEAN: Failed to handle answer from ${fromUserId}:`, error);
      }
    }
  }

  private async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidate): Promise<void> {
    const peerConnection = this.peerConnections.get(fromUserId);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error(`❌ CLEAN: Failed to add ICE candidate from ${fromUserId}:`, error);
      }
    }
  }

  // FASE 5: Gestão de estado simplificada
  private updateConnectionState(component: keyof ConnectionState, state: ConnectionState['websocket']): void {
    if (component === 'overall') return;
    
    this.connectionState[component] = state;
    
    // Calculate overall state
    if (this.connectionState.websocket === 'connected') {
      if (this.peerConnections.size === 0) {
        this.connectionState.overall = 'connected'; // Ready for connections
      } else if (Array.from(this.peerConnections.values()).some(pc => pc.connectionState === 'connected')) {
        this.connectionState.overall = 'connected';
      } else if (Array.from(this.peerConnections.values()).some(pc => pc.connectionState === 'connecting')) {
        this.connectionState.overall = 'connecting';
      } else {
        this.connectionState.overall = 'failed';
      }
    } else {
      this.connectionState.overall = this.connectionState.websocket;
    }
    
    console.log(`📊 CLEAN: Connection state updated:`, this.connectionState);
  }

  private updateWebRTCState(): void {
    if (this.peerConnections.size === 0) {
      this.updateConnectionState('webrtc', 'disconnected');
    } else if (Array.from(this.peerConnections.values()).some(pc => pc.connectionState === 'connected')) {
      this.updateConnectionState('webrtc', 'connected');
    } else if (Array.from(this.peerConnections.values()).some(pc => pc.connectionState === 'connecting')) {
      this.updateConnectionState('webrtc', 'connecting');
    } else {
      this.updateConnectionState('webrtc', 'failed');
    }
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 CLEAN: Handling connection failure for: ${participantId}`);
    this.removePeerConnection(participantId);
    // Reconexão automática pode ser implementada aqui se necessário
  }

  private removePeerConnection(participantId: string): void {
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
      this.updateWebRTCState();
    }
  }

  // FASE 5: Cleanup simplificado
  cleanup(): void {
    console.log('🧹 CLEAN: Performing cleanup');
    
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`🔌 CLEAN: Closing connection for: ${participantId}`);
      pc.close();
    });
    
    this.peerConnections.clear();
    this.localStream = null;
    this.roomId = null;
    this.participantId = null;
    
    this.connectionState = {
      websocket: 'disconnected',
      webrtc: 'disconnected',
      overall: 'disconnected'
    };
  }

  // Getters
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  getPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections);
  }

  isReady(): boolean {
    return this.connectionState.overall === 'connected';
  }
}