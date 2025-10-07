import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, Track } from 'livekit-client';
import { joinLiveRoom, disconnectFromRoom } from '@/utils/livekit/LiveKitConnection';
import { toast } from 'sonner';

interface UseLiveKitRoomProps {
  roomName: string;
  userName: string;
  autoConnect?: boolean;
}

export const useLiveKitRoom = ({ 
  roomName, 
  userName,
  autoConnect = true 
}: UseLiveKitRoomProps) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate connections
  const connectionAttemptRef = useRef(false);
  const roomRef = useRef<Room | null>(null);

  // Connect to LiveKit room
  const connect = async () => {
    if (connectionAttemptRef.current || roomRef.current) {
      console.log('⚠️ LiveKit: Conexão já em andamento ou existente');
      return;
    }

    try {
      connectionAttemptRef.current = true;
      setIsConnecting(true);
      setError(null);

      console.log('🔌 LiveKit: Iniciando conexão...', { roomName, userName });
      console.log('📱 User Agent:', navigator.userAgent);
      console.log('🌐 API URL:', import.meta.env.VITE_API_URL);
      console.log('🔗 LiveKit URL:', import.meta.env.VITE_LIVEKIT_URL);

      const connectedRoom = await joinLiveRoom(roomName, userName);
      
      console.log('✅ LiveKit: Room conectada');
      console.log('👥 Participantes na sala:', connectedRoom.remoteParticipants.size);
      console.log('🎥 Câmera local:', connectedRoom.localParticipant.isCameraEnabled);
      console.log('🎤 Microfone local:', connectedRoom.localParticipant.isMicrophoneEnabled);
      
      roomRef.current = connectedRoom;
      setRoom(connectedRoom);
      setIsConnected(true);
      setParticipants(Array.from(connectedRoom.remoteParticipants.values()));

      // Setup event listeners
      connectedRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Novo participante recebido:', participant.identity);
        setParticipants(prev => [...prev, participant]);
      });

      connectedRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('👋 Participante desconectado:', participant.identity);
        setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
      });

      connectedRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`📹 Track subscribed de ${participant.identity}:`, track.kind);
        
        // Force re-render to show new track
        setParticipants(prev => [...prev]);
      });

      connectedRoom.on(RoomEvent.Disconnected, () => {
        console.log('🔌 Desconectado do LiveKit');
        setIsConnected(false);
        setRoom(null);
        roomRef.current = null;
      });

      toast.success(`✅ Conectado à sala ${roomName}`);

    } catch (err: any) {
      console.error('❌ Erro ao conectar ao LiveKit:', err);
      setError(err.message || 'Erro ao conectar');
      toast.error('Erro ao conectar ao LiveKit');
    } finally {
      setIsConnecting(false);
      connectionAttemptRef.current = false;
    }
  };

  // Disconnect from room
  const disconnect = async () => {
    if (roomRef.current) {
      await disconnectFromRoom(roomRef.current);
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      roomRef.current = null;
      connectionAttemptRef.current = false;
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (!roomRef.current) return;
    
    const enabled = roomRef.current.localParticipant.isCameraEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(!enabled);
    console.log(`📹 Vídeo ${enabled ? 'desativado' : 'ativado'}`);
  };

  // Toggle audio
  const toggleAudio = async () => {
    if (!roomRef.current) return;
    
    const enabled = roomRef.current.localParticipant.isMicrophoneEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!enabled);
    console.log(`🎤 Áudio ${enabled ? 'desativado' : 'ativado'}`);
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && roomName && userName && !connectionAttemptRef.current) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (roomRef.current) {
        console.log('🧹 LiveKit: Limpando conexão no unmount');
        disconnectFromRoom(roomRef.current);
        roomRef.current = null;
        connectionAttemptRef.current = false;
      }
    };
  }, [roomName, userName]);

  return {
    room,
    participants,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio,
    localParticipant: room?.localParticipant || null,
  };
};
