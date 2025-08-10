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
///
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
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;

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
      
      //  Remover auto-handshake para evitar loops
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
          console.log(`🤝 TRACK ORDER FIX: Iniciando handshake WebRTC controlado manualmente`);
          
          // 🚨 CORREÇÃO CRÍTICA: Controle manual do handshake para garantir ordem
          try {
            // Criar PeerConnection diretamente com tracks já adicionadas
            const peerConnection = this.connectionHandler.createPeerConnection('host');
            
            // Verificar se tracks foram adicionadas corretamente
            const senders = peerConnection.getSenders();
            console.log(`🔍 TRACK ORDER FIX: PeerConnection criado com ${senders.length} senders`);
            
            if (senders.length === 0) {
              throw new Error('PeerConnection criado sem tracks - falha crítica');
            }
            
            // Criar offer manualmente APÓS tracks estarem adicionadas
            const offer = await peerConnection.createOffer();
            console.log(`📄 TRACK ORDER FIX: Offer manual criado - SDP length: ${offer.sdp?.length}`);
            
            // Verificar se SDP contém tracks de vídeo
            if (offer.sdp && offer.sdp.includes('m=video')) {
              console.log(`✅ TRACK ORDER FIX: SDP contém m=video - sucesso!`);
            } else {
              console.error(`❌ TRACK ORDER FIX: SDP sem m=video - falha crítica`);
              throw new Error('SDP inválido - sem tracks de vídeo');
            }
            
            await peerConnection.setLocalDescription(offer);
            unifiedWebSocketService.sendOffer('host', offer);
            
            this.updateConnectionState('webrtc', 'connecting');
            console.log(`✅ TRACK ORDER FIX: Handshake manual com ordem correta de tracks`);
            
          } catch (handshakeError) {
            console.error(`❌ TRACK ORDER FIX: Falha no handshake manual:`, handshakeError);
            throw handshakeError;
          }
        } else {
          console.warn(`⚠️ TRACK ORDER FIX: WebRTC não pode ser iniciado - não confirmado na sala`);
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
      
      // FASE 3: Setup callbacks ANTES de entrar na sala (crítico para não perder offers)
      console.log('📞 CRÍTICO: Registrando callbacks ANTES de entrar na sala');
      this.setupWebSocketCallbacks();
      
      console.log(`🚪 Aguardando confirmação de entrada na sala como host: ${sessionId}`);
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      
      // CORREÇÃO: Marcar como pronto para WebRTC após confirmação de entrada na sala
      this.webrtcReady = true;
      console.log(`✅ Confirmação de entrada na sala recebida. Host WebRTC pronto.`);
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

  // FASE 3: CORREÇÃO CRÍTICA - Método setStreamCallback que estava faltando
  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void): void {
    console.log('🎯 WEBRTC MANAGER: Setting stream callback');
    this.connectionHandler.setStreamCallback(callback);
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void): void {
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void): void {
    this.callbacksManager.setOnParticipantJoinCallback(callback);
  }

  getConnectionState(): ConnectionState {
    // FASE 2: Sincronizar com estado do WebSocket
    try {
      const wsConnected = unifiedWebSocketService.isConnected();
      
      // Atualizar estado WebSocket baseado no serviço real
      if (wsConnected && this.connectionState.websocket !== 'connected') {
        this.connectionState.websocket = 'connected';
      } else if (!wsConnected && this.connectionState.websocket === 'connected') {
        this.connectionState.websocket = 'disconnected';
      }
      
      // FASE 3: Lógica híbrida para hosts
      if (this.isHost) {
        // Para host: conectado se WebSocket conectado (mesmo sem WebRTC P2P)
        if (wsConnected) {
          this.connectionState.webrtc = this.peerConnections.size > 0 ? 'connected' : 'connecting';
          this.connectionState.overall = 'connected';
        }
      } else {
        // Para participante: precisa WebSocket + WebRTC
        this.updateOverallState();
      }
      
      console.log('🔍 FASE 2: Connection state sync:', this.connectionState);
      return this.connectionState;
    } catch (error) {
      console.error('❌ FASE 2: Error getting connection state:', error);
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
    console.log('🔌 Setting up WebSocket callbacks');

    // Common handlers
    const onUserConnected = (data: { userId: string; socketId: string; timestamp: number; networkQuality: string }) => {
      console.log('🟢 WS user-connected:', data);
    };

    const onUserDisconnected = (userId: string) => {
      console.log('🔴 WS user-disconnected:', userId);
      try {
        this.connectionHandler.closePeerConnection(userId);
      } catch (e) {
        console.warn('⚠️ closePeerConnection falhou (pode já estar fechado):', e);
      }
    };

    const onParticipantsUpdate = (participants: any[]) => {
      console.log('👥 WS participants-update:', participants?.length || 0);
    };

    // Signaling bridge → SignalingHandler
    const onOffer = (data: { offer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => {
      console.log('📞 PLANO CIRÚRGICO: Offer received in manager from:', data.fromUserId || data.fromSocketId);
      console.log('🔍 PLANO CIRÚRGICO: Offer structure validation:', { hasOffer: !!data.offer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
      this.signalingHandler.handleOffer(data);
    };

    const onAnswer = (data: { answer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => {
      console.log('✅ PLANO CIRÚRGICO: Answer received in manager from:', data.fromUserId || data.fromSocketId);
      console.log('🔍 PLANO CIRÚRGICO: Answer structure validation:', { hasAnswer: !!data.answer, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
      this.signalingHandler.handleAnswer(data);
    };

    const onIceCandidate = (data: { candidate: RTCIceCandidate, fromUserId: string, fromSocketId: string }) => {
      console.log('🧊 PLANO CIRÚRGICO: ICE candidate received in manager from:', data.fromUserId || data.fromSocketId);
      console.log('🔍 PLANO CIRÚRGICO: ICE candidate structure validation:', { hasCandidate: !!data.candidate, fromUserId: data.fromUserId, fromSocketId: data.fromSocketId });
      this.signalingHandler.handleIceCandidate(data);
    };

    if (this.isHost) {
      console.log('🎯 Setting up host callbacks');
      this.callbacksManager.setupHostCallbacks(
        onUserConnected,
        onUserDisconnected,
        onParticipantsUpdate,
        onOffer,
        onAnswer,
        onIceCandidate
      );
    } else {
      console.log('👤 Setting up participant callbacks');
      const pid = this.participantId || 'participant';
      this.callbacksManager.setupParticipantCallbacks(
        pid,
        onUserConnected,
        onParticipantsUpdate,
        onOffer,
        onAnswer,
        onIceCandidate
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
