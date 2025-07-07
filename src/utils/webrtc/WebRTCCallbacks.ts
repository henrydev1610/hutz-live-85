
import signalingService from '@/services/WebSocketSignalingService';
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
    
    signalingService.setCallbacks({
      onUserConnected,
      onUserDisconnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // NEW: Stream event callbacks
      onStreamStarted: (data) => {
        console.log('🎥 HOST: Stream started event received:', data);
        if (this.onParticipantJoinCallback) {
          this.onParticipantJoinCallback(data.participantId);
        }
      },
      onVideoStream: (data) => {
        console.log('📹 HOST: Video stream event received:', data);
        // This would be triggered when a participant's video stream is ready
        if (this.onStreamCallback && data.stream) {
          this.onStreamCallback(data.participantId, data.stream);
        }
      },
      onParticipantVideo: (data) => {
        console.log('🎬 HOST: Participant video event received:', data);
        // Handle participant video updates
        if (this.onStreamCallback && data.hasStream) {
          // We need to get the actual stream from WebRTC connection
          console.log('📡 HOST: Participant has video stream available');
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
    
    signalingService.setCallbacks({
      onUserConnected,
      onParticipantsUpdate,
      onOffer,
      onAnswer,
      onIceCandidate,
      // NEW: Stream event callbacks for participants
      onStreamStarted: (data) => {
        console.log('🎥 PARTICIPANT: Stream started event received:', data);
      },
      onVideoStream: (data) => {
        console.log('📹 PARTICIPANT: Video stream event received:', data);
      },
      onParticipantVideo: (data) => {
        console.log('🎬 PARTICIPANT: Participant video event received:', data);
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
      signalingService.notifyStreamStarted(participantId, {
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
