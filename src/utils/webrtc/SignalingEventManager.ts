// FASE 1: Gerenciador centralizado de eventos de sinalização com logs estruturados

import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

export interface SignalingEvent {
  type: 'connection' | 'offer' | 'answer' | 'ice-candidate' | 'error' | 'room-joined';
  participantId?: string;
  data?: any;
  timestamp: number;
  source: string;
}

export class SignalingEventManager {
  private static instance: SignalingEventManager;
  private eventLog: SignalingEvent[] = [];
  private maxLogSize = 100;
  private listeners: Map<string, Array<(event: SignalingEvent) => void>> = new Map();

  static getInstance(): SignalingEventManager {
    if (!SignalingEventManager.instance) {
      SignalingEventManager.instance = new SignalingEventManager();
    }
    return SignalingEventManager.instance;
  }

  // FASE 1: Inicializar com WebSocket service
  initialize(): void {
    console.log('🎯 SIGNALING: Initializing event manager');

    // Verificar conexão WebSocket
    const connectionStatus = unifiedWebSocketService.getConnectionStatus();
    this.logEvent({
      type: 'connection',
      data: { status: connectionStatus, url: 'WSS connection established' },
      timestamp: Date.now(),
      source: 'SignalingEventManager'
    });

    // Listen for WebSocket connection events
    unifiedWebSocketService.on('connect', () => {
      this.logEvent({
        type: 'connection',
        data: { status: 'connected', protocol: 'WSS' },
        timestamp: Date.now(),
        source: 'UnifiedWebSocketService'
      });
      console.log('✅ SIGNALING: WSS connected - Status 101 established');
    });

    unifiedWebSocketService.on('disconnect', (reason) => {
      this.logEvent({
        type: 'error',
        data: { reason, type: 'disconnect' },
        timestamp: Date.now(),
        source: 'UnifiedWebSocketService'
      });
      console.warn('⚠️ SIGNALING: WSS disconnected:', reason);
    });

    unifiedWebSocketService.on('error', (error) => {
      this.logEvent({
        type: 'error',
        data: { error: error.message || error },
        timestamp: Date.now(),
        source: 'UnifiedWebSocketService'
      });
      console.error('❌ SIGNALING: WSS error:', error);
    });
  }

  // FASE 1: Log estruturado de eventos
  logEvent(event: Omit<SignalingEvent, 'timestamp'> & { timestamp?: number }): void {
    const fullEvent: SignalingEvent = {
      ...event,
      timestamp: event.timestamp || Date.now()
    };

    this.eventLog.push(fullEvent);
    
    // Manter tamanho máximo do log
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Log estruturado no console
    const logPrefix = this.getLogPrefix(fullEvent.type);
    console.log(`${logPrefix} ${fullEvent.source}:`, {
      type: fullEvent.type,
      participantId: fullEvent.participantId,
      data: fullEvent.data,
      timestamp: new Date(fullEvent.timestamp).toISOString()
    });

    // Notificar listeners
    const typeListeners = this.listeners.get(fullEvent.type) || [];
    typeListeners.forEach(listener => {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error('❌ SIGNALING: Listener error:', error);
      }
    });
  }

  private getLogPrefix(type: string): string {
    switch (type) {
      case 'connection': return '🔗 SIGNALING';
      case 'offer': return '📤 OFFER';
      case 'answer': return '📥 ANSWER';
      case 'ice-candidate': return '🧊 ICE';
      case 'error': return '❌ ERROR';
      case 'room-joined': return '🏠 ROOM';
      default: return '📡 SIGNALING';
    }
  }

  // FASE 1: Logs específicos para eventos críticos
  logOfferCreated(participantId: string, sdp: string): void {
    this.logEvent({
      type: 'offer',
      participantId,
      data: { 
        action: 'created',
        sdpType: 'offer',
        sdpSize: sdp.length,
        hasVideo: sdp.includes('m=video'),
        hasAudio: sdp.includes('m=audio')
      },
      source: 'WebRTC'
    });
  }

  logOfferApplied(participantId: string): void {
    this.logEvent({
      type: 'offer',
      participantId,
      data: { action: 'applied' },
      source: 'WebRTC'
    });
  }

  logAnswerReceived(participantId: string): void {
    this.logEvent({
      type: 'answer',
      participantId,
      data: { action: 'received' },
      source: 'WebRTC'
    });
  }

  logIcePairSelected(participantId: string, pair: { local: string; remote: string; type: string }): void {
    this.logEvent({
      type: 'ice-candidate',
      participantId,
      data: { 
        action: 'pair-selected',
        localType: pair.local,
        remoteType: pair.remote,
        connectionType: pair.type // host/srflx/relay
      },
      source: 'WebRTC'
    });
    
    console.log(`🎯 ICE: Pair selected for ${participantId} - ${pair.local} ↔ ${pair.remote} (${pair.type})`);
  }

  logOnTrackReceived(participantId: string, streamId: string): void {
    this.logEvent({
      type: 'connection',
      participantId,
      data: { 
        action: 'ontrack-received',
        streamId,
        timestamp: Date.now()
      },
      source: 'WebRTC'
    });
    
    console.log(`🎥 ONTRACK: Stream received for ${participantId} (${streamId})`);
  }

  logPlaybackStarted(participantId: string, videoElement: HTMLVideoElement): void {
    this.logEvent({
      type: 'connection',
      participantId,
      data: { 
        action: 'playback-started',
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        autoplay: videoElement.autoplay,
        playsInline: videoElement.playsInline
      },
      source: 'VideoRenderer'
    });
    
    console.log(`▶️ PLAYBACK: Started for ${participantId} (${videoElement.videoWidth}x${videoElement.videoHeight})`);
  }

  logRecaptureAndReplace(participantId: string, reason: string): void {
    this.logEvent({
      type: 'connection',
      participantId,
      data: { 
        action: 'recapture-replace',
        reason,
        timestamp: Date.now()
      },
      source: 'ParticipantCapture'
    });
    
    console.log(`🔄 RECAPTURE: Track replaced for ${participantId} (${reason})`);
  }

  // Listeners para eventos
  addEventListener(type: string, listener: (event: SignalingEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: SignalingEvent) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index > -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  // FASE 5: Diagnósticos e relatórios
  getEventLog(): SignalingEvent[] {
    return [...this.eventLog];
  }

  getConnectionHealth(): {
    wsConnected: boolean;
    lastConnectionTime: number | null;
    errorCount: number;
    successfulOffers: number;
    successfulAnswers: number;
  } {
    const connectionEvents = this.eventLog.filter(e => e.type === 'connection');
    const errorEvents = this.eventLog.filter(e => e.type === 'error');
    const offerEvents = this.eventLog.filter(e => e.type === 'offer');
    const answerEvents = this.eventLog.filter(e => e.type === 'answer');

    const lastConnection = connectionEvents
      .filter(e => e.data?.status === 'connected')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return {
      wsConnected: unifiedWebSocketService.getConnectionStatus() === 'connected',
      lastConnectionTime: lastConnection?.timestamp || null,
      errorCount: errorEvents.length,
      successfulOffers: offerEvents.filter(e => e.data?.action === 'created').length,
      successfulAnswers: answerEvents.filter(e => e.data?.action === 'received').length
    };
  }

  // FASE 5: Relatório diagnóstico estruturado
  generateDiagnosticReport(): {
    timestamp: number;
    signaling: any;
    events: SignalingEvent[];
  } {
    return {
      timestamp: Date.now(),
      signaling: this.getConnectionHealth(),
      events: this.getEventLog().slice(-20) // Últimos 20 eventos
    };
  }
}

// Singleton global
export const signalingEventManager = SignalingEventManager.getInstance();