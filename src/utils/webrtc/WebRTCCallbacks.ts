
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
        console.log('🎥 HOST: Stream started event received:', participantId);
        console.log('🎥 HOST: Stream info:', streamInfo);
        
        // HOST APENAS RECEBE - não inicia handshake
        console.log('✅ HOST: Stream event received, aguardando offer do participante');
        
        // Apenas disparar callbacks de notificação
        if (this.onParticipantJoinCallback) {
          console.log(`👤 HOST: Notificando novo participante: ${participantId}`);
          this.onParticipantJoinCallback(participantId);
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
        // Participante não inicia handshake aqui - isso é feito via connectToHost()
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
