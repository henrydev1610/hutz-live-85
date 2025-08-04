// UnifiedWebRTCManager.ts

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
  maxRetries: 2,
  initialDelay: 3000,
  maxDelay: 15000,
  multiplier: 2
};

export class UnifiedWebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private isHost: boolean = false;
  private isMobile: boolean = false;

  private connectionHandler: ConnectionHandler;
  private signalingHandler: SignalingHandler;
  private participantManager: ParticipantManager;
  private callbacksManager: WebRTCCallbacks;

  private connectionState: ConnectionState = {
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  };

  private webrtcReady: boolean = false;

  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
  private retryAttempts: Map<string, number> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

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
    });
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId}`);
    this.cleanup();

    this.roomId = sessionId;
    this.participantId = participantId;
    this.isHost = false;

    console.log('🔗 PARTICIPANT: Connecting to WebSocket...');
    await unifiedWebSocketService.connect();

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

      this.connectionHandler.setStreamCallback((participantId, stream) => {
        console.log(`🎥 CALLBACK-CRÍTICO: Stream callback disparado para ${participantId}`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active
        });
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

      this.updateConnectionState('websocket', 'connected');

      if (this.localStream) {
        await this.notifyLocalStream();

        console.log('⏳ CALLBACK-CRÍTICO: Aguardando estabilização antes do WebRTC...');
        await new Promise(resolve => setTimeout(resolve, 1500));

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

          // 🔧 Adicionando tracks ao PeerConnection antes do handshake
          console.log(`🔧 Adicionando tracks ao PeerConnection antes do handshake`);
          const hostConnection = this.connectionHandler.createPeerConnection('host');

          this.localStream.getTracks().forEach(track => {
            hostConnection.addTrack(track, this.localStream!);
            console.log(`✅ Track ${track.kind} adicionada com sucesso`);
          });

          await this.connectionHandler.initiateCallWithRetry('host');
          this.updateConnectionState('webrtc', 'connecting');

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

  // ... restante da classe permanece inalterado ...
}
