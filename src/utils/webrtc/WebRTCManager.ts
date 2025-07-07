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
  private isMobile: boolean = false;
  private connectionHandler: ConnectionHandler;
  private signalingHandler: SignalingHandler;
  private participantManager: ParticipantManager;
  private callbacksManager: WebRTCCallbacks;

  constructor() {
    console.log('🔧 UNIFIED WebRTC Manager initialized');
    this.detectMobile();
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());
    
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      console.log(`🎥 UNIFIED WebRTC: Stream received from ${participantId} (Mobile: ${this.isMobile})`);
      this.callbacksManager.triggerStreamCallback(participantId, stream);
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log(`👤 UNIFIED WebRTC: Participant ${participantId} joined (Mobile: ${this.isMobile})`);
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`📱 UNIFIED WebRTC: Mobile detected: ${this.isMobile}`);
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    console.log('📞 UNIFIED WebRTC: Setting stream callback');
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    console.log('👤 UNIFIED WebRTC: Setting participant join callback');
    this.callbacksManager.setOnParticipantJoinCallback(callback);
    this.participantManager.setOnParticipantJoinCallback(callback);
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 UNIFIED: Initializing as host for session: ${sessionId} (Mobile: ${this.isMobile})`);
    this.roomId = sessionId;
    this.isHost = true;

    try {
      await signalingService.connect();
      
      this.callbacksManager.setupHostCallbacks(
        (data) => {
          console.log(`👤 UNIFIED HOST: New participant connected (Mobile: ${this.isMobile}):`, data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.addParticipant(participantId, data);
          this.callbacksManager.triggerParticipantJoinCallback(participantId);
          this.connectionHandler.startHeartbeat(participantId);
        },
        (data) => {
          console.log(`👤 UNIFIED HOST: Participant disconnected (Mobile: ${this.isMobile}):`, data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.removeParticipant(participantId);
          this.removeParticipantConnection(participantId);
        },
        (participants) => {
          console.log(`👥 UNIFIED HOST: Participants updated (Mobile: ${this.isMobile}):`, participants);
          this.participantManager.updateParticipantsList(participants);
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );

      await signalingService.joinRoom(sessionId, `host-${Date.now()}`);
      console.log(`✅ UNIFIED HOST: Connected to signaling server (Mobile: ${this.isMobile})`);
      
    } catch (error) {
      console.error(`❌ UNIFIED HOST: Failed to initialize (Mobile: ${this.isMobile}):`, error);
      throw error;
    }
  }

  async initializeAsParticipant(sessionId: string, participantId: string, stream?: MediaStream): Promise<void> {
    console.log(`👤 UNIFIED: Initializing as participant ${participantId} for session ${sessionId} (Mobile: ${this.isMobile})`);
    this.roomId = sessionId;
    this.isHost = false;

    try {
      if (stream) {
        this.localStream = stream;
        console.log(`📹 UNIFIED: Using provided stream (Mobile: ${this.isMobile}):`, stream.getTracks().length, 'tracks');
      } else {
        const constraints = this.isMobile ? {
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        } : MEDIA_CONSTRAINTS;

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.localStream = mediaStream;
        console.log(`📹 UNIFIED: Local stream obtained (Mobile: ${this.isMobile}):`, mediaStream.getTracks().length, 'tracks');
      }

      await signalingService.connect();

      this.callbacksManager.setupParticipantCallbacks(
        participantId,
        (data) => {
          console.log(`🏠 UNIFIED PARTICIPANT: Host or participant connected (Mobile: ${this.isMobile}):`, data);
          const hostId = data.userId || data.id || data.socketId;
          if (hostId !== participantId) {
            console.log(`📞 UNIFIED: Initiating call to ${hostId} (Mobile: ${this.isMobile})`);
            this.connectionHandler.initiateCallWithRetry(hostId);
          }
        },
        (participants) => {
          console.log(`👥 UNIFIED PARTICIPANT: Participants updated (Mobile: ${this.isMobile}):`, participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== participantId && !this.peerConnections.has(pId)) {
              console.log(`📞 UNIFIED: Connecting to existing participant ${pId} (Mobile: ${this.isMobile})`);
              this.connectionHandler.initiateCallWithRetry(pId);
            }
          });
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );

      await signalingService.joinRoom(sessionId, participantId);
      console.log(`✅ UNIFIED PARTICIPANT: Connected to signaling server (Mobile: ${this.isMobile})`);
      
      if (this.localStream) {
        const streamInfo = {
          streamId: this.localStream.id,
          trackCount: this.localStream.getTracks().length,
          hasVideo: this.localStream.getVideoTracks().length > 0,
          hasAudio: this.localStream.getAudioTracks().length > 0,
          isMobile: this.isMobile,
          connectionType: 'unified'
        };
        
        signalingService.notifyStreamStarted(participantId, streamInfo);
        console.log(`📡 UNIFIED: Stream notification sent (Mobile: ${this.isMobile})`);
      }
      
    } catch (error) {
      console.error(`❌ UNIFIED PARTICIPANT: Failed to initialize (Mobile: ${this.isMobile}):`, error);
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
    console.log(`🧹 UNIFIED: Cleaning up WebRTC manager (Mobile: ${this.isMobile})`);
    
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
    
    console.log(`✅ UNIFIED: WebRTC cleanup completed (Mobile: ${this.isMobile})`);
  }
}
