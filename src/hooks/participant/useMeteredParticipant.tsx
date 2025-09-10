import { useState, useEffect, useCallback } from 'react';
import { loadMeteredSDK } from '../live/useMeteredIntegration';

interface MeteredParticipantState {
  isConnected: boolean;
  isPublishing: boolean;
  error: string | null;
  localStream: MediaStream | null;
}

interface UseMeteredParticipantProps {
  roomName: string;
  accountDomain: string;
  onConnectionChange: (connected: boolean) => void;
}

export const useMeteredParticipant = ({
  roomName,
  accountDomain,
  onConnectionChange
}: UseMeteredParticipantProps) => {
  const [state, setState] = useState<MeteredParticipantState>({
    isConnected: false,
    isPublishing: false,
    error: null,
    localStream: null
  });
  const [meteredRoom, setMeteredRoom] = useState<any>(null);

  const requestParticipantToken = async (roomName: string): Promise<string> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/room-token?roomName=${roomName}&role=participant`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get participant token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error requesting participant token:', error);
      throw error;
    }
  };

  const getVideoStream = async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false // Áudio desativado conforme requisito
      });
      
      console.log('Video stream acquired for Metered');
      return stream;
    } catch (error) {
      console.error('Error getting video stream:', error);
      throw error;
    }
  };

  const connectAndPublish = useCallback(async () => {
    try {
      console.log('Participant connecting to Metered room:', roomName);
      
      const Metered = await loadMeteredSDK();
      const token = await requestParticipantToken(roomName);
      const videoStream = await getVideoStream();

      const room = new Metered.Meeting();
      
      // Inicializar o room
      await room.join({
        roomURL: `https://${accountDomain}/${roomName}`,
        token: token
      });

      // Event listeners
      room.on('joinedRoom', () => {
        console.log('Participant joined Metered room successfully');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        onConnectionChange(true);
      });

      room.on('leftRoom', () => {
        console.log('Participant left Metered room');
        setState(prev => ({ ...prev, isConnected: false, isPublishing: false }));
        onConnectionChange(false);
      });

      room.on('localTrackUpdated', (track: any) => {
        console.log('Local track updated:', track.kind);
        if (track.kind === 'video') {
          setState(prev => ({ ...prev, isPublishing: true }));
        }
      });

      // Room join já foi feito na inicialização
      
      // Publicar vídeo
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        await room.startVideo();
        console.log('Video published to Metered room');
        setState(prev => ({ 
          ...prev, 
          isPublishing: true, 
          localStream: videoStream 
        }));
      }

      setMeteredRoom(room);

    } catch (error) {
      console.error('Participant connection error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
        isPublishing: false 
      }));
      onConnectionChange(false);
    }
  }, [roomName, accountDomain, onConnectionChange]);

  const disconnect = useCallback(async () => {
    if (meteredRoom) {
      try {
        await meteredRoom.leaveRoom();
        console.log('Participant disconnected from Metered room');
      } catch (error) {
        console.error('Error disconnecting from room:', error);
      }
      setMeteredRoom(null);
    }
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    setState({
      isConnected: false,
      isPublishing: false,
      error: null,
      localStream: null
    });
    onConnectionChange(false);
  }, [meteredRoom, state.localStream, onConnectionChange]);

  const republish = useCallback(async () => {
    if (meteredRoom && state.isConnected) {
      try {
        console.log('Republishing video stream...');
        const videoStream = await getVideoStream();
        await meteredRoom.startVideo();
        setState(prev => ({ 
          ...prev, 
          localStream: videoStream,
          isPublishing: true,
          error: null 
        }));
        console.log('Video stream republished successfully');
      } catch (error) {
        console.error('Error republishing stream:', error);
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Republish failed' 
        }));
      }
    }
  }, [meteredRoom, state.isConnected]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connectAndPublish,
    disconnect,
    republish
  };
};