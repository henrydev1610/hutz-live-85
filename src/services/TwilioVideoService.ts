import Video, { LocalVideoTrack, RemoteVideoTrack, Room, Participant, LocalParticipant, RemoteParticipant } from 'twilio-video';

export interface TwilioRoom {
  room: Room;
  localVideoTrack?: LocalVideoTrack;
}

export interface TwilioParticipant {
  sid: string;
  identity: string;
  isLocal: boolean;
  videoTracks: Map<string, RemoteVideoTrack>;
  audioTracks: Map<string, any>;
}

export class TwilioVideoService {
  private room: Room | null = null;
  private localVideoTrack: LocalVideoTrack | null = null;
  private onParticipantConnected?: (participant: TwilioParticipant) => void;
  private onParticipantDisconnected?: (participant: TwilioParticipant) => void;
  private onTrackSubscribed?: (track: RemoteVideoTrack, participant: TwilioParticipant) => void;

  async getAccessToken(roomId: string, participantId: string): Promise<string> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/twilio/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomId,
          identity: participantId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get Twilio access token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting Twilio token:', error);
      throw error;
    }
  }

  async createLocalVideoTrack(): Promise<LocalVideoTrack> {
    try {
      this.localVideoTrack = await Video.createLocalVideoTrack({
        width: 640,
        height: 480,
        frameRate: 24,
        facingMode: 'user'
      });
      return this.localVideoTrack;
    } catch (error) {
      console.error('Error creating local video track:', error);
      throw error;
    }
  }

  async joinRoom(roomId: string, participantId: string, videoTrack?: LocalVideoTrack): Promise<TwilioRoom> {
    try {
      const token = await this.getAccessToken(roomId, participantId);
      
      const connectOptions: any = {
        name: roomId,
        audio: true,
        video: videoTrack || false,
        dominantSpeaker: true,
        networkQuality: {
          local: 1,
          remote: 1
        },
        preferredVideoCodecs: ['VP8'],
        maxAudioBitrate: 16000,
        maxVideoBitrate: 2400000
      };

      this.room = await Video.connect(token, connectOptions);
      
      this.setupRoomEventListeners();
      
      return {
        room: this.room,
        localVideoTrack: videoTrack || undefined
      };
    } catch (error) {
      console.error('Error joining Twilio room:', error);
      throw error;
    }
  }

  private setupRoomEventListeners() {
    if (!this.room) return;

    this.room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log('Participant connected:', participant.identity);
      
      const twilioParticipant: TwilioParticipant = {
        sid: participant.sid,
        identity: participant.identity,
        isLocal: false,
        videoTracks: new Map(),
        audioTracks: new Map()
      };

      // Handle existing tracks
      participant.tracks.forEach(publication => {
        if (publication.isSubscribed && publication.track) {
          this.handleTrackSubscribed(publication.track, participant);
        }
      });

      // Handle new tracks
      participant.on('trackSubscribed', track => {
        this.handleTrackSubscribed(track, participant);
      });

      participant.on('trackUnsubscribed', track => {
        this.handleTrackUnsubscribed(track, participant);
      });

      this.onParticipantConnected?.(twilioParticipant);
    });

    this.room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log('Participant disconnected:', participant.identity);
      
      const twilioParticipant: TwilioParticipant = {
        sid: participant.sid,
        identity: participant.identity,
        isLocal: false,
        videoTracks: new Map(),
        audioTracks: new Map()
      };

      this.onParticipantDisconnected?.(twilioParticipant);
    });

    this.room.on('disconnected', (room, error) => {
      console.log('Disconnected from room:', room.name, error);
      this.cleanup();
    });
  }

  private handleTrackSubscribed(track: any, participant: RemoteParticipant) {
    if (track.kind === 'video') {
      const twilioParticipant: TwilioParticipant = {
        sid: participant.sid,
        identity: participant.identity,
        isLocal: false,
        videoTracks: new Map([[track.sid, track]]),
        audioTracks: new Map()
      };

      this.onTrackSubscribed?.(track, twilioParticipant);
    }
  }

  private handleTrackUnsubscribed(track: any, participant: RemoteParticipant) {
    if (track.kind === 'video') {
      track.detach().forEach((element: HTMLElement) => {
        element.remove();
      });
    }
  }

  attachVideoTrack(track: LocalVideoTrack | RemoteVideoTrack, container: HTMLElement) {
    const videoElement = track.attach();
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    container.innerHTML = '';
    container.appendChild(videoElement);
  }

  detachVideoTrack(track: LocalVideoTrack | RemoteVideoTrack) {
    track.detach().forEach((element: HTMLElement) => {
      element.remove();
    });
  }

  getParticipants(): TwilioParticipant[] {
    if (!this.room) return [];

    const participants: TwilioParticipant[] = [];

    // Add local participant
    const localParticipant = this.room.localParticipant;
    participants.push({
      sid: localParticipant.sid,
      identity: localParticipant.identity,
      isLocal: true,
      videoTracks: new Map(),
      audioTracks: new Map()
    });

    // Add remote participants
    this.room.participants.forEach(participant => {
      const videoTracks = new Map();
      participant.videoTracks.forEach((publication, sid) => {
        if (publication.track) {
          videoTracks.set(sid, publication.track);
        }
      });

      participants.push({
        sid: participant.sid,
        identity: participant.identity,
        isLocal: false,
        videoTracks,
        audioTracks: new Map()
      });
    });

    return participants;
  }

  setOnParticipantConnected(callback: (participant: TwilioParticipant) => void) {
    this.onParticipantConnected = callback;
  }

  setOnParticipantDisconnected(callback: (participant: TwilioParticipant) => void) {
    this.onParticipantDisconnected = callback;
  }

  setOnTrackSubscribed(callback: (track: RemoteVideoTrack, participant: TwilioParticipant) => void) {
    this.onTrackSubscribed = callback;
  }

  async leaveRoom() {
    if (this.room) {
      this.room.disconnect();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.localVideoTrack) {
      this.localVideoTrack.stop();
      this.localVideoTrack = null;
    }
    this.room = null;
  }

  getCurrentRoom(): Room | null {
    return this.room;
  }

  getLocalVideoTrack(): LocalVideoTrack | null {
    return this.localVideoTrack;
  }
}

export const twilioVideoService = new TwilioVideoService();