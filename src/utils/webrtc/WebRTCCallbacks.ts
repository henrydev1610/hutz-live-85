
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';
import { ConnectionHandler } from './ConnectionHandler';
import { webRTCDebugger } from './WebRTCDebugger';

export class WebRTCCallbacks {
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private currentSessionId: string | null = null;
  private currentParticipantId: string | null = null;
  private isHost: boolean = false;
  private isMobile: boolean = false;

  constructor() {
    console.log('🔄 WebRTCCallbacks: Initialized');
    this.detectMobile();
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setConnectionHandler(handler: ConnectionHandler) {
    this.connectionHandler = handler;
    console.log('🔄 WebRTCCallbacks: Connection handler set');
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
    console.log('📞 Stream callback set');
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    this.onParticipantJoinCallback = callback;
    console.log('👤 Participant join callback set');
  }

  setupHostCallbacks(
    onUserConnected: (data: any) => void,
    onUserDisconnected: (data: any) => void,
    onParticipantsUpdate: (participants: any[]) => void,
    onOffer: (data: any) => void,
    onAnswer: (data: any) => void,
    onIceCandidate: (data: any) => void
  ) {
    console.log('🎯 Setting up HOST callbacks with stream event listeners');
    
    this.isHost = true;
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onUserDisconnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 HOST: Stream started event received:', participantId, streamInfo);
        
        // CRITICAL: Log stream started event
        if (this.currentSessionId) {
          webRTCDebugger.logEvent(
            this.currentSessionId,
            this.currentParticipantId || 'host',
            true,
            this.isMobile,
            'STREAM',
            'STREAM_STARTED_EVENT_RECEIVED',
            { 
              fromParticipant: participantId,
              streamInfo,
              timestamp: Date.now()
            }
          );
        }
        
        // FASE 1: Host deve iniciar uma oferta quando receber notificação de stream
        if (this.connectionHandler && participantId) {
          console.log(`🚀 HOST: Iniciando oferta WebRTC para ${participantId} após receber notificação de stream`);
          
          // CRITICAL: Log WebRTC handshake initiation
          if (this.currentSessionId) {
            webRTCDebugger.logEvent(
              this.currentSessionId,
              this.currentParticipantId || 'host',
              true,
              this.isMobile,
              'HANDSHAKE',
              'HANDSHAKE_INITIATED_BY_HOST',
              { 
                targetParticipant: participantId,
                trigger: 'stream_started_event'
              }
            );
          }
          
          // Primeiro garantir que o callback de participante seja disparado
          if (this.onParticipantJoinCallback) {
            console.log(`👤 HOST: Disparando callback de novo participante para ${participantId}`);
            this.onParticipantJoinCallback(participantId);
          }
          
          // CRITICAL FIX: Iniciar oferta WebRTC com retry automaticamente
          setTimeout(() => {
            if (this.connectionHandler) {
              console.log(`📞 HOST: Iniciando chamada WebRTC para ${participantId} com retry logic`);
              this.connectionHandler.initiateCallWithRetry(participantId, 5);
            } else {
              console.error(`❌ HOST: ConnectionHandler não está disponível para iniciar chamada para ${participantId}`);
              
              // CRITICAL: Log connection handler failure
              if (this.currentSessionId) {
                webRTCDebugger.logCriticalFailure(
                  this.currentSessionId,
                  this.currentParticipantId || 'host',
                  true,
                  this.isMobile,
                  'HANDSHAKE',
                  new Error('ConnectionHandler not available for WebRTC handshake')
                );
              }
            }
          }, 500); // Pequeno delay para garantir que tudo esteja pronto
        } else {
          console.error(`❌ HOST: Não foi possível iniciar oferta para ${participantId} - connectionHandler ${this.connectionHandler ? 'disponível' : 'indisponível'}`);
          
          // CRITICAL: Log handshake failure
          if (this.currentSessionId) {
            webRTCDebugger.logCriticalFailure(
              this.currentSessionId,
              this.currentParticipantId || 'host',
              true,
              this.isMobile,
              'HANDSHAKE',
              new Error('Cannot initiate WebRTC handshake - missing connectionHandler or participantId')
            );
          }
        }
      },
      onError: (error) => {
        console.error('❌ Signaling error:', error);
        
        // CRITICAL: Log signaling errors
        if (this.currentSessionId) {
          webRTCDebugger.logCriticalFailure(
            this.currentSessionId,
            this.currentParticipantId || 'host',
            true,
            this.isMobile,
            'SIGNALING',
            error
          );
        }
        
        if (!error.message?.includes('TypeID') && !error.message?.includes('UserMessageID')) {
          toast.error(`Erro de sinalização: ${error.message}`);
        }
      }
    });
  }

  setupParticipantCallbacks(
    participantId: string,
    onUserConnected: (data: any) => void,
    onParticipantsUpdate: (participants: any[]) => void,
    onOffer: (data: any) => void,
    onAnswer: (data: any) => void,
    onIceCandidate: (data: any) => void
  ) {
    console.log('🎯 Setting up PARTICIPANT callbacks for:', participantId);
    
    this.isHost = false;
    this.currentParticipantId = participantId;
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks for participants
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 PARTICIPANT: Stream started event received:', participantId, streamInfo);
        
        // CRITICAL: Log stream started event
        if (this.currentSessionId) {
          webRTCDebugger.logEvent(
            this.currentSessionId,
            this.currentParticipantId || 'participant',
            false,
            this.isMobile,
            'STREAM',
            'STREAM_STARTED_EVENT_RECEIVED',
            { 
              fromParticipant: participantId,
              streamInfo,
              timestamp: Date.now()
            }
          );
        }
        
        // FASE 1: Participante também deve iniciar uma oferta quando necessário
        if (this.connectionHandler && participantId) {
          console.log(`🔄 PARTICIPANT: Verificando necessidade de iniciar oferta para ${participantId}`);
          // Participante só inicia oferta se necessário (ex: host desconectou e reconectou)
          // Esta lógica já existe no código atual do participante
        }
      },
      onError: (error) => {
        console.error('❌ Participant signaling error:', error);
        
        // CRITICAL: Log participant signaling errors
        if (this.currentSessionId) {
          webRTCDebugger.logCriticalFailure(
            this.currentSessionId,
            this.currentParticipantId || 'participant',
            false,
            this.isMobile,
            'SIGNALING',
            error
          );
        }
      }
    });
  }

  // Set current session context for logging
  setSessionContext(sessionId: string, participantId: string) {
    this.currentSessionId = sessionId;
    this.currentParticipantId = participantId;
    console.log(`📝 WebRTCCallbacks: Session context set - ${sessionId}/${participantId}`);
  }

  triggerStreamCallback(participantId: string, stream: MediaStream) {
    console.log('🚀 TRIGGERING stream callback for:', participantId, {
      streamId: stream.id,
      tracks: stream.getTracks().length,
      active: stream.active
    });
    
    // CRITICAL: Log stream callback trigger
    if (this.currentSessionId) {
      webRTCDebugger.logStreamReceived(
        this.currentSessionId,
        this.currentParticipantId || 'unknown',
        this.isHost,
        this.isMobile,
        participantId,
        stream
      );
    }
    
    if (this.onStreamCallback) {
      this.onStreamCallback(participantId, stream);
      
      // Notify signaling server about the stream
      unifiedWebSocketService.notifyStreamStarted(participantId, {
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        hasVideo: stream.getVideoTracks().length > 0,
        hasAudio: stream.getAudioTracks().length > 0
      });
    } else {
      console.warn('⚠️ No stream callback set when trying to trigger');
      
      // CRITICAL: Log missing callback
      if (this.currentSessionId) {
        webRTCDebugger.logEvent(
          this.currentSessionId,
          this.currentParticipantId || 'unknown',
          this.isHost,
          this.isMobile,
          'STREAM',
          'STREAM_CALLBACK_MISSING',
          { participantId }
        );
      }
    }
  }

  triggerParticipantJoinCallback(participantId: string) {
    console.log('🚀 TRIGGERING participant join callback for:', participantId);
    
    // CRITICAL: Log participant join callback trigger
    if (this.currentSessionId) {
      webRTCDebugger.logEvent(
        this.currentSessionId,
        this.currentParticipantId || 'unknown',
        this.isHost,
        this.isMobile,
        'WEBRTC',
        'PARTICIPANT_JOIN_CALLBACK_TRIGGERED',
        { participantId }
      );
    }
    
    if (this.onParticipantJoinCallback) {
      this.onParticipantJoinCallback(participantId);
    } else {
      console.warn('⚠️ No participant join callback set when trying to trigger');
      
      // CRITICAL: Log missing callback
      if (this.currentSessionId) {
        webRTCDebugger.logEvent(
          this.currentSessionId,
          this.currentParticipantId || 'unknown',
          this.isHost,
          this.isMobile,
          'WEBRTC',
          'PARTICIPANT_JOIN_CALLBACK_MISSING',
          { participantId }
        );
      }
    }
  }
}
