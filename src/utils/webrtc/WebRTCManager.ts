
import signalingService from '@/services/WebSocketSignalingService';
import { ConnectionHandler } from './ConnectionHandler';
import { SignalingHandler } from './SignalingHandler';
import { ParticipantManager } from './ParticipantManager';
import { WebRTCCallbacks } from './WebRTCCallbacks';
import { MEDIA_CONSTRAINTS } from './WebRTCConfig';

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private isHost: boolean = false;
  private connectionHandler: ConnectionHandler;
  private signalingHandler: SignalingHandler;
  private participantManager: ParticipantManager;
  private callbacksManager: WebRTCCallbacks;

  constructor() {
    console.log('🔧 WebRTC Manager initialized');
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());
    
    // Bind callbacks
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      this.callbacksManager.triggerStreamCallback(participantId, stream);
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    this.callbacksManager.setOnParticipantJoinCallback(callback);
    this.participantManager.setOnParticipantJoinCallback(callback);
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 Initializing WebRTC as host for session: ${sessionId}`);
    this.roomId = sessionId;
    this.isHost = true;

    try {
      this.callbacksManager.setupHostCallbacks(
        (data) => {
          console.log('👤 New participant connected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.addParticipant(participantId, data);
          
          this.callbacksManager.triggerParticipantJoinCallback(participantId);
          this.connectionHandler.startHeartbeat(participantId);
        },
        (data) => {
          console.log('👤 Participant disconnected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.removeParticipant(participantId);
          this.removeParticipantConnection(participantId);
        },
        (participants) => {
          console.log('👥 Participants list updated:', participants);
          this.participantManager.updateParticipantsList(participants);
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );

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
        const mediaStream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
        this.localStream = mediaStream;
        console.log('📹 Local stream obtained:', mediaStream.getTracks().length, 'tracks');
      }

      this.callbacksManager.setupParticipantCallbacks(
        participantId,
        (data) => {
          console.log('🏠 Host or participant connected:', data);
          const hostId = data.userId || data.id || data.socketId;
          if (hostId !== participantId) {
            console.log('📞 Participant initiating call to host:', hostId);
            this.connectionHandler.initiateCallWithRetry(hostId);
          }
        },
        (participants) => {
          console.log('👥 Participants updated:', participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== participantId && !this.peerConnections.has(pId)) {
              console.log('📞 Connecting to existing participant:', pId);
              this.connectionHandler.initiateCallWithRetry(pId);
            }
          });
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );

      await signalingService.joinRoom(sessionId, participantId);
      console.log('✅ Participant connected to signaling server');
      
    } catch (error) {
      console.error('❌ Failed to initialize participant WebRTC:', error);
      throw error;
    }
  }

  private removeParticipantConnection(participantId: string) {
    if (this.peerConnections.has(participantId)) {
      this.peerConnections.get(participantId)?.close();
      this.peerConnections.delete(participantId);
    }
    this.connectionHandler.clearRetries(participantId);
  }

  getParticipants() {
    return this.participantManager.getParticipants();
  }

  selectParticipant(participantId: string) {
    this.participantManager.selectParticipant(participantId);
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
    
    this.participantManager.cleanup();
    signalingService.disconnect();
    
    this.roomId = null;
    this.isHost = false;
    
    console.log('✅ WebRTC cleanup completed');
  }
}
