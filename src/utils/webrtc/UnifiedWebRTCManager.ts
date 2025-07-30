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
  maxRetries: 2, // Reduzido de 5 para 2
  initialDelay: 3000, // Aumentado para 3s
  maxDelay: 15000, // Reduzido para 15s
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

  // CORREÇÃO: Estado para aguardar confirmação de entrada na sala
  private webrtcReady: boolean = false;

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
      console.log(`🎥 FASE 3: Stream received from ${participantId}`);
      this.updateConnectionMetrics(participantId, { streamReceived: true });
      this.updateConnectionState('webrtc', 'connected');
      this.callbacksManager.triggerStreamCallback(participantId, stream);
      
      // 🚀 PONTE STREAM-TO-COMPONENT: Disparar evento customizado
      console.log(`🌉 FASE 3: Dispatching stream-received event for ${participantId}`);
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
      console.log(`👤 FASE 3: Participant ${participantId} joined`);
      this.updateConnectionMetrics(participantId, { joined: true });
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
      
      // CORREÇÃO: Remover auto-handshake para evitar loops
      // Auto-handshake removido para prevenir loops infinitos
    });
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    // FASE 1: Connect to WebSocket FIRST
    console.log('🔗 PARTICIPANT: Connecting to WebSocket...');
    await unifiedWebSocketService.connect();
    
    // FASE 2: Setup callbacks BEFORE joining room and setting stream
    console.log('📞 CRÍTICO: Registrando callbacks ANTES de definir stream');
    this.setupWebSocketCallbacks();

    try {
      if (stream) {
        console.log(`📹 CALLBACK-CRÍTICO: Definindo stream local ANTES de callbacks`);
        this.localStream = stream;
        const inactiveTracks = stream.getTracks().filter(track => track.readyState !== 'live');
        if (inactiveTracks.length > 0) {
          console.warn(`⚠️ CALLBACK-CRÍTICO: Tracks inativos encontrados:`, inactiveTracks);
        }
      } else {
        throw new Error('Stream é obrigatório para inicialização WebRTC do participante');
      }

      // FASE 1: REGISTRAR CALLBACKS ANTES DE QUALQUER HANDSHAKE
      console.log(`🎯 CALLBACK-CRÍTICO: Registrando stream callback ANTES do handshake`);
      this.connectionHandler.setStreamCallback((participantId, stream) => {
        console.log(`🎥 CALLBACK-CRÍTICO: Stream callback disparado para ${participantId}`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active
        });
        
        // VISUAL LOG: Toast crítico quando stream é recebido
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('stream-callback-triggered', {
            detail: { 
              participantId, 
              streamId: stream.id,
              trackCount: stream.getTracks().length
            }
          }));
        }
        
        this.updateConnectionMetrics(participantId, { streamReceived: true });
        this.updateConnectionState('webrtc', 'connected');
        this.callbacksManager.triggerStreamCallback(participantId, stream);
        
        // 🚀 PONTE STREAM-TO-COMPONENT: Disparar evento customizado
        console.log(`🌉 CALLBACK-CRÍTICO: Dispatching stream-received event for ${participantId}`);
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

      console.log(`👤 CALLBACK-CRÍTICO: Registrando participant callback ANTES do handshake`);
      this.connectionHandler.setParticipantJoinCallback((participantId) => {
        console.log(`👤 CALLBACK-CRÍTICO: Participant callback disparado para ${participantId}`);
        this.updateConnectionMetrics(participantId, { joined: true });
        this.callbacksManager.triggerParticipantJoinCallback(participantId);
      });

      this.updateConnectionState('websocket', 'connecting');

      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await unifiedWebSocketService.connect();
      console.log(`🚪 CALLBACK-CRÍTICO: Aguardando confirmação de entrada na sala: ${sessionId}`);
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      
      this.webrtcReady = true;
      console.log(`✅ CALLBACK-CRÍTICO: Confirmação de entrada recebida, WebRTC pronto`);

      // CORREÇÃO: Anúncio único sem delay
      if (unifiedWebSocketService.isConnected()) {
        window.dispatchEvent(new CustomEvent('participant-joined', {
          detail: { participantId, sessionId, hasVideo: !!stream, timestamp: Date.now() }
        }));
      }

      this.updateConnectionState('websocket', 'connected');

      if (this.localStream) {
        await this.notifyLocalStream();
        
        // CRÍTICO: Aguardar estabilização antes do handshake
        console.log('⏳ CALLBACK-CRÍTICO: Aguardando estabilização antes do WebRTC...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // VERIFICAÇÃO FINAL: Garantir que stream ainda está ativo
        const currentTracks = this.localStream.getTracks();
        const activeTracks = currentTracks.filter(t => t.readyState === 'live');
        
        console.log(`🔍 CALLBACK-CRÍTICO: Verificação final do stream:`, {
          totalTracks: currentTracks.length,
          activeTracks: activeTracks.length,
          streamActive: this.localStream.active
        });
        
        if (activeTracks.length === 0) {
          console.error(`❌ CALLBACK-CRÍTICO: Stream perdeu todas as tracks ativas antes do handshake`);
          throw new Error('Stream inválido - todas as tracks foram perdidas');
        }
        
        if (this.webrtcReady) {
          console.log(`🤝 CALLBACK-CRÍTICO: Iniciando handshake WebRTC com callbacks já registrados`);
          await this.connectionHandler.initiateCallWithRetry('host');
          this.updateConnectionState('webrtc', 'connecting');
          
          // CORREÇÃO 2: Remover timeout que causa loops infinitos
          
          console.log(`✅ CALLBACK-CRÍTICO: Handshake WebRTC iniciado com sucesso`);
        } else {
          console.warn(`⚠️ CALLBACK-CRÍTICO: WebRTC não pode ser iniciado - não confirmado na sala`);
        }
      } else {
        throw new Error('Stream foi perdido durante inicialização WebRTC');
      }
    } catch (error) {
      console.error(`❌ CALLBACK-CRÍTICO: Falha na inicialização do participante:`, error);
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
      console.log(`🚪 Aguardando confirmação de entrada na sala como host: ${sessionId}`);
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      
      // CORREÇÃO: Marcar como pronto para WebRTC após confirmação de entrada na sala
      this.webrtcReady = true;
      console.log(`✅ Confirmação de entrada na sala recebida. Host WebRTC pronto.`);

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
    console.log('🔗 FASE 2: Attempting to connect to host with auto-handshake');
    
    if (!this.localStream) {
      throw new Error('No local stream available for host connection');
    }

    try {
      const hostId = 'host';
      console.log(`🎯 FASE 2: Initiating connection to host: ${hostId}`);
      
      // FASE 2: Usar novo método de handshake automático
      await this.connectionHandler.initiateHandshake(hostId);
      this.updateConnectionState('webrtc', 'connecting');
      
      console.log('✅ FASE 2: Successfully initiated handshake with host');
    } catch (error) {
      console.error('❌ FASE 2: Failed to connect to host:', error);
      this.updateConnectionState('webrtc', 'failed');
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
    // HANDSHAKE DEFINITIVO: Sincronizar com estado real das conexões
    try {
      const wsConnected = unifiedWebSocketService.isConnected();
      
      // Atualizar estado WebSocket baseado no serviço real
      if (wsConnected && this.connectionState.websocket !== 'connected') {
        this.connectionState.websocket = 'connected';
      } else if (!wsConnected && this.connectionState.websocket === 'connected') {
        this.connectionState.websocket = 'disconnected';
      }
      
      // CORREÇÃO CRÍTICA: Verificar estado real das PeerConnections
      let connectedPeers = 0;
      let connectingPeers = 0;
      let failedPeers = 0;
      
      this.peerConnections.forEach((pc, participantId) => {
        const state = pc.connectionState;
        console.log(`🔍 HANDSHAKE DEFINITIVO: Peer ${participantId} state: ${state}`);
        
        if (state === 'connected') {
          connectedPeers++;
        } else if (state === 'connecting' || state === 'new') {
          connectingPeers++;
        } else if (state === 'failed' || state === 'closed') {
          failedPeers++;
        }
      });
      
      // CORREÇÃO CRÍTICA: Lógica corrigida para atualizar WebRTC state
      if (connectedPeers > 0) {
        this.connectionState.webrtc = 'connected';
        console.log(`✅ HANDSHAKE DEFINITIVO: WebRTC connected (${connectedPeers} peers)`);
      } else if (connectingPeers > 0) {
        this.connectionState.webrtc = 'connecting';
        console.log(`🔄 HANDSHAKE DEFINITIVO: WebRTC connecting (${connectingPeers} peers)`);
      } else if (failedPeers > 0) {
        this.connectionState.webrtc = 'failed';
        console.log(`❌ HANDSHAKE DEFINITIVO: WebRTC failed (${failedPeers} peers)`);
      } else if (this.peerConnections.size === 0 && this.isHost && wsConnected) {
        this.connectionState.webrtc = 'connecting'; // Host aguardando participantes
        console.log(`⏳ HANDSHAKE DEFINITIVO: Host waiting for participants`);
      } else {
        this.connectionState.webrtc = 'disconnected';
        console.log(`🔌 HANDSHAKE DEFINITIVO: WebRTC disconnected`);
      }
      
      // Atualizar estado geral
      this.updateOverallState();
      
      console.log('🔍 HANDSHAKE DEFINITIVO: Final connection state:', this.connectionState);
      return this.connectionState;
    } catch (error) {
      console.error('❌ HANDSHAKE DEFINITIVO: Error getting connection state:', error);
      return this.connectionState;
    }
  }

  private updateOverallState(): void {
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
    
    // CORREÇÃO: Reset do estado WebRTC ready
    this.webrtcReady = false;

    // Disconnect WebSocket
    if (unifiedWebSocketService.isConnected()) {
      unifiedWebSocketService.disconnect();
    }
  }

  private updateConnectionState(type: keyof ConnectionState, state: ConnectionState[keyof ConnectionState]): void {
    this.connectionState[type] = state;
    
    // FASE 2: Lógica específica para hosts vs participantes
    if (this.isHost) {
      // Para host: conectado se WebSocket conectado
      if (this.connectionState.websocket === 'connected') {
        this.connectionState.overall = 'connected';
        // WebRTC para host é "aguardando participantes" ou "conectado"
        if (this.connectionState.webrtc === 'disconnected' && this.webrtcReady) {
          this.connectionState.webrtc = 'connecting'; // Aguardando participantes
        }
      } else {
        this.updateOverallState();
      }
    } else {
      // Para participante: precisa WebSocket + WebRTC
      this.updateOverallState();
    }

    console.log(`🔄 FASE 2: State updated: ${type} = ${state}, overall = ${this.connectionState.overall} (Host: ${this.isHost})`);
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
    console.log('🔌 HANDSHAKE DEFINITIVO: Setting up WebSocket callbacks');
    
    // Set up signaling callbacks through WebRTCCallbacks
    if (this.isHost) {
      console.log('🎯 HANDSHAKE DEFINITIVO: Setting up host callbacks');
      this.callbacksManager.setupHostCallbacks(
        (userId) => console.log(`🔗 Host: User connected ${userId}`),
        (userId) => console.log(`❌ Host: User disconnected ${userId}`),
        (participants) => console.log(`👥 Host: Participants updated`, participants),
        // CORREÇÃO CRÍTICA: Host deve escutar e responder a ofertas de participantes
        (data) => {
          console.log('📥 HANDSHAKE DEFINITIVO: Host received offer from participant', data);
          if (this.signalingHandler && data.from && data.offer) {
            this.signalingHandler.handleOffer(data);
          }
        },
        (data) => {
          console.log('📥 HANDSHAKE DEFINITIVO: Host received answer', data);
          if (this.signalingHandler && data.from && data.answer) {
            this.signalingHandler.handleAnswer(data);
          }
        },
        (data) => {
          console.log('🧊 HANDSHAKE DEFINITIVO: Host received ICE candidate', data);
          if (this.signalingHandler && data.from && data.candidate) {
            this.signalingHandler.handleIceCandidate(data);
          }
        }
      );
    } else {
      console.log('👤 HANDSHAKE DEFINITIVO: Setting up participant callbacks');
      this.callbacksManager.setupParticipantCallbacks(
        this.participantId || 'unknown',
        (userId) => console.log(`🔗 Participant: User connected ${userId}`),
        (participants) => console.log(`👥 Participant: Participants updated`, participants),
        // CORREÇÃO CRÍTICA: Participante deve escutar e responder a ofertas do host
        (data) => {
          console.log('📥 HANDSHAKE DEFINITIVO: Participant received offer from host', data);
          if (this.signalingHandler && data.from && data.offer) {
            this.signalingHandler.handleOffer(data);
          }
        },
        (data) => {
          console.log('📥 HANDSHAKE DEFINITIVO: Participant received answer', data);
          if (this.signalingHandler && data.from && data.answer) {
            this.signalingHandler.handleAnswer(data);
          }
        },
        (data) => {
          console.log('🧊 HANDSHAKE DEFINITIVO: Participant received ICE candidate', data);
          if (this.signalingHandler && data.from && data.candidate) {
            this.signalingHandler.handleIceCandidate(data);
          }
        }
      );
    }
  }

  private async notifyLocalStream(): Promise<void> {
    console.log('📢 CRÍTICO: Notificando stream via WebSocket para host');
    
    if (this.localStream && this.roomId && this.participantId) {
      try {
        // FASE 1: CORREÇÃO CRÍTICA - Emitir via WebSocket usando método disponível
        console.log('🚀 CRÍTICO: Emitindo stream-started para backend');
        unifiedWebSocketService.notifyStreamStarted(
          this.participantId,
          {
            hasVideo: this.localStream.getVideoTracks().length > 0,
            hasAudio: this.localStream.getAudioTracks().length > 0,
            streamId: this.localStream.id,
            timestamp: Date.now(),
            roomId: this.roomId
          }
        );
        
        console.log('✅ CRÍTICO: stream-started emitido com sucesso');
        
        // Trigger callback if available
        if (this.callbacksManager) {
          console.log('📞 CALLBACK: Disparando callback de stream local');
          this.callbacksManager.triggerStreamCallback(this.participantId, this.localStream);
        }
        
      } catch (error) {
        console.error('❌ CRÍTICO: Erro ao notificar stream:', error);
        throw error;
      }
    } else {
      console.warn('⚠️ CRÍTICO: notifyLocalStream falhou - faltam dados:', {
        hasStream: !!this.localStream,
        hasParticipantId: !!this.participantId,
        hasRoomId: !!this.roomId
      });
    }
  }
}
