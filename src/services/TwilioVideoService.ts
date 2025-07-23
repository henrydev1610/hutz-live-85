import { connect, ConnectOptions, LocalVideoTrack, Room, RemoteParticipant } from 'twilio-video';

export interface TwilioRoomConfig {
  accessToken: string;
  roomName: string;
  localTracks?: (LocalVideoTrack | MediaStreamTrack)[];
  options?: ConnectOptions;
}

export interface TwilioParticipant {
  sid: string;
  identity: string;
  videoTracks: Map<string, any>;
  audioTracks: Map<string, any>;
}

class TwilioVideoService {
  private room: Room | null = null;
  private participants: Map<string, TwilioParticipant> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  async connectToRoom(config: TwilioRoomConfig): Promise<Room> {
    try {
      console.log('🌟 TWILIO: Connecting to room:', config.roomName);
      
      const room = await connect(config.accessToken, {
        name: config.roomName,
        tracks: config.localTracks || [],
        dominantSpeaker: true,
        maxAudioBitrate: 16000,
        maxVideoBitrate: 2500000,
        preferredVideoCodecs: ['VP8', 'H264'],
        networkQuality: { local: 1, remote: 1 },
        ...config.options
      });

      this.room = room;
      this.setupRoomEventListeners(room);
      
      console.log('✅ TWILIO: Connected to room:', room.name);
      this.emit('room-connected', room);
      
      return room;
    } catch (error) {
      console.error('❌ TWILIO: Failed to connect to room:', error);
      this.emit('connection-error', error);
      throw error;
    }
  }

  private setupRoomEventListeners(room: Room) {
    // Handle existing participants
    room.participants.forEach(participant => {
      this.handleParticipantConnected(participant);
    });

    // Room events
    room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log('👤 TWILIO: Participant connected:', participant.identity);
      this.handleParticipantConnected(participant);
      this.emit('participant-connected', participant);
    });

    room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log('👋 TWILIO: Participant disconnected:', participant.identity);
      this.participants.delete(participant.sid);
      this.emit('participant-disconnected', participant);
    });

    room.on('disconnected', (room: Room, error?: any) => {
      console.log('🔌 TWILIO: Disconnected from room');
      if (error) {
        console.error('❌ TWILIO: Disconnection error:', error);
      }
      this.cleanup();
      this.emit('room-disconnected', { room, error });
    });

    room.on('reconnecting', (error: any) => {
      console.log('🔄 TWILIO: Reconnecting...', error);
      this.emit('reconnecting', error);
    });

    room.on('reconnected', () => {
      console.log('✅ TWILIO: Reconnected to room');
      this.emit('reconnected');
    });
  }

  private handleParticipantConnected(participant: RemoteParticipant) {
    const twilioParticipant: TwilioParticipant = {
      sid: participant.sid,
      identity: participant.identity,
      videoTracks: new Map(),
      audioTracks: new Map()
    };

    this.participants.set(participant.sid, twilioParticipant);

    // Handle existing tracks
    participant.tracks.forEach(publication => {
      if (publication.isSubscribed && publication.track) {
        this.handleTrackSubscribed(publication.track, participant);
      }
    });

    // Handle track events
    participant.on('trackSubscribed', (track) => {
      this.handleTrackSubscribed(track, participant);
    });

    participant.on('trackUnsubscribed', (track) => {
      this.handleTrackUnsubscribed(track, participant);
    });
  }

  private handleTrackSubscribed(track: any, participant: RemoteParticipant) {
    console.log(`📺 TWILIO: Track subscribed:`, track.kind, participant.identity);
    
    const twilioParticipant = this.participants.get(participant.sid);
    if (!twilioParticipant) return;

    if (track.kind === 'video') {
      twilioParticipant.videoTracks.set(track.sid, track);
      this.emit('video-track-subscribed', { track, participant });
    } else if (track.kind === 'audio') {
      twilioParticipant.audioTracks.set(track.sid, track);
      this.emit('audio-track-subscribed', { track, participant });
    }
  }

  private handleTrackUnsubscribed(track: any, participant: RemoteParticipant) {
    console.log(`📺 TWILIO: Track unsubscribed:`, track.kind, participant.identity);
    
    const twilioParticipant = this.participants.get(participant.sid);
    if (!twilioParticipant) return;

    if (track.kind === 'video') {
      twilioParticipant.videoTracks.delete(track.sid);
      this.emit('video-track-unsubscribed', { track, participant });
    } else if (track.kind === 'audio') {
      twilioParticipant.audioTracks.delete(track.sid);
      this.emit('audio-track-unsubscribed', { track, participant });
    }
  }

  disconnectFromRoom() {
    if (this.room) {
      console.log('🔌 TWILIO: Disconnecting from room');
      this.room.disconnect();
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  getParticipants(): TwilioParticipant[] {
    return Array.from(this.participants.values());
  }

  getParticipant(sid: string): TwilioParticipant | undefined {
    return this.participants.get(sid);
  }

  // Event system
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  private cleanup() {
    this.room = null;
    this.participants.clear();
    this.eventListeners.clear();
  }
}

export const twilioVideoService = new TwilioVideoService();