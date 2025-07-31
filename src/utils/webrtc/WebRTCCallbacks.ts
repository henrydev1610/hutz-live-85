
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';
import { ConnectionHandler } from './ConnectionHandler';

export class WebRTCCallbacks {
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;
  private connectionHandler: ConnectionHandler | null = null;

  constructor() {
    console.log('🔄 WebRTCCallbacks: Initialized');
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
    onUserConnected: (data: { userId: string, socketId: string, timestamp: number, networkQuality: string }) => void,
    onUserDisconnected: (userId: string) => void,
    onParticipantsUpdate: (participants: any[]) => void,
    onOffer: (data: any) => void,
    onAnswer: (data: any) => void,
    onIceCandidate: (data: any) => void
  ) {
    console.log('🎯 Setting up HOST callbacks with stream event listeners');
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onUserDisconnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 WEBRTC DEBUG: ===== STREAM STARTED EVENT =====');
        console.log('🎥 WEBRTC DEBUG: HOST recebeu stream started:', participantId);
        console.log('🎥 WEBRTC DEBUG: Stream info:', streamInfo);
        console.log('🎥 WEBRTC DEBUG: ConnectionHandler disponível:', !!this.connectionHandler);
        console.log('🎥 WEBRTC DEBUG: Stream callback disponível:', !!this.onStreamCallback);
        console.log('🎥 WEBRTC DEBUG: Join callback disponível:', !!this.onParticipantJoinCallback);
        
        // CORREÇÃO CRÍTICA: Verificar se callback está registrado ANTES de iniciar handshake
        if (this.connectionHandler && participantId && this.onStreamCallback) {
          console.log(`🚀 WEBRTC DEBUG: Todos os callbacks estão prontos - iniciando oferta WebRTC para ${participantId}`);
          
          // Primeiro garantir que o callback de participante seja disparado
          if (this.onParticipantJoinCallback) {
            console.log(`👤 WEBRTC DEBUG: Disparando callback de novo participante para ${participantId}`);
            this.onParticipantJoinCallback(participantId);
          }
          
          // CRITICAL FIX: Iniciar oferta WebRTC com retry automaticamente
          console.log(`⏳ WEBRTC DEBUG: Aguardando 500ms antes de iniciar chamada WebRTC...`);
          setTimeout(() => {
            if (this.connectionHandler) {
              console.log(`📞 WEBRTC DEBUG: Iniciando chamada WebRTC para ${participantId} com ${5} tentativas`);
              this.connectionHandler.initiateCallWithRetry(participantId, 5);
            } else {
              console.error(`❌ WEBRTC DEBUG: ConnectionHandler não disponível após delay para ${participantId}`);
            }
          }, 500); // Pequeno delay para garantir que tudo esteja pronto
        } else {
          console.error(`❌ WEBRTC DEBUG: NÃO foi possível iniciar oferta para ${participantId}`, {
            connectionHandler: !!this.connectionHandler,
            participantId: !!participantId,
            streamCallback: !!this.onStreamCallback,
            joinCallback: !!this.onParticipantJoinCallback
          });
          
          // RETRY LOGIC: Aguardar callback ser registrado
          if (!this.onStreamCallback) {
            console.log(`⏳ WEBRTC DEBUG: Aguardando callback ser registrado para ${participantId}...`);
            let tentativas = 0;
            const maxTentativas = 50; // 5 segundos
            
            const checkCallback = () => {
              tentativas++;
              console.log(`🔄 WEBRTC DEBUG: Tentativa ${tentativas}/${maxTentativas} - verificando callbacks para ${participantId}`);
              
              if (this.onStreamCallback && this.connectionHandler) {
                console.log(`✅ WEBRTC DEBUG: Callbacks disponíveis após ${tentativas} tentativas - iniciando chamada para ${participantId}`);
                this.connectionHandler.initiateCallWithRetry(participantId, 5);
              } else if (tentativas < maxTentativas) {
                setTimeout(checkCallback, 100);
              } else {
                console.error(`❌ WEBRTC DEBUG: Timeout aguardando callbacks para ${participantId} após ${tentativas} tentativas`);
              }
            };
            setTimeout(checkCallback, 100);
          }
        }
      },
      onError: (error) => {
        console.error('❌ Signaling error:', error);
        if (!error.message?.includes('TypeID') && !error.message?.includes('UserMessageID')) {
          toast.error(`Erro de sinalização: ${error.message}`);
        }
      }
    });
  }

  setupParticipantCallbacks(
    participantId: string,
    onUserConnected: (data: { userId: string, socketId: string, timestamp: number, networkQuality: string }) => void,
    onParticipantsUpdate: (participants: any[]) => void,
    onOffer: (data: any) => void,
    onAnswer: (data: any) => void,
    onIceCandidate: (data: any) => void
  ) {
    console.log('🎯 Setting up PARTICIPANT callbacks for:', participantId);
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks for participants
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 PARTICIPANT: Stream started event received:', participantId, streamInfo);
        
        // FASE 1: Participante também deve iniciar uma oferta quando necessário
        if (this.connectionHandler && participantId) {
          console.log(`🔄 PARTICIPANT: Verificando necessidade de iniciar oferta para ${participantId}`);
          // Participante só inicia oferta se necessário (ex: host desconectou e reconectou)
          // Esta lógica já existe no código atual do participante
        }
      },
      onError: (error) => {
        console.error('❌ Participant signaling error:', error);
      }
    });
  }

  triggerStreamCallback(participantId: string, stream: MediaStream) {
    console.log('🚀 TRIGGERING stream callback for:', participantId, {
      streamId: stream.id,
      tracks: stream.getTracks().length,
      active: stream.active
    });
    
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
    }
  }

  triggerParticipantJoinCallback(participantId: string) {
    console.log('🚀 TRIGGERING participant join callback for:', participantId);
    
    if (this.onParticipantJoinCallback) {
      this.onParticipantJoinCallback(participantId);
    } else {
      console.warn('⚠️ No participant join callback set when trying to trigger');
    }
  }
}
