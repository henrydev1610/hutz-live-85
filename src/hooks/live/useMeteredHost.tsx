import { useState, useEffect, useCallback } from 'react';
import { loadMeteredSDK } from './useMeteredIntegration';

interface MeteredHostState {
  isConnected: boolean;
  participants: Map<string, any>;
  error: string | null;
}

interface UseMeteredHostProps {
  roomName: string;
  accountDomain: string;
  onParticipantJoin: (participantId: string, stream: MediaStream) => void;
  onParticipantLeave: (participantId: string) => void;
}

export const useMeteredHost = ({
  roomName,
  accountDomain,
  onParticipantJoin,
  onParticipantLeave
}: UseMeteredHostProps) => {
  const [state, setState] = useState<MeteredHostState>({
    isConnected: false,
    participants: new Map(),
    error: null
  });
  const [meteredRoom, setMeteredRoom] = useState<any>(null);

  const requestHostToken = async (roomName: string): Promise<string> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/room-token?roomName=${roomName}&role=host`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get host token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error requesting host token:', error);
      throw error;
    }
  };

  const connectToRoom = useCallback(async () => {
    try {
      console.log('Host connecting to Metered room:', roomName);
      
      const Metered = await loadMeteredSDK();
      const token = await requestHostToken(roomName);

      const room = new Metered.Meeting();
      
      // Inicializar o room
      await room.join({
        roomURL: `https://${accountDomain}/${roomName}`,
        token: token
      });

      // Event listeners
      room.on('participantJoined', (participant: any) => {
        console.log('Participant joined:', participant.id);
        setState(prev => ({
          ...prev,
          participants: new Map(prev.participants.set(participant.id, participant))
        }));
      });

      room.on('participantLeft', (participant: any) => {
        console.log('Participant left:', participant.id);
        setState(prev => {
          const newParticipants = new Map(prev.participants);
          newParticipants.delete(participant.id);
          return {
            ...prev,
            participants: newParticipants
          };
        });
        onParticipantLeave(participant.id);
      });

      room.on('remoteTrackReceived', (track: any, participant: any) => {
        console.log('Remote track received from participant:', participant.id);
        if (track.kind === 'video') {
          const stream = new MediaStream([track]);
          onParticipantJoin(participant.id, stream);
        }
      });

      room.on('remoteTrackStopped', (track: any, participant: any) => {
        console.log('Remote track stopped from participant:', participant.id);
        onParticipantLeave(participant.id);
      });

      // Room join já foi feito na inicialização
      
      setMeteredRoom(room);
      setState(prev => ({ ...prev, isConnected: true, error: null }));
      console.log('Host successfully connected to Metered room');

    } catch (error) {
      console.error('Host connection error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false 
      }));
    }
  }, [roomName, accountDomain, onParticipantJoin, onParticipantLeave]);

  const disconnect = useCallback(async () => {
    if (meteredRoom) {
      try {
        await meteredRoom.leaveRoom();
        console.log('Host disconnected from Metered room');
      } catch (error) {
        console.error('Error disconnecting from room:', error);
      }
      setMeteredRoom(null);
    }
    setState({
      isConnected: false,
      participants: new Map(),
      error: null
    });
  }, [meteredRoom]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connectToRoom,
    disconnect
  };
};