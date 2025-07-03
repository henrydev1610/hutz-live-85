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

  constructor() {
    console.log('🔧 WebRTC Manager initialized');
  }

  async initializeAsHost(sessionId: string): Promise<void> {
    console.log(`🏠 Initializing WebRTC as host for session: ${sessionId}`);
    this.roomId = sessionId;
    this.isHost = true;

    try {
      // Set up signaling callbacks with participant tracking
      signalingService.setCallbacks({
        onUserConnected: (data) => {
          console.log('👤 New participant connected:', data.userId);
          this.addParticipant(data.userId, data);
          toast.success(`Participante ${data.userId} conectado`);
        },
        onUserDisconnected: (data) => {
          console.log('👤 Participant disconnected:', data.userId);
          this.removeParticipant(data.userId);
          toast.info(`Participante ${data.userId} desconectado`);
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
          // Don't show error toast for fallback mode
          if (!signalingService.isFallbackMode()) {
            toast.error(`Erro de sinalização: ${error.message}`);
          }
        }
      });

      // Connect to signaling server
      await signalingService.joinRoom(sessionId, `host-${Date.now()}`);
      
      console.log('✅ Host connected to signaling server');
      
      // If we're in fallback mode, simulate some demo participants
      if (signalingService.isFallbackMode()) {
        console.log('🔧 Fallback mode: creating demo participants');
        this.createDemoParticipants();
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize host WebRTC:', error);
      // Still allow operation in fallback mode
      if (signalingService.isFallbackMode()) {
        console.log('⚠️ Operating in fallback mode');
        this.createDemoParticipants();
      } else {
        throw error;
      }
    }
  }

  private updateParticipantsList(participants: any[]) {
    console.log('🔄 Updating participants list with:', participants);
    
    // Clear existing participants
    this.participants.clear();
    
    // Add all participants from the list
    participants.forEach(participant => {
      const participantData = {
        id: participant.userId || participant.id || participant.peer_id,
        name: participant.userName || participant.name || participant.user_name || `Participante ${participant.userId?.substring(0, 4) || 'Unknown'}`,
        joinedAt: participant.joinedAt || participant.joined_at || Date.now(),
        lastActive: participant.lastActive || participant.last_active || Date.now(),
        active: participant.active !== false && participant.is_connected !== false,
        hasVideo: participant.hasVideo || participant.has_video || false,
        selected: false,
        browserType: participant.browserType || participant.browser_type || 'unknown'
      };
      
      this.participants.set(participantData.id, participantData);
      console.log(`📝 Added/updated participant: ${participantData.id} (${participantData.name})`);
    });
    
    // Trigger UI update
    this.notifyParticipantsChanged();
  }

  private createDemoParticipants() {
    console.log('🎭 Creating demo participants for fallback mode');
    
    // Clear existing participants first
    this.participants.clear();
    
    // Create a few demo participants
    const demoParticipants = [
      {
        id: 'demo-participant-1',
        name: 'Participante Demo 1',
        joinedAt: Date.now() - 30000,
        lastActive: Date.now() - 1000,
        active: true,
        hasVideo: true,
        selected: false,
        browserType: 'chrome'
      },
      {
        id: 'demo-participant-2', 
        name: 'Participante Demo 2',
        joinedAt: Date.now() - 45000,
        lastActive: Date.now() - 5000,
        active: true,
        hasVideo: false,
        selected: false,
        browserType: 'firefox'
      }
    ];
    
    demoParticipants.forEach(participant => {
      this.participants.set(participant.id, participant);
      console.log(`🎭 Created demo participant: ${participant.id}`);
    });
    
    // Notify about the demo participants
    setTimeout(() => {
      this.notifyParticipantsChanged();
      toast.info('Modo demonstração: participantes simulados criados');
    }, 1000);
  }

  private addParticipant(userId: string, data: any) {
    const participant = {
      id: userId,
      name: data.userName || `Participante ${userId.substring(0, 4)}`,
      joinedAt: data.timestamp || Date.now(),
      lastActive: Date.now(),
      active: true,
      hasVideo: false,
      selected: false,
      browserType: data.browserType || 'unknown'
    };
    
    this.participants.set(userId, participant);
    this.notifyParticipantsChanged();
  }

  private removeParticipant(userId: string) {
    if (this.participants.has(userId)) {
      this.participants.delete(userId);
      this.notifyParticipantsChanged();
    }
    
    // Also cleanup peer connection
    if (this.peerConnections.has(userId)) {
      this.peerConnections.get(userId)?.close();
      this.peerConnections.delete(userId);
    }
  }

  private notifyParticipantsChanged() {
    const participantsList = Array.from(this.participants.values());
    console.log('📢 Notifying participants change:', participantsList);
    
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('participants-updated', {
      detail: { participants: participantsList }
    }));
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  selectParticipant(participantId: string) {
    console.log(`👁️ Selecting participant: ${participantId}`);
    
    // Unselect all participants first
    this.participants.forEach(participant => {
      participant.selected = false;
    });
    
    // Select the target participant
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.selected = true;
      console.log(`✅ Participant ${participantId} selected`);
    }
    
    this.notifyParticipantsChanged();
  }

  private async handleOffer(data: any) {
    console.log('📤 Handling offer from:', data.fromUserId);
    // WebRTC offer handling logic would go here
  }

  private async handleAnswer(data: any) {
    console.log('📥 Handling answer from:', data.fromUserId);
    // WebRTC answer handling logic would go here
  }

  private async handleIceCandidate(data: any) {
    console.log('🧊 Handling ICE candidate from:', data.fromUserId);
    // ICE candidate handling logic would go here
  }

  cleanup() {
    console.log('🧹 Cleaning up WebRTC manager');
    
    // Close all peer connections
    this.peerConnections.forEach((pc, userId) => {
      console.log(`Closing peer connection for ${userId}`);
      pc.close();
    });
    this.peerConnections.clear();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }
    
    // Clear participants
    this.participants.clear();
    
    // Disconnect from signaling
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
    // Still return a manager in fallback mode
    if (webrtcManager && signalingService.isFallbackMode()) {
      console.log('⚠️ Returning WebRTC manager in fallback mode');
      return { webrtc: webrtcManager };
    }
    throw error;
  }
};

export const initParticipantWebRTC = async (sessionId: string) => {
  try {
    console.log('🚀 Initializing participant WebRTC for session:', sessionId);
    
    if (webrtcManager) {
      webrtcManager.cleanup();
    }
    
    webrtcManager = new WebRTCManager();
    
    // For participants, we mainly need signaling
    signalingService.setCallbacks({
      onError: (error) => {
        console.error('❌ Participant signaling error:', error);
      }
    });
    
    await signalingService.joinRoom(sessionId, `participant-${Date.now()}`);
    
    return { webrtc: webrtcManager };
    
  } catch (error) {
    console.error('Failed to initialize participant WebRTC:', error);
    throw error;
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
