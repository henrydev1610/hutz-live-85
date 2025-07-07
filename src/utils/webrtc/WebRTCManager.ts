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
    console.log('🔧 WebRTC Manager initialized');
    this.detectMobile();
    this.participantManager = new ParticipantManager();
    this.callbacksManager = new WebRTCCallbacks();
    this.connectionHandler = new ConnectionHandler(this.peerConnections, () => this.localStream);
    this.signalingHandler = new SignalingHandler(this.peerConnections, new Map());
    
    this.connectionHandler.setStreamCallback((participantId, stream) => {
      console.log('🎥 WEBRTC MANAGER: Stream received from ConnectionHandler:', participantId);
      this.callbacksManager.triggerStreamCallback(participantId, stream);
    });
    
    this.connectionHandler.setParticipantJoinCallback((participantId) => {
      console.log('👤 WEBRTC MANAGER: Participant joined from ConnectionHandler:', participantId);
      this.callbacksManager.triggerParticipantJoinCallback(participantId);
    });
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('📱 WEBRTC: Mobile detected:', this.isMobile);
  }

  setOnStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    console.log('📞 WEBRTC MANAGER: Setting stream callback');
    this.callbacksManager.setOnStreamCallback(callback);
  }

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    console.log('👤 WEBRTC MANAGER: Setting participant join callback');
    this.callbacksManager.setOnParticipantJoinCallback(callback);
    this.participantManager.setOnParticipantJoinCallback(callback);
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 Initializing WebRTC as host for session: ${sessionId} (Mobile: ${this.isMobile})`);
    this.roomId = sessionId;
    this.isHost = true;

    try {
      await signalingService.connect();
      
      this.callbacksManager.setupHostCallbacks(
        (data) => {
          console.log('👤 HOST: New participant connected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.addParticipant(participantId, data);
          
          this.callbacksManager.triggerParticipantJoinCallback(participantId);
          this.connectionHandler.startHeartbeat(participantId);
        },
        (data) => {
          console.log('👤 HOST: Participant disconnected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.participantManager.removeParticipant(participantId);
          this.removeParticipantConnection(participantId);
        },
        (participants) => {
          console.log('👥 HOST: Participants list updated:', participants);
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
    console.log(`👤 MOBILE: Initializing WebRTC as participant: ${participantId} for session: ${sessionId}`);
    this.roomId = sessionId;
    this.isHost = false;

    try {
      if (stream) {
        this.localStream = stream;
        console.log('📹 MOBILE: Using provided stream:', stream.getTracks().length, 'tracks');
      } else {
        // Mobile-optimized media constraints
        const mobileConstraints = this.isMobile ? {
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        } : MEDIA_CONSTRAINTS;

        const mediaStream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
        this.localStream = mediaStream;
        console.log('📹 MOBILE: Local stream obtained:', mediaStream.getTracks().length, 'tracks');
      }

      await signalingService.connect();

      this.callbacksManager.setupParticipantCallbacks(
        participantId,
        (data) => {
          console.log('🏠 MOBILE: Host or participant connected:', data);
          const hostId = data.userId || data.id || data.socketId;
          if (hostId !== participantId) {
            console.log('📞 MOBILE: Initiating call to host:', hostId);
            this.connectionHandler.initiateCallWithRetry(hostId);
          }
        },
        (participants) => {
          console.log('👥 MOBILE: Participants updated:', participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== participantId && !this.peerConnections.has(pId)) {
              console.log('📞 MOBILE: Connecting to existing participant:', pId);
              this.connectionHandler.initiateCallWithRetry(pId);
            }
          });
        },
        this.signalingHandler.handleOffer.bind(this.signalingHandler),
        this.signalingHandler.handleAnswer.bind(this.signalingHandler),
        this.signalingHandler.handleIceCandidate.bind(this.signalingHandler)
      );

      await signalingService.joinRoom(sessionId, participantId);
      console.log('✅ MOBILE: Participant connected to signaling server');
      
      // Enhanced stream notification for mobile
      if (this.localStream) {
        const streamInfo = {
          streamId: this.localStream.id,
          trackCount: this.localStream.getTracks().length,
          hasVideo: this.localStream.getVideoTracks().length > 0,
          hasAudio: this.localStream.getAudioTracks().length > 0,
          isMobile: this.isMobile,
          fallbackMode: signalingService.isFallbackMode(),
          fallbackStreaming: signalingService.isFallbackStreamingEnabled()
        };
        
        signalingService.notifyStreamStarted(participantId, streamInfo);
        
        // If in fallback mode, trigger stream callback directly
        if (signalingService.isFallbackStreamingEnabled()) {
          console.log('🚀 MOBILE: Triggering direct stream callback in fallback mode');
          setTimeout(() => {
            this.callbacksManager.triggerStreamCallback(participantId, this.localStream!);
          }, 2000);
        }
      }
      
    } catch (error) {
      console.error('❌ MOBILE: Failed to initialize participant WebRTC:', error);
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
