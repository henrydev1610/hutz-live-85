import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, LocalVideoTrack, LocalAudioTrack, createLocalVideoTrack, createLocalAudioTrack } from 'twilio-video';
import { twilioVideoService, TwilioParticipant } from '@/services/TwilioVideoService';
import { toast } from 'sonner';

export interface UseTwilioRoomProps {
  roomName: string;
  participantName: string;
}

export const useTwilioRoom = ({ roomName, participantName }: UseTwilioRoomProps) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<TwilioParticipant[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const getAccessToken = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('https://fuhvpzprzqdfcojueswo.supabase.co/functions/v1/twilio-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aHZwenByenFkZmNvanVlc3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NzYyMTcsImV4cCI6MjA2ODM1MjIxN30.EOxuKRd31gvZtp-WXNtR5luwiVyNMbn1X-bGIz9TVgk'}`
        },
        body: JSON.stringify({ identity: participantName, roomName })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to get access token: ${response.status}`);
      }
      
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('❌ TWILIO: Failed to get access token:', error);
      throw error;
    }
  }, [participantName, roomName]);

  const createLocalTracks = useCallback(async () => {
    try {
      console.log('🎥 TWILIO: Creating local tracks...');
      
      const [videoTrack, audioTrack] = await Promise.all([
        createLocalVideoTrack({
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          frameRate: { ideal: 24, max: 30 }
        }),
        createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        })
      ]);

      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // Attach local video to preview
      if (localVideoRef.current && videoTrack) {
        videoTrack.attach(localVideoRef.current);
      }

      console.log('✅ TWILIO: Local tracks created');
      return [videoTrack, audioTrack];
    } catch (error) {
      console.error('❌ TWILIO: Failed to create local tracks:', error);
      toast.error('Failed to access camera/microphone');
      throw error;
    }
  }, []);

  const connectToRoom = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('🌟 TWILIO: Starting connection process...');
      
      const [accessToken, localTracks] = await Promise.all([
        getAccessToken(),
        createLocalTracks()
      ]);

      const connectedRoom = await twilioVideoService.connectToRoom({
        accessToken,
        roomName,
        localTracks: localTracks as any
      });

      setRoom(connectedRoom);
      setIsConnected(true);
      
      toast.success(`Connected to room: ${roomName}`);
      
    } catch (error) {
      console.error('❌ TWILIO: Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      toast.error(`Failed to connect: ${errorMessage}`);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, getAccessToken, createLocalTracks, roomName]);

  const disconnectFromRoom = useCallback(() => {
    console.log('🔌 TWILIO: Disconnecting...');
    
    // Stop local tracks
    if (localVideoTrack) {
      localVideoTrack.stop();
      setLocalVideoTrack(null);
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      setLocalAudioTrack(null);
    }

    // Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    twilioVideoService.disconnectFromRoom();
    setRoom(null);
    setIsConnected(false);
    setParticipants([]);
    
    toast.info('Disconnected from room');
  }, [localVideoTrack, localAudioTrack]);

  const toggleVideo = useCallback(async () => {
    if (!localVideoTrack) return;
    
    if (localVideoTrack.isEnabled) {
      localVideoTrack.disable();
      toast.info('Video disabled');
    } else {
      localVideoTrack.enable();
      toast.info('Video enabled');
    }
  }, [localVideoTrack]);

  const toggleAudio = useCallback(async () => {
    if (!localAudioTrack) return;
    
    if (localAudioTrack.isEnabled) {
      localAudioTrack.disable();
      toast.info('Audio muted');
    } else {
      localAudioTrack.enable();
      toast.info('Audio unmuted');
    }
  }, [localAudioTrack]);

  // Setup event listeners
  useEffect(() => {
    const handleParticipantConnected = (participant: any) => {
      setParticipants(prev => [...prev, participant]);
    };

    const handleParticipantDisconnected = (participant: any) => {
      setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
    };

    const handleRoomDisconnected = () => {
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
    };

    twilioVideoService.on('participant-connected', handleParticipantConnected);
    twilioVideoService.on('participant-disconnected', handleParticipantDisconnected);
    twilioVideoService.on('room-disconnected', handleRoomDisconnected);

    return () => {
      twilioVideoService.off('participant-connected', handleParticipantConnected);
      twilioVideoService.off('participant-disconnected', handleParticipantDisconnected);
      twilioVideoService.off('room-disconnected', handleRoomDisconnected);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectFromRoom();
      }
    };
  }, [isConnected, disconnectFromRoom]);

  return {
    room,
    participants,
    isConnecting,
    isConnected,
    connectionError,
    localVideoRef,
    localVideoTrack,
    localAudioTrack,
    connectToRoom,
    disconnectFromRoom,
    toggleVideo,
    toggleAudio
  };
};