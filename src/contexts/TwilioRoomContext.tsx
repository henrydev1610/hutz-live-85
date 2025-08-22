import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { connect, Room, LocalVideoTrack, RemoteParticipant, LocalParticipant } from 'twilio-video';
import { toast } from 'sonner';

// Context interfaces
interface TwilioRoomState {
  room: Room | null;
  localParticipant: LocalParticipant | null;
  remoteParticipants: Map<string, RemoteParticipant>;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  localVideoTrack: LocalVideoTrack | null;
}

interface TwilioRoomActions {
  connectToRoom: (identity: string, roomName: string) => Promise<boolean>;
  disconnect: () => void;
  getLocalVideoTrack: () => Promise<LocalVideoTrack | null>;
  attachParticipantVideo: (participantSid: string, videoElement: HTMLVideoElement) => boolean;
}

interface TwilioRoomContextValue extends TwilioRoomState, TwilioRoomActions {}

// Context creation
const TwilioRoomContext = createContext<TwilioRoomContextValue | null>(null);

// Hook to use the context
export const useTwilioRoom = () => {
  const context = useContext(TwilioRoomContext);
  if (!context) {
    throw new Error('useTwilioRoom must be used within a TwilioRoomProvider');
  }
  return context;
};

// Provider component
interface TwilioRoomProviderProps {
  children: React.ReactNode;
}

export const TwilioRoomProvider: React.FC<TwilioRoomProviderProps> = ({ children }) => {
  const [state, setState] = useState<TwilioRoomState>({
    room: null,
    localParticipant: null,
    remoteParticipants: new Map(),
    isConnected: false,
    isConnecting: false,
    error: null,
    localVideoTrack: null
  });

  // Get Twilio token from backend
  const getToken = async (identity: string, roomName: string): Promise<string> => {
    console.log('🎫 TWILIO: Getting token for', { identity, roomName });
    
    const response = await fetch('/api/twilio/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identity, roomName }),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error('Invalid token response');
    }

    console.log('✅ TWILIO: Token received successfully');
    return data.token;
  };

  // Connect to Twilio Video Room
  const connectToRoom = useCallback(async (identity: string, roomName: string): Promise<boolean> => {
    if (state.isConnecting || state.isConnected) {
      console.log('⚠️ TWILIO: Already connecting or connected');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      console.log('🎥 TWILIO: Connecting to room...', { identity, roomName });

      // Get token
      const token = await getToken(identity, roomName);

      // Connect to room with optimized settings
      const room = await connect(token, {
        name: roomName,
        audio: true,
        video: { width: 1280, height: 720, frameRate: 30 },
        dominantSpeaker: true,
        networkQuality: { local: 1, remote: 1 },
        bandwidthProfile: {
          video: {
            mode: 'collaboration',
            maxTracks: 10,
            dominantSpeakerPriority: 'high'
          }
        },
        preferredVideoCodecs: ['VP8', 'H264'],
        logLevel: 'warn'
      });

      console.log('✅ TWILIO: Connected to room successfully');

      // Setup room event handlers
      setupRoomEventHandlers(room);

      // Update state
      setState(prev => ({
        ...prev,
        room,
        localParticipant: room.localParticipant,
        isConnected: true,
        isConnecting: false,
        error: null
      }));

      // Handle existing participants
      room.participants.forEach(participant => {
        console.log('👤 TWILIO: Existing participant:', participant.identity);
        setState(prev => ({
          ...prev,
          remoteParticipants: new Map(prev.remoteParticipants.set(participant.sid, participant))
        }));
        setupParticipantEventHandlers(participant);
      });

      toast.success(`📹 Conectado à sala: ${roomName}`);
      return true;

    } catch (error) {
      console.error('❌ TWILIO: Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isConnecting: false
      }));

      toast.error(`❌ Falha na conexão: ${errorMessage}`);
      return false;
    }
  }, [state.isConnecting, state.isConnected]);

  // Setup room event handlers
  const setupRoomEventHandlers = (room: Room) => {
    // Participant connected
    room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log('👤 TWILIO: Participant connected:', participant.identity);
      
      setState(prev => ({
        ...prev,
        remoteParticipants: new Map(prev.remoteParticipants.set(participant.sid, participant))
      }));

      setupParticipantEventHandlers(participant);
      toast.info(`👤 ${participant.identity} entrou na sala`);
    });

    // Participant disconnected
    room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log('👤 TWILIO: Participant disconnected:', participant.identity);
      
      setState(prev => {
        const newParticipants = new Map(prev.remoteParticipants);
        newParticipants.delete(participant.sid);
        return {
          ...prev,
          remoteParticipants: newParticipants
        };
      });

      toast.info(`👤 ${participant.identity} saiu da sala`);
    });

    // Room disconnected
    room.on('disconnected', (room, error) => {
      console.log('🔌 TWILIO: Disconnected from room', error);
      cleanup();
      
      if (error) {
        toast.error(`❌ Desconectado: ${error.message}`);
      } else {
        toast.info('🔌 Desconectado da sala');
      }
    });

    // Reconnecting
    room.on('reconnecting', (error) => {
      console.log('🔄 TWILIO: Reconnecting...', error);
      toast.warning('🔄 Reconectando...');
    });

    // Reconnected
    room.on('reconnected', () => {
      console.log('✅ TWILIO: Reconnected successfully');
      toast.success('✅ Reconectado com sucesso');
    });
  };

  // Setup participant event handlers
  const setupParticipantEventHandlers = (participant: RemoteParticipant) => {
    // Track subscribed
    participant.on('trackSubscribed', (track, publication) => {
      console.log('📺 TWILIO: Track subscribed:', track.kind, participant.identity);
      
      if (track.kind === 'video') {
        // Auto-attach to containers
        const containers = document.querySelectorAll(`[data-participant-id="${participant.sid}"]`);
        containers.forEach(container => {
          const videoElement = container.querySelector('video') || document.createElement('video');
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = true;
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          
            if ('attach' in track) {
              (track as any).attach(videoElement);
            }
          
          if (!container.contains(videoElement)) {
            container.appendChild(videoElement);
          }
        });

        // Dispatch custom event for integration
        window.dispatchEvent(new CustomEvent('twilio-video-ready', {
          detail: { participantSid: participant.sid, participant, track }
        }));
      }
    });

    // Track unsubscribed
    participant.on('trackUnsubscribed', (track) => {
      console.log('📺 TWILIO: Track unsubscribed:', track.kind, participant.identity);
      
      if (track.kind === 'video') {
        // Clean up video elements
        const containers = document.querySelectorAll(`[data-participant-id="${participant.sid}"]`);
        containers.forEach(container => {
          const videos = container.querySelectorAll('video');
          videos.forEach(video => video.remove());
        });
      }
    });

    // Handle existing tracks
    participant.tracks.forEach(publication => {
      if (publication.isSubscribed && publication.track) {
        if (publication.track.kind === 'video') {
          // Auto-attach existing tracks
          const containers = document.querySelectorAll(`[data-participant-id="${participant.sid}"]`);
          containers.forEach(container => {
            const videoElement = container.querySelector('video') || document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            
            const track = publication.track!;
            if ('attach' in track) {
              (track as any).attach(videoElement);
            }
            
            if (!container.contains(videoElement)) {
              container.appendChild(videoElement);
            }
          });
        }
      }
    });
  };

  // Get local video track
  const getLocalVideoTrack = useCallback(async (): Promise<LocalVideoTrack | null> => {
    if (state.localVideoTrack) {
      return state.localVideoTrack;
    }

    try {
      const { createLocalVideoTrack } = await import('twilio-video');
      const localVideoTrack = await createLocalVideoTrack({
        width: 1280,
        height: 720,
        frameRate: 30
      });

      setState(prev => ({ ...prev, localVideoTrack }));
      return localVideoTrack;
    } catch (error) {
      console.error('❌ TWILIO: Failed to create local video track:', error);
      return null;
    }
  }, [state.localVideoTrack]);

  // Attach participant video to specific element
  const attachParticipantVideo = useCallback((participantSid: string, videoElement: HTMLVideoElement): boolean => {
    const participant = state.remoteParticipants.get(participantSid);
    if (!participant) return false;

    const videoPublication = Array.from(participant.videoTracks.values())
      .find(pub => pub.isSubscribed && pub.track);

    if (videoPublication && videoPublication.track) {
      videoPublication.track.attach(videoElement);
      console.log('✅ TWILIO: Manual video attachment successful');
      return true;
    }

    return false;
  }, [state.remoteParticipants]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    console.log('🔌 TWILIO: Disconnecting from room...');
    
    if (state.room) {
      state.room.disconnect();
    }
    
    cleanup();
  }, [state.room]);

  // Cleanup function
  const cleanup = () => {
    if (state.localVideoTrack) {
      state.localVideoTrack.stop();
    }

    setState({
      room: null,
      localParticipant: null,
      remoteParticipants: new Map(),
      isConnected: false,
      isConnecting: false,
      error: null,
      localVideoTrack: null
    });
  };

  // Context value
  const contextValue: TwilioRoomContextValue = {
    ...state,
    connectToRoom,
    disconnect,
    getLocalVideoTrack,
    attachParticipantVideo
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.room) {
        state.room.disconnect();
      }
      cleanup();
    };
  }, []);

  return (
    <TwilioRoomContext.Provider value={contextValue}>
      {children}
    </TwilioRoomContext.Provider>
  );
};