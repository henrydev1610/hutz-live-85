import { useState, useEffect, useRef } from 'react';
import { twilioVideoService, TwilioRoom, TwilioParticipant } from '@/services/TwilioVideoService';
import { LocalVideoTrack, RemoteVideoTrack } from 'twilio-video';

interface UseTwilioRoomProps {
  roomId: string;
  participantId: string;
  isHost?: boolean;
}

export function useTwilioRoom({ roomId, participantId, isHost = false }: UseTwilioRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<TwilioParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<TwilioRoom | null>(null);

  const joinRoom = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Criar track de vídeo local se for participante
      let videoTrack: LocalVideoTrack | undefined;
      if (!isHost) {
        videoTrack = await twilioVideoService.createLocalVideoTrack();
        setLocalVideoTrack(videoTrack);
      }

      // Conectar à sala
      const room = await twilioVideoService.joinRoom(roomId, participantId, videoTrack);
      roomRef.current = room;

      // Configurar callbacks
      twilioVideoService.setOnParticipantConnected((participant) => {
        console.log('Participant joined:', participant.identity);
        setParticipants(prev => {
          const existing = prev.find(p => p.sid === participant.sid);
          if (existing) return prev;
          return [...prev, participant];
        });
      });

      twilioVideoService.setOnParticipantDisconnected((participant) => {
        console.log('Participant left:', participant.identity);
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
      });

      twilioVideoService.setOnTrackSubscribed((track, participant) => {
        console.log('Track subscribed:', track.sid, participant.identity);
        // Atualizar participantes com track
        setParticipants(prev => prev.map(p => 
          p.sid === participant.sid 
            ? { ...p, videoTracks: new Map(p.videoTracks.set(track.sid, track)) }
            : p
        ));
      });

      // Obter participantes existentes
      const existingParticipants = twilioVideoService.getParticipants();
      setParticipants(existingParticipants);

      setIsConnected(true);
      console.log('Successfully joined Twilio room:', roomId);

    } catch (err) {
      console.error('Failed to join Twilio room:', err);
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveRoom = async () => {
    try {
      await twilioVideoService.leaveRoom();
      roomRef.current = null;
      setIsConnected(false);
      setParticipants([]);
      setLocalVideoTrack(null);
      setError(null);
    } catch (err) {
      console.error('Failed to leave room:', err);
    }
  };

  const attachVideoToElement = (track: LocalVideoTrack | RemoteVideoTrack, element: HTMLElement) => {
    twilioVideoService.attachVideoTrack(track, element);
  };

  const detachVideoFromElement = (track: LocalVideoTrack | RemoteVideoTrack) => {
    twilioVideoService.detachVideoTrack(track);
  };

  const getParticipantVideoTrack = (participantSid: string): RemoteVideoTrack | null => {
    const participant = participants.find(p => p.sid === participantSid);
    if (!participant || participant.videoTracks.size === 0) return null;
    
    return Array.from(participant.videoTracks.values())[0];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        leaveRoom();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    participants,
    localVideoTrack,
    error,
    joinRoom,
    leaveRoom,
    attachVideoToElement,
    detachVideoFromElement,
    getParticipantVideoTrack,
    currentRoom: twilioVideoService.getCurrentRoom()
  };
}