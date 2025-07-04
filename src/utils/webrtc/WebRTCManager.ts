
import signalingService from '@/services/WebSocketSignalingService';
import { toast } from 'sonner';
import { ConnectionHandler } from './ConnectionHandler';
import { SignalingHandler } from './SignalingHandler';

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private isHost: boolean = false;
  private participants: Map<string, any> = new Map();
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;
  private connectionHandler: ConnectionHandler;
  private signalingHandler: SignalingHandler;

  constructor() {
    console.log('🔧 WebRTC Manager initialized');
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, this.participants);
    
    // Bind callbacks
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      if (this.onStreamCallback) {
        this.onStreamCallback(participantId, stream);
      }
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      if (this.onParticipantJoinCallback) {
        this.onParticipantJoinCallback(participantId);
      }
    });
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
    console.log('📞 Stream callback set');
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    this.onParticipantJoinCallback = callback;
    console.log('👤 Participant join callback set');
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 Initializing WebRTC as host for session: ${sessionId}`);
    this.roomId = sessionId;
    this.isHost = true;

    try {
      signalingService.setCallbacks({
        onUserConnected: (data) => {
          console.log('👤 New participant connected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.addParticipant(participantId, data);
          
          if (this.onParticipantJoinCallback) {
            console.log('🚀 Immediately calling participant join callback for:', participantId);
            this.onParticipantJoinCallback(participantId);
          }
          
          this.connectionHandler.startHeartbeat(participantId);
        },
        onUserDisconnected: (data) => {
          console.log('👤 Participant disconnected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.removeParticipant(participantId);
        },
        onParticipantsUpdate: (participants) => {
          console.log('👥 Participants list updated:', participants);
          this.updateParticipantsList(participants);
        },
        onOffer: this.signalingHandler.handleOffer.bind(this.signalingHandler),
        onAnswer: this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        onIceCandidate: this.signalingHandler.handleIceCandidate.bind(this.signalingHandler),
        onError: (error) => {
          console.error('❌ Signaling error:', error);
          if (!error.message?.includes('TypeID') && !error.message?.includes('UserMessageID')) {
            toast.error(`Erro de sinalização: ${error.message}`);
          }
        }
      });

      await signalingService.joinRoom(sessionId, `host-${Date.now()}`);
      console.log('✅ Host connected to signaling server');
      
    } catch (error) {
      console.error('❌ Failed to initialize host WebRTC:', error);
      console.log('⚠️ Operating in fallback mode');
    }
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 Initializing WebRTC as participant: ${participantId} for session: ${sessionId}`);
    this.roomId = sessionId;
    this.isHost = false;

    try {
      if (stream) {
        this.localStream = stream;
        console.log('📹 Using provided stream:', stream.getTracks().length, 'tracks');
      } else {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: true 
        });
        
        this.localStream = mediaStream;
        console.log('📹 Local stream obtained:', mediaStream.getTracks().length, 'tracks');
      }

      signalingService.setCallbacks({
        onUserConnected: (data) => {
          console.log('🏠 Host or participant connected:', data);
          const hostId = data.userId || data.id || data.socketId;
          if (hostId !== participantId) {
            console.log('📞 Participant initiating call to host:', hostId);
            this.connectionHandler.initiateCallWithRetry(hostId);
          }
        },
        onParticipantsUpdate: (participants) => {
          console.log('👥 Participants updated:', participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== participantId && !this.peerConnections.has(pId)) {
              console.log('📞 Connecting to existing participant:', pId);
              this.connectionHandler.initiateCallWithRetry(pId);
            }
          });
        },
        onOffer: this.signalingHandler.handleOffer.bind(this.signalingHandler),
        onAnswer: this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        onIceCandidate: this.signalingHandler.handleIceCandidate.bind(this.signalingHandler),
        onError: (error) => {
          console.error('❌ Participant signaling error:', error);
        }
      });

      await signalingService.joinRoom(sessionId, participantId);
      console.log('✅ Participant connected to signaling server');
      
    } catch (error) {
      console.error('❌ Failed to initialize participant WebRTC:', error);
      throw error;
    }
  }

  private updateParticipantsList(participants: any[]) {
    console.log('🔄 Updating participants list with:', participants);
    
    this.participants.clear();
    
    participants.forEach(participant => {
      const participantId = participant.userId || participant.id || participant.socketId;
      const participantData = {
        id: participantId,
        name: participant.userName || participant.name || `Participante ${participantId?.substring(0, 4) || 'Unknown'}`,
        joinedAt: participant.joinedAt || Date.now(),
        lastActive: participant.lastActive || Date.now(),
        active: participant.active !== false,
        hasVideo: participant.hasVideo || false,
        selected: false,
        browserType: participant.browserType || 'unknown'
      };
      
      this.participants.set(participantId, participantData);
      console.log(`📝 Updated participant: ${participantId}`);
      
      if (this.onParticipantJoinCallback) {
        this.onParticipantJoinCallback(participantId);
      }
    });
    
    this.notifyParticipantsChanged();
  }

  private addParticipant(participantId: string, data: any) {
    const participant = {
      id: participantId,
      name: data.userName || `Participante ${participantId.substring(0, 4)}`,
      joinedAt: data.timestamp || Date.now(),
      lastActive: Date.now(),
      active: true,
      hasVideo: false,
      selected: false,
      browserType: data.browserType || 'unknown'
    };
    
    console.log('➕ Adding participant:', participantId);
    this.participants.set(participantId, participant);
    this.notifyParticipantsChanged();
  }

  private removeParticipant(participantId: string) {
    if (this.participants.has(participantId)) {
      this.participants.delete(participantId);
      this.notifyParticipantsChanged();
    }
    
    if (this.peerConnections.has(participantId)) {
      this.peerConnections.get(participantId)?.close();
      this.peerConnections.delete(participantId);
    }
    
    this.connectionHandler.clearRetries(participantId);
  }

  private notifyParticipantsChanged() {
    const participantsList = Array.from(this.participants.values());
    console.log('📢 Notifying participants change:', participantsList.length);
    
    window.dispatchEvent(new CustomEvent('participants-updated', {
      detail: { participants: participantsList }
    }));
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  selectParticipant(participantId: string) {
    console.log(`👁️ Selecting participant: ${participantId}`);
    
    this.participants.forEach(participant => {
      participant.selected = false;
    });
    
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.selected = true;
      console.log(`✅ Participant ${participantId} selected`);
    }
    
    this.notifyParticipantsChanged();
  }

  cleanup() {
    console.log('🧹 Cleaning up WebRTC manager');
    
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`Closing peer connection for ${participantId}`);
      pc.close();
    });
    this.peerConnections.clear();
    this.connectionHandler.cleanup();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }
    
    this.participants.clear();
    signalingService.disconnect();
    
    this.roomId = null;
    this.isHost = false;
    
    console.log('✅ WebRTC cleanup completed');
  }
}
