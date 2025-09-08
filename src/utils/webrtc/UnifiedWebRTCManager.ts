import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { ConnectionHandler } from './ConnectionHandler';
import { SignalingHandler } from './SignalingHandler';
import { ParticipantManager } from './ParticipantManager';
import { WebRTCCallbacks } from './WebRTCCallbacks';
import { MEDIA_CONSTRAINTS } from './WebRTCConfig';
import { assessDesktopConnections } from './assessDesktopConnections';

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
  maxRetries: 1, // Desktop: single retry only
  initialDelay: 5000, // Desktop: 5s delay
  maxDelay: 10000, // Desktop: max 10s delay  
  multiplier: 1.5
};

// DESKTOP: Timeouts realistas para WebRTC
const DESKTOP_TIMEOUTS = {
  connectionTimeout: 15000,    // 15s para negociação WebRTC
  forceCleanup: 20000,         // 20s antes de força limpeza  
  healthCheckInterval: 30000,  // 30s entre checks de saúde
  retryGracePeriod: 45000      // 45s grace period antes do primeiro retry
};

export class UnifiedWebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;

  private isHost: boolean = false;
  private isMobile: boolean = false;

  // MOBILE VIDEO-ONLY: Add polite peer manager and sendonly transceiver
  private politePeerManager: any = null;
  private sendOnlyTransceiver: any = null;

  // ICE candidate buffering for consistent handling
  private iceCandidateBuffer: Map<string, RTCIceCandidate[]> = new Map();

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
  
  // Desktop-specific connection tracking
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isDesktop: boolean = true;

  constructor() {
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔧 [WRTC] Manager initialized');
    this.detectMobile();
    this.initializeComponents();
    this.setupHealthMonitoring();
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isDesktop = !this.isMobile;
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log(`🖥️ [WRTC] Device: ${this.isMobile ? 'Mobile' : 'Desktop'} - Desktop optimizations: ${this.isDesktop}`);
  }

  private initializeComponents() {
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());

    this.signalingHandler.setConnectionHandler(this.connectionHandler);
    this.callbacksManager.setConnectionHandler(this.connectionHandler);

    this.connectionHandler.setStreamCallback((participantId, stream) => {
      const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
      console.log(`🎥 [WRTC] Stream received: ${participantId}`);
      if (DEBUG) {
        console.log(`🎥 [WRTC] Stream details:`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          timestamp: Date.now()
        });
      }
      
      this.updateConnectionMetrics(participantId, { streamReceived: true });
      this.updateConnectionState('webrtc', 'connected');
      this.callbacksManager.triggerStreamCallback(participantId, stream);
      
      window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
        detail: { participantId, stream, timestamp: Date.now() }
      }));
    });

    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log(`👤 [WRTC] Participant joined: ${participantId}`);
      this.updateConnectionMetrics(participantId, { joined: true });
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 [PARTICIPANT] Initializing video-only participant ${participantId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    // Initialize polite peer manager (participant is polite)
    const { PolitePeerManager } = await import('./PolitePeerManager');
    this.politePeerManager = new PolitePeerManager(true);

    // Initialize sendonly transceiver manager
    const { SendOnlyTransceiver } = await import('./SendOnlyTransceiver');
    this.sendOnlyTransceiver = new SendOnlyTransceiver();

    // Connect to WebSocket
    await unifiedWebSocketService.connect();
    this.setupWebSocketCallbacks();

    try {
      if (stream) {
        // Validate this is video-only stream
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        if (audioTracks.length > 0) {
          console.warn('⚠️ [PARTICIPANT] Removing unexpected audio tracks from video-only stream');
          audioTracks.forEach(track => {
            stream.removeTrack(track);
            track.stop();
          });
        }
        
        if (videoTracks.length === 0) {
          throw new Error('Video-only stream must contain video tracks');
        }
        
        this.localStream = stream;
        console.log('✅ [PARTICIPANT] Video-only stream validated:', {
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          active: stream.active
        });
      } else {
        throw new Error('Video-only stream required for participant initialization');
      }

      // FASE 1-4: ENHANCED CALLBACK REGISTRATION WITH INTELLIGENT TRACK MANAGEMENT
      console.log(`🎯 FASE 1-4: Registrando enhanced stream callback com intelligent track management`);
      const { IntelligentTrackManager } = await import('./IntelligentTrackManager');
      const trackManager = new IntelligentTrackManager();
      
      this.connectionHandler.setStreamCallback(async (participantId, stream) => {
        console.log(`🎥 FASE 1-4: Enhanced stream callback para ${participantId}`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active,
          hasMutedTracks: stream.getTracks().some(t => t.muted)
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
          console.log(`🤝 PARTICIPANT: WebRTC pronto, aguardando connectToHost() ser chamado`);
          // Não iniciar handshake automaticamente aqui - será feito via connectToHost()
        } else {
          console.warn(`⚠️ PARTICIPANT: WebRTC não pode ser iniciado - não confirmado na sala`);
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
    console.log(`🖥️ [HOST] Initializing session ${sessionId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.isHost = true;

    try {
      this.updateConnectionState('websocket', 'connecting');

      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Setup callbacks antes de conectar
      this.setupWebSocketCallbacks();
      
      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      
      this.webrtcReady = true;
      console.log(`✅ [HOST] WebRTC ready for session: ${sessionId}`);
      this.updateConnectionState('websocket', 'connected');

      console.log(`✅ [HOST] Initialized: ${sessionId}`);
    } catch (error) {
      console.error(`❌ [HOST] Failed to initialize:`, error);
      this.updateConnectionState('websocket', 'failed');
      this.cleanup();
      throw error;
    }
  }

  async connectToHost(): Promise<void> {
    console.log(`🔗 [PARTICIPANT] Connecting to host with polite peer pattern`);
    
    if (!this.localStream) {
      throw new Error('No video-only stream available for host connection');
    }

    try {
      const hostId = 'host';
      
      // Initialize polite peer state for host connection
      if (this.politePeerManager) {
        this.politePeerManager.initializePeerState(hostId);
      }
      
      console.log(`🎯 [PARTICIPANT] Starting polite handshake with: ${hostId}`);
      
      // Use existing handshake method with enhanced parameters
      await this.connectionHandler.initiateHandshake(hostId);
      this.updateConnectionState('webrtc', 'connecting');
      
      console.log(`✅ [PARTICIPANT] Polite handshake initiated successfully`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to connect to host:`, error);
      this.updateConnectionState('webrtc', 'failed');
      throw error;
    }
  }

  setLocalStream(stream: MediaStream): void {
    console.log(`📹 [WRTC] Setting local stream`);
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

    // Clear connection timeouts
    this.connectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.connectionTimeouts.clear();

    // Clear retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.retryAttempts.clear();

    // Clear ICE candidate buffers
    this.iceCandidateBuffer.clear();

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
    this.webrtcReady = false;

    // Disconnect WebSocket
    if (unifiedWebSocketService.isConnected()) {
      unifiedWebSocketService.disconnect();
    }
  }

  // PLANO: Reset WebRTC definitivo - 3s garantido
  public resetWebRTC(): void {
    console.log('🔥 PLANO RESET: Desktop WebRTC reset (3s garantido)');
    
    // PLANO: Clear timeouts imediatamente
    this.connectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.connectionTimeouts.clear();
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // PLANO: Force close todas as connections
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`🔥 RESET ${participantId}`);
      try {
        pc.close();
      } catch (error) {
        console.error(`❌ RESET ${participantId}:`, error);
      }
    });
    this.peerConnections.clear();
    
    // PLANO: Clear todos os buffers e métricas
    this.iceCandidateBuffer.clear();
    this.connectionMetrics.clear();
    this.retryAttempts.clear();
    
    // PLANO: Estado desconectado imediato
    this.connectionState.webrtc = 'disconnected';
    this.connectionState.overall = unifiedWebSocketService.isConnected() ? 'connected' : 'disconnected';
    
    // PLANO: Event de reset completo
    window.dispatchEvent(new CustomEvent('desktop-webrtc-reset-complete'));
    console.log('✅ PLANO RESET: Completo - 5s máximo garantido');
  }

  // PLANO: Break loop ultrarrápido - 4s máximo
  public breakConnectionLoop(): void {
    console.log('⚡ PLANO LOOP: Breaking loops (4s máximo)');
    
    const now = Date.now();
    const loopsDetected: string[] = [];
    
    this.peerConnections.forEach((pc, participantId) => {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      const metrics = this.connectionMetrics.get(participantId);
      
      // PLANO: Qualquer connection há mais de 2s é loop
      const connectingTime = metrics?.connectionStartTime ? now - metrics.connectionStartTime : 0;
      const isLoop = (state === 'connecting' || iceState === 'checking') && 
                     connectingTime > DESKTOP_TIMEOUTS.forceCleanup;
      
      if (isLoop) {
        console.log(`🚫 PLANO LOOP: ${participantId} (${connectingTime}ms) - QUEBRAR`);
        loopsDetected.push(participantId);
        
        try {
          pc.close();
          this.peerConnections.delete(participantId);
          this.connectionMetrics.delete(participantId);
          
          // PLANO: Clear timeout
          const timeout = this.connectionTimeouts.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            this.connectionTimeouts.delete(participantId);
          }
        } catch (error) {
          console.error(`❌ PLANO LOOP: Erro ${participantId}:`, error);
        }
      }
    });
    
    if (loopsDetected.length > 0) {
      console.log(`⚡ PLANO LOOP: Quebrou ${loopsDetected.length} loops:`, loopsDetected);
      
      // PLANO: Reset estado se não há connections
      if (this.peerConnections.size === 0) {
        this.connectionState.webrtc = 'disconnected';
        this.connectionState.overall = 'disconnected';
      }
      
      window.dispatchEvent(new CustomEvent('desktop-loops-broken'));
    } else {
      console.log('💚 PLANO LOOP: Nenhum loop detectado');
    }
  }

  // Enhanced ICE candidate buffering with comprehensive logging and stats monitoring
  bufferIceCandidate(participantId: string, candidate: RTCIceCandidate): void {
    if (!this.iceCandidateBuffer.has(participantId)) {
      this.iceCandidateBuffer.set(participantId, []);
    }
    this.iceCandidateBuffer.get(participantId)!.push(candidate);
    console.log(`🧊 ICE BUFFER: Candidate buffered for ${participantId} (total: ${this.iceCandidateBuffer.get(participantId)!.length}) - Type: ${candidate.type}, Protocol: ${candidate.protocol}`);
  }

  // Enhanced media flow validation using getStats()
  async validateMediaFlow(participantId: string): Promise<{hasFlow: boolean, stats: any}> {
    const pc = this.peerConnections.get(participantId);
    if (!pc) {
      return { hasFlow: false, stats: null };
    }

    try {
      const stats = await pc.getStats();
      let packetsReceived = 0;
      let framesDecoded = 0;
      let bytesReceived = 0;
      let audioPackets = 0;
      let videoPackets = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          const packets = report.packetsReceived || 0;
          const bytes = report.bytesReceived || 0;
          
          packetsReceived += packets;
          bytesReceived += bytes;
          
          if (report.kind === 'video') {
            framesDecoded += report.framesDecoded || 0;
            videoPackets += packets;
          } else if (report.kind === 'audio') {
            audioPackets += packets;
          }
        }
      });

      const hasFlow = packetsReceived > 0 || framesDecoded > 0 || bytesReceived > 0;
      const flowStats = {
        packetsReceived,
        framesDecoded,
        bytesReceived,
        audioPackets,
        videoPackets,
        lastCheck: Date.now()
      };

      if (hasFlow) {
        console.log(`📊 MEDIA FLOW: ${participantId} - Packets: ${packetsReceived} (audio: ${audioPackets}, video: ${videoPackets}), Frames: ${framesDecoded}, Bytes: ${bytesReceived}`);
      } else {
        console.log(`📊 MEDIA FLOW: ${participantId} - No media flow detected yet`);
      }

      return { hasFlow, stats: flowStats };
    } catch (error) {
      console.warn(`⚠️ MEDIA FLOW: Failed to get stats for ${participantId}:`, error);
      return { hasFlow: false, stats: null };
    }
  }

  async flushIceCandidates(participantId: string, pc: RTCPeerConnection): Promise<void> {
    const candidates = this.iceCandidateBuffer.get(participantId) || [];
    if (candidates.length > 0) {
      console.log(`🧊 ICE FLUSH: Flushing ${candidates.length} candidates for ${participantId}`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
          successCount++;
          console.log(`🧊 ICE: Candidate applied successfully for ${participantId}`);
        } catch (error) {
          failureCount++;
          console.warn(`⚠️ ICE: Failed to add candidate for ${participantId}:`, error);
        }
      }
      
      this.iceCandidateBuffer.delete(participantId);
      console.log(`✅ ICE FLUSH: Complete for ${participantId} - Success: ${successCount}, Failed: ${failureCount}`);
    } else {
      console.log(`🧊 ICE FLUSH: No candidates to flush for ${participantId}`);
    }
  }


  private updateConnectionState(type: keyof ConnectionState, state: ConnectionState[keyof ConnectionState]): void {
    const previousState = { ...this.connectionState };
    this.connectionState[type] = state;
    
    // SOLUÇÃO DEFINITIVA: Estado host/participant específico
    if (this.isHost) {
      // HOST: WebSocket = overall, WebRTC depende de participantes ativos
      this.connectionState.overall = this.connectionState.websocket;
      
      if (type === 'webrtc') {
        const activeConnections = Array.from(this.peerConnections.values())
          .filter(pc => pc.connectionState === 'connected');
        const connectingConnections = Array.from(this.peerConnections.values())
          .filter(pc => pc.connectionState === 'connecting');
        
        if (activeConnections.length > 0) {
          this.connectionState.webrtc = 'connected';
        } else if (connectingConnections.length > 0) {
          this.connectionState.webrtc = 'connecting';
          // TIMEOUT: Forçar falha se connecting por muito tempo
          this.setConnectionTimeout('webrtc-host');
        } else {
          this.connectionState.webrtc = 'disconnected';
          this.clearConnectionTimeout('webrtc-host');
        }
      }
    } else {
      // PARTICIPANT: WebSocket + WebRTC necessários
      if (type === 'webrtc' && state === 'connecting') {
        this.setConnectionTimeout('webrtc-participant');
      } else if (type === 'webrtc' && (state === 'connected' || state === 'disconnected')) {
        this.clearConnectionTimeout('webrtc-participant');
      }
      this.updateOverallState();
    }

    // Log only if state changed
    if (JSON.stringify(previousState) !== JSON.stringify(this.connectionState)) {
      console.log(`🔄 CONNECTION STATE: ${type} = ${previousState[type]} → ${state}, overall = ${previousState.overall} → ${this.connectionState.overall} (Host: ${this.isHost}, PeerConnections: ${this.peerConnections.size})`);
    }
  }

  private setConnectionTimeout(key: string): void {
    this.clearConnectionTimeout(key);
    this.connectionTimeouts.set(key, setTimeout(() => {
      console.warn(`⏰ CONNECTION TIMEOUT: Breaking ${key} loop after ${DESKTOP_TIMEOUTS.forceCleanup}ms`);
      if (key.includes('webrtc')) {
        this.connectionState.webrtc = 'failed';
        this.forceCleanupStuckConnections();
      }
    }, DESKTOP_TIMEOUTS.forceCleanup));
  }

  private clearConnectionTimeout(key: string): void {
    const timeout = this.connectionTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(key);
    }
  }

  private forceCleanupStuckConnections(): void {
    console.log('🧹 FORCE CLEANUP: Removing all stuck connections');
    const stuckCount = this.peerConnections.size;
    
    this.peerConnections.forEach((pc, participantId) => {
      if (pc.connectionState === 'connecting' || pc.iceConnectionState === 'checking') {
        console.log(`🧹 FORCE CLEANUP: Closing stuck connection for ${participantId}`);
        pc.close();
      }
    });
    
    this.peerConnections.clear();
    
    if (stuckCount > 0) {
      this.connectionState.webrtc = 'disconnected';
      if (this.isHost) {
        this.connectionState.overall = this.connectionState.websocket;
      } else {
        this.updateOverallState();
      }
      console.log(`✅ FORCE CLEANUP: Cleared ${stuckCount} stuck connections`);
    }
  }

  private updateConnectionMetrics(participantId: string, metrics: any): void {
    const existing = this.connectionMetrics.get(participantId) || {};
    this.connectionMetrics.set(participantId, { ...existing, ...metrics, lastUpdate: Date.now() });
  }

  private setupHealthMonitoring(): void {
    // DESKTOP: Health monitoring menos agressivo
    if (this.isDesktop && !this.healthCheckInterval) {
      this.healthCheckInterval = setInterval(() => {
        // Só fazer health check se não estivermos em negociação inicial
        const now = Date.now();
        const hasRecentlyStarted = this.peerConnections.size > 0 && 
          Array.from(this.peerConnections.values()).some(pc => 
            pc.connectionState === 'connecting' || pc.connectionState === 'new'
          );
        
        if (!hasRecentlyStarted) {
          assessDesktopConnections(this.peerConnections, this.connectionMetrics, this.connectionTimeouts);
        } else {
          console.log('🩺 DESKTOP: Pulando health check - negociação em andamento');
        }
      }, DESKTOP_TIMEOUTS.healthCheckInterval); // 30s intervals
      
      console.log('🩺 DESKTOP: Health monitoring ativado (30s intervals com grace period)');
    }
  }

  // Método agora usa função importada para melhor modularidade
  private assessDesktopConnections(): void {
    assessDesktopConnections(this.peerConnections, this.connectionMetrics, this.connectionTimeouts);
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
