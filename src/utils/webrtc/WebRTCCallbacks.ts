
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';
import { ConnectionHandler } from './ConnectionHandler';

export class WebRTCCallbacks {
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;
  private connectionHandler: ConnectionHandler | null = null;

  constructor() {
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔄 [WRTC] Callbacks initialized');
  }

  setConnectionHandler(handler: ConnectionHandler) {
    this.connectionHandler = handler;
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔄 [WRTC] Connection handler set');
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('📞 [WRTC] Stream callback set');
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    this.onParticipantJoinCallback = callback;
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('👤 [WRTC] Participant callback set');
  }

  setupHostCallbacks(
    onUserConnected: (data: { userId: string, socketId: string, timestamp: number, networkQuality: string }) => void,
    onUserDisconnected: (userId: string) => void,
    onParticipantsUpdate: (participants: any[]) => void,
    onOffer: (data: any) => void,
    onAnswer: (data: any) => void,
    onIceCandidate: (data: any) => void
  ) {
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🎯 [HOST] Setting up callbacks');
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onUserDisconnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks
      onStreamStarted: (participantId, streamInfo) => {
        console.log(`🎥 [HOST] Stream started: ${participantId}`);
        const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
        if (DEBUG) console.log('🎥 [HOST] Stream info:', streamInfo);
        
        // Notificar novo participante
        if (this.onParticipantJoinCallback) {
          this.onParticipantJoinCallback(participantId);
        }
      },
      onError: (error) => {
        if (!error.message?.includes('TypeID') && !error.message?.includes('UserMessageID')) {
          console.error('❌ [HOST] Signaling error:', error.message);
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
    console.log(`🎯 [PART] Setting up callbacks: ${participantId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // Stream event callbacks for participants
      onStreamStarted: (participantId, streamInfo) => {
        if (DEBUG) console.log(`🎥 [PART] Stream started: ${participantId}`);
      },
      onError: (error) => {
        console.error('❌ [PART] Signaling error:', error.message);
      }
    });
  }

  triggerStreamCallback(participantId: string, stream: MediaStream) {
    console.log(`🚀 [WRTC] Stream callback: ${participantId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) {
      console.log('🚀 [WRTC] Stream details:', {
        streamId: stream.id,
        tracks: stream.getTracks().length,
        active: stream.active
      });
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
      console.warn('⚠️ [WRTC] No stream callback set');
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
