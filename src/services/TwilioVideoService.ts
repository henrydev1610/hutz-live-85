import { connect, Room, LocalVideoTrack, RemoteVideoTrack, RemoteParticipant, LocalParticipant } from 'twilio-video';
import { twilioWebRTCService } from './TwilioWebRTCService';

interface TwilioVideoState {
  room: Room | null;
  localVideoTrack: LocalVideoTrack | null;
  isConnected: boolean;
  participants: Map<string, RemoteParticipant>;
}

export class TwilioVideoService {
  private state: TwilioVideoState = {
    room: null,
    localVideoTrack: null,
    isConnected: false,
    participants: new Map()
  };

  private videoEventHandlers: Map<string, (videoElement: HTMLVideoElement) => void> = new Map();

  // Connect to Twilio Video Room
  async connectToRoom(identity: string, roomName: string): Promise<Room | null> {
    try {
      console.log('🎥 TWILIO VIDEO: Connecting to room...', { identity, roomName });

      // Get Twilio token
      const tokenResponse = await twilioWebRTCService.generateToken(identity, roomName);
      if (!tokenResponse || !tokenResponse.success) {
        throw new Error('Failed to get Twilio token');
      }

      // Connect to room
      const room = await connect(tokenResponse.token, {
        name: roomName,
        video: true,
        audio: true,
        dominantSpeaker: true,
        networkQuality: true
      });

      this.state.room = room;
      this.state.isConnected = true;

      // Setup event handlers
      this.setupRoomEventHandlers(room);

      console.log('✅ TWILIO VIDEO: Connected to room successfully', room);
      return room;

    } catch (error) {
      console.error('❌ TWILIO VIDEO: Failed to connect to room:', error);
      return null;
    }
  }

  // Setup room event handlers
  private setupRoomEventHandlers(room: Room) {
    // Participant connected
    room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log('👤 TWILIO VIDEO: Participant connected:', participant.identity);
      this.state.participants.set(participant.sid, participant);
      this.setupParticipantEventHandlers(participant);
    });

    // Participant disconnected
    room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log('👤 TWILIO VIDEO: Participant disconnected:', participant.identity);
      this.state.participants.delete(participant.sid);
      this.cleanupParticipant(participant.sid);
    });

    // Handle existing participants
    room.participants.forEach((participant: RemoteParticipant) => {
      console.log('👤 TWILIO VIDEO: Existing participant:', participant.identity);
      this.state.participants.set(participant.sid, participant);
      this.setupParticipantEventHandlers(participant);
    });

    // Room disconnected
    room.on('disconnected', (room: Room, error?: Error) => {
      console.log('🔌 TWILIO VIDEO: Disconnected from room', error);
      this.cleanup();
    });
  }

  // Setup participant event handlers
  private setupParticipantEventHandlers(participant: RemoteParticipant) {
    // Track subscribed
    participant.on('trackSubscribed', (track) => {
      console.log('📺 TWILIO VIDEO: Track subscribed:', track.kind, participant.identity);
      
      if (track.kind === 'video') {
        this.handleVideoTrack(track as RemoteVideoTrack, participant.sid);
      }
    });

    // Track unsubscribed
    participant.on('trackUnsubscribed', (track) => {
      console.log('📺 TWILIO VIDEO: Track unsubscribed:', track.kind, participant.identity);
      
      if (track.kind === 'video') {
        this.cleanupParticipantVideo(participant.sid);
      }
    });

    // Handle existing tracks
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed && publication.track) {
        if (publication.track.kind === 'video') {
          this.handleVideoTrack(publication.track as RemoteVideoTrack, participant.sid);
        }
      }
    });
  }

  // Handle video track
  private handleVideoTrack(track: RemoteVideoTrack, participantId: string) {
    console.log('🎬 TWILIO VIDEO: Handling video track for participant:', participantId);

    // Find video containers for this participant
    const containers = document.querySelectorAll(`[data-participant-id="${participantId}"]`);
    
    containers.forEach((container) => {
      const videoElement = container.querySelector('video') || document.createElement('video');
      
      // Configure video element
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      
      // Attach track to video element
      track.attach(videoElement);
      
      // Add to container if not already there
      if (!container.contains(videoElement)) {
        container.appendChild(videoElement);
      }

      console.log('✅ TWILIO VIDEO: Video track attached to container');
      
      // Dispatch event for integration
      window.dispatchEvent(new CustomEvent('twilio-video-ready', {
        detail: { participantId, videoElement, track }
      }));
    });

    // Store handler for cleanup
    this.videoEventHandlers.set(participantId, (videoElement: HTMLVideoElement) => {
      track.attach(videoElement);
    });
  }

  // Attach video to specific element
  attachVideoToElement(participantId: string, videoElement: HTMLVideoElement): boolean {
    const participant = this.state.participants.get(participantId);
    if (!participant) return false;

    const videoPublication = Array.from(participant.videoTracks.values())
      .find(pub => pub.isSubscribed && pub.track);

    if (videoPublication && videoPublication.track) {
      const track = videoPublication.track as RemoteVideoTrack;
      track.attach(videoElement);
      console.log('✅ TWILIO VIDEO: Manual video attachment successful');
      return true;
    }

    return false;
  }

  // Get local video track
  async getLocalVideoTrack(): Promise<LocalVideoTrack | null> {
    if (this.state.localVideoTrack) {
      return this.state.localVideoTrack;
    }

    try {
      const { createLocalVideoTrack } = await import('twilio-video');
      const localVideoTrack = await createLocalVideoTrack({
        width: 1280,
        height: 720,
        frameRate: 30
      });

      this.state.localVideoTrack = localVideoTrack;
      return localVideoTrack;
    } catch (error) {
      console.error('❌ TWILIO VIDEO: Failed to create local video track:', error);
      return null;
    }
  }

  // Cleanup participant video
  private cleanupParticipantVideo(participantId: string) {
    const containers = document.querySelectorAll(`[data-participant-id="${participantId}"]`);
    containers.forEach(container => {
      const videos = container.querySelectorAll('video');
      videos.forEach(video => video.remove());
    });
    
    this.videoEventHandlers.delete(participantId);
  }

  // Cleanup participant
  private cleanupParticipant(participantId: string) {
    this.cleanupParticipantVideo(participantId);
    this.state.participants.delete(participantId);
  }

  // Disconnect from room
  disconnect() {
    if (this.state.room) {
      this.state.room.disconnect();
      this.cleanup();
    }
  }

  // Full cleanup
  private cleanup() {
    this.state.isConnected = false;
    this.state.room = null;
    this.state.participants.clear();
    this.videoEventHandlers.clear();
    
    if (this.state.localVideoTrack) {
      this.state.localVideoTrack.stop();
      this.state.localVideoTrack = null;
    }
  }

  // Get service state
  getState() {
    return {
      ...this.state,
      participantCount: this.state.participants.size
    };
  }

  // Get all participants
  getParticipants(): RemoteParticipant[] {
    return Array.from(this.state.participants.values());
  }

  // Check if connected
  isConnected(): boolean {
    return this.state.isConnected && !!this.state.room;
  }

  // Get room
  getRoom(): Room | null {
    return this.state.room;
  }
}

// Singleton instance
export const twilioVideoService = new TwilioVideoService();

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).__twilioVideoService = twilioVideoService;
}