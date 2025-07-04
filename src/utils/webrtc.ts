import signalingService from '@/services/WebSocketSignalingService';
import { toast } from 'sonner';

// Global WebRTC state
let webrtcManager: WebRTCManager | null = null;

class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private isHost: boolean = false;
  private participants: Map<string, any> = new Map();
  private onStreamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;

  constructor() {
    console.log('🔧 WebRTC Manager initialized');
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
      // Set up signaling callbacks
      signalingService.setCallbacks({
        onUserConnected: (data) => {
          console.log('👤 New participant connected:', data);
          const participantId = data.userId || data.id || data.socketId;
          this.addParticipant(participantId, data);
          
          // Immediately notify the UI about the new participant
          if (this.onParticipantJoinCallback) {
            this.onParticipantJoinCallback(participantId);
          }
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
        onOffer: this.handleOffer.bind(this),
        onAnswer: this.handleAnswer.bind(this),
        onIceCandidate: this.handleIceCandidate.bind(this),
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
            setTimeout(() => this.initiateCall(hostId), 500);
          }
        },
        onParticipantsUpdate: (participants) => {
          console.log('👥 Participants updated:', participants);
          participants.forEach(participant => {
            const pId = participant.userId || participant.id || participant.socketId;
            if (pId !== participantId && !this.peerConnections.has(pId)) {
              console.log('📞 Connecting to existing participant:', pId);
              setTimeout(() => this.initiateCall(pId), 500);
            }
          });
        },
        onOffer: this.handleOffer.bind(this),
        onAnswer: this.handleAnswer.bind(this),
        onIceCandidate: this.handleIceCandidate.bind(this),
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

  private async initiateCall(participantId: string) {
    console.log(`📞 Initiating call to: ${participantId}`);
    
    try {
      const peerConnection = this.createPeerConnection(participantId);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      signalingService.sendOffer(participantId, offer);
      console.log('📤 Offer sent to:', participantId);
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
    }
  }

  private createPeerConnection(participantId: string): RTCPeerConnection {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);
    
    peerConnection.ontrack = (event) => {
      console.log('📺 Received track from:', participantId, event.track.kind);
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('🎥 Processing stream from:', participantId, {
          streamId: stream.id,
          active: stream.active,
          tracks: stream.getTracks().length
        });
        
        // Immediately call the stream callback
        if (this.onStreamCallback) {
          console.log('✅ Calling onStreamCallback immediately for:', participantId);
          this.onStreamCallback(participantId, stream);
        }
        
        // Also trigger participant join if not already done
        if (this.onParticipantJoinCallback) {
          console.log('👤 Triggering participant join for:', participantId);
          this.onParticipantJoinCallback(participantId);
        }
      }
    };
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', participantId);
        signalingService.sendIceCandidate(participantId, event.candidate);
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${participantId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ Peer connection established with ${participantId}`);
        
        // Double-check if we have a stream to display
        const receivers = peerConnection.getReceivers();
        receivers.forEach(receiver => {
          if (receiver.track && receiver.track.readyState === 'live') {
            console.log('🔄 Re-triggering stream callback for connected peer:', participantId);
            const streams = receiver.track.kind === 'video' ? [new MediaStream([receiver.track])] : [];
            if (streams.length > 0 && this.onStreamCallback) {
              this.onStreamCallback(participantId, streams[0]);
            }
          }
        });
      } else if (peerConnection.connectionState === 'failed') {
        console.error(`❌ Peer connection failed with ${participantId}`);
        setTimeout(() => {
          if (peerConnection.connectionState === 'failed') {
            this.retryConnection(participantId);
          }
        }, 2000);
      }
    };
    
    if (this.localStream) {
      console.log(`📹 Adding local stream to peer connection for ${participantId}`);
      this.localStream.getTracks().forEach(track => {
        console.log(`📹 Adding ${track.kind} track:`, track.id);
        peerConnection.addTrack(track, this.localStream!);
      });
    }
    
    return peerConnection;
  }

  private retryConnection(participantId: string) {
    console.log(`🔄 Retrying connection to: ${participantId}`);
    const existingConnection = this.peerConnections.get(participantId);
    if (existingConnection) {
      existingConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    setTimeout(() => {
      this.initiateCall(participantId);
    }, 1000);
  }

  private async handleOffer(data: any) {
    console.log('📤 Handling offer from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.createPeerConnection(participantId);
    
    try {
      await peerConnection.setRemoteDescription(data.offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      signalingService.sendAnswer(participantId, answer);
      console.log('📥 Answer sent to:', participantId);
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
    }
  }

  private async handleAnswer(data: any) {
    console.log('📥 Handling answer from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(data.answer);
        console.log('✅ Answer processed for:', participantId);
      } catch (error) {
        console.error('❌ Failed to handle answer:', error);
      }
    }
  }

  private async handleIceCandidate(data: any) {
    console.log('🧊 Handling ICE candidate from:', data.fromUserId || data.fromSocketId);
    
    const participantId = data.fromUserId || data.fromSocketId;
    const peerConnection = this.peerConnections.get(participantId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
        console.log('✅ ICE candidate added for:', participantId);
      } catch (error) {
        console.error('❌ Failed to add ICE candidate:', error);
      }
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
      
      // Trigger participant join callback for each participant
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

export const initHostWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing host WebRTC for session:', sessionId);
    
    if (webrtcManager) {
      console.log('🧹 Cleaning up existing WebRTC manager');
      webrtcManager.cleanup();
    }
    
    webrtcManager = new WebRTCManager();
    await webrtcManager.initializeAsHost(sessionId);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize host WebRTC:', error);
    return { webrtc: webrtcManager };
  }
};

export const initParticipantWebRTC = async (sessionId: string, participantId?: string, stream?: MediaStream) => {
  try {
    console.log('🚀 Initializing participant WebRTC for session:', sessionId);
    
    if (webrtcManager) {
      webrtcManager.cleanup();
    }
    
    webrtcManager = new WebRTCManager();
    await webrtcManager.initializeAsParticipant(sessionId, participantId || `participant-${Date.now()}`, stream);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    throw error;
  }
};

export const setStreamCallback = (callback: (participantId: string, stream: MediaStream) => void) => {
  if (webrtcManager) {
    webrtcManager.setOnStreamCallback(callback);
  }
};

export const setParticipantJoinCallback = (callback: (participantId: string) => void) => {
  if (webrtcManager) {
    webrtcManager.setOnParticipantJoinCallback(callback);
  }
};

export const getWebRTCManager = () => {
  return webrtcManager;
};

export const cleanupWebRTC = () => {
  if (webrtcManager) {
    webrtcManager.cleanup();
    webrtcManager = null;
  }
};
