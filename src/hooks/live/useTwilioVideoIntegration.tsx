import { useEffect, useRef, useState, useCallback } from 'react';
import { twilioVideoService } from '@/services/TwilioVideoService';
import { Room, RemoteParticipant } from 'twilio-video';

interface UseTwilioVideoIntegrationProps {
  sessionId: string;
  identity: string;
  isHost?: boolean;
}

interface TwilioVideoState {
  room: Room | null;
  isConnected: boolean;
  participants: RemoteParticipant[];
  error: string | null;
  isConnecting: boolean;
}

export const useTwilioVideoIntegration = ({ 
  sessionId, 
  identity, 
  isHost = false 
}: UseTwilioVideoIntegrationProps) => {
  const [state, setState] = useState<TwilioVideoState>({
    room: null,
    isConnected: false,
    participants: [],
    error: null,
    isConnecting: false
  });

  const initializationRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  // Connect to Twilio Video room
  const connectToRoom = useCallback(async () => {
    if (state.isConnecting || state.isConnected) return;
    
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      console.log('🎥 HOOK: Connecting to Twilio Video room...', { sessionId, identity });
      
      const room = await twilioVideoService.connectToRoom(identity, sessionId);
      
      if (room) {
        setState(prev => ({
          ...prev,
          room,
          isConnected: true,
          isConnecting: false,
          participants: twilioVideoService.getParticipants()
        }));
        
        console.log('✅ HOOK: Successfully connected to Twilio Video');
        
        // Setup periodic participant updates
        const updateInterval = setInterval(() => {
          setState(prev => ({
            ...prev,
            participants: twilioVideoService.getParticipants()
          }));
        }, 1000);
        
        return () => clearInterval(updateInterval);
      } else {
        throw new Error('Failed to connect to Twilio Video room');
      }
    } catch (error) {
      console.error('❌ HOOK: Twilio Video connection failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnecting: false
      }));
    }
  }, [sessionId, identity, state.isConnecting, state.isConnected]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    console.log('🔌 HOOK: Disconnecting from Twilio Video...');
    twilioVideoService.disconnect();
    setState({
      room: null,
      isConnected: false,
      participants: [],
      error: null,
      isConnecting: false
    });
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
  }, []);

  // Attach video to specific element
  const attachVideoToElement = useCallback((participantId: string, videoElement: HTMLVideoElement) => {
    return twilioVideoService.attachVideoToElement(participantId, videoElement);
  }, []);

  // Auto-connect effect
  useEffect(() => {
    if (!initializationRef.current && sessionId && identity) {
      initializationRef.current = true;
      
      // Delay connection to ensure DOM is ready
      connectionTimeoutRef.current = setTimeout(() => {
        connectToRoom();
      }, 2000);
    }

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [sessionId, identity, connectToRoom]);

  // Listen for Twilio video events
  useEffect(() => {
    const handleTwilioVideoReady = (event: CustomEvent) => {
      const { participantId, videoElement } = event.detail;
      console.log('🎬 HOOK: Twilio video ready event:', participantId);
      
      // Update participant state
      setState(prev => ({
        ...prev,
        participants: twilioVideoService.getParticipants()
      }));
    };

    window.addEventListener('twilio-video-ready', handleTwilioVideoReady as EventListener);
    
    return () => {
      window.removeEventListener('twilio-video-ready', handleTwilioVideoReady as EventListener);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    room: state.room,
    isConnected: state.isConnected,
    participants: state.participants,
    error: state.error,
    isConnecting: state.isConnecting,
    
    // Actions
    connectToRoom,
    disconnect,
    attachVideoToElement,
    
    // Utils
    twilioService: twilioVideoService
  };
};