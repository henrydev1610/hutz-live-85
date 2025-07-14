
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

export class WebRTCCallbacks {
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;

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
    
    unifiedWebSocketService.setCallbacks({
      onUserConnected,
      onUserDisconnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // NEW: Stream event callbacks
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 HOST: Stream started event received:', participantId, streamInfo);
        if (this.onParticipantJoinCallback) {
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
    onUserConnected: (data: any) => void,
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
      // NEW: Stream event callbacks for participants
      onStreamStarted: (participantId, streamInfo) => {
        console.log('🎥 PARTICIPANT: Stream started event received:', participantId, streamInfo);
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
