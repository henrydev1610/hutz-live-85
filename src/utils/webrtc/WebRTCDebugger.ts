
import { streamLogger } from '../debug/StreamLogger';
import { toast } from 'sonner';

export interface WebRTCDebugContext {
  sessionId: string;
  participantId: string;
  isHost: boolean;
  isMobile: boolean;
  timestamp: number;
  phase: string;
  event: string;
  details: any;
}

export class WebRTCDebugger {
  private events: WebRTCDebugContext[] = [];
  private maxEvents = 500;
  private listeners: ((event: WebRTCDebugContext) => void)[] = [];

  constructor() {
    console.log('🔍 WebRTC Debugger initialized');
  }

  logEvent(
    sessionId: string,
    participantId: string,
    isHost: boolean,
    isMobile: boolean,
    phase: string,
    event: string,
    details: any = {}
  ) {
    const context: WebRTCDebugContext = {
      sessionId,
      participantId,
      isHost,
      isMobile,
      timestamp: Date.now(),
      phase,
      event,
      details
    };

    this.events.push(context);
    
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Color coding for different phases
    const phaseColors = {
      'WEBSOCKET': '#3B82F6',
      'WEBRTC': '#10B981', 
      'SIGNALING': '#8B5CF6',
      'STREAM': '#F59E0B',
      'HANDSHAKE': '#EF4444',
      'ICE': '#06B6D4',
      'MEDIA': '#EC4899'
    };

    const color = phaseColors[phase as keyof typeof phaseColors] || '#6B7280';
    const icon = isHost ? '👑' : '👤';
    const device = isMobile ? '📱' : '🖥️';
    
    console.log(`%c${icon}${device} [${phase}] ${event}`, `color: ${color}; font-weight: bold;`, {
      sessionId,
      participantId,
      details
    });

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(context);
      } catch (error) {
        console.error('Error in WebRTC debugger listener:', error);
      }
    });

    // Log critical events to StreamLogger
    if (phase === 'STREAM' || phase === 'WEBRTC') {
      streamLogger.log(
        'WEBRTC_SEND' as any,
        participantId,
        isMobile,
        isMobile ? 'mobile' : 'desktop',
        { timestamp: Date.now(), duration: 0 },
        details.stream ? {
          streamId: details.stream.id,
          active: details.stream.active,
          videoTracks: details.stream.getVideoTracks().length,
          audioTracks: details.stream.getAudioTracks().length
        } : undefined,
        phase,
        event,
        details
      );
    }
  }

  // Critical handshake event logging
  logWebSocketConnection(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, success: boolean) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'WEBSOCKET', 
      success ? 'WEBSOCKET_CONNECTED' : 'WEBSOCKET_FAILED', { success });
  }

  logRoomJoin(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, success: boolean) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'WEBSOCKET', 
      success ? 'ROOM_JOINED' : 'ROOM_JOIN_FAILED', { success });
  }

  logStreamNotification(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, streamInfo: any) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'STREAM', 'STREAM_NOTIFICATION_SENT', { streamInfo });
  }

  logOfferCreated(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, offer: RTCSessionDescriptionInit) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'OFFER_CREATED', { 
      type: offer.type,
      sdpLines: offer.sdp?.split('\n').length || 0
    });
  }

  logOfferSent(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, targetId: string) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'OFFER_SENT', { targetId });
  }

  logOfferReceived(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, fromId: string) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'OFFER_RECEIVED', { fromId });
  }

  logAnswerCreated(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, answer: RTCSessionDescriptionInit) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'ANSWER_CREATED', { 
      type: answer.type,
      sdpLines: answer.sdp?.split('\n').length || 0
    });
  }

  logAnswerSent(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, targetId: string) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'ANSWER_SENT', { targetId });
  }

  logAnswerReceived(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, fromId: string) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'HANDSHAKE', 'ANSWER_RECEIVED', { fromId });
  }

  logICECandidate(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, candidate: RTCIceCandidate) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'ICE', 'ICE_CANDIDATE', { 
      type: candidate.type,
      protocol: candidate.protocol,
      address: candidate.address
    });
  }

  logConnectionStateChange(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, 
    targetId: string, state: RTCPeerConnectionState) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'WEBRTC', 'CONNECTION_STATE_CHANGE', { 
      targetId, 
      state,
      isConnected: state === 'connected'
    });

    // Toast for critical state changes
    if (state === 'connected') {
      toast.success(`🎉 WebRTC conectado com ${targetId}`);
    } else if (state === 'failed') {
      toast.error(`❌ WebRTC falhou com ${targetId}`);
    } else if (state === 'disconnected') {
      toast.warning(`⚠️ WebRTC desconectado de ${targetId}`);
    }
  }

  logStreamReceived(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, 
    fromId: string, stream: MediaStream) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'STREAM', 'STREAM_RECEIVED', { 
      fromId,
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoSettings: stream.getVideoTracks()[0]?.getSettings()
    });
  }

  logStreamSent(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, 
    toId: string, stream: MediaStream) {
    this.logEvent(sessionId, participantId, isHost, isMobile, 'STREAM', 'STREAM_SENT', { 
      toId,
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoSettings: stream.getVideoTracks()[0]?.getSettings()
    });
  }

  // Critical failure logging
  logCriticalFailure(sessionId: string, participantId: string, isHost: boolean, isMobile: boolean, 
    phase: string, error: Error) {
    this.logEvent(sessionId, participantId, isHost, isMobile, phase, 'CRITICAL_FAILURE', { 
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    toast.error(`🚨 Erro crítico em ${phase}: ${error.message}`);
  }

  // Analysis methods
  getHandshakeFlow(sessionId: string, participantId: string): WebRTCDebugContext[] {
    return this.events.filter(e => 
      e.sessionId === sessionId && 
      e.participantId === participantId &&
      e.phase === 'HANDSHAKE'
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  getStreamFlow(sessionId: string, participantId: string): WebRTCDebugContext[] {
    return this.events.filter(e => 
      e.sessionId === sessionId && 
      e.participantId === participantId &&
      e.phase === 'STREAM'
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  getConnectionStates(sessionId: string, participantId: string): WebRTCDebugContext[] {
    return this.events.filter(e => 
      e.sessionId === sessionId && 
      e.participantId === participantId &&
      e.event === 'CONNECTION_STATE_CHANGE'
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  // Real-time monitoring
  addListener(listener: (event: WebRTCDebugContext) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (event: WebRTCDebugContext) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  clearEvents() {
    this.events = [];
  }
}

// Singleton instance
export const webRTCDebugger = new WebRTCDebugger();
