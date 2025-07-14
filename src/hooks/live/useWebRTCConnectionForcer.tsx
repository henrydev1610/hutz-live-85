import { useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { UnifiedWebRTCManager } from '@/utils/webrtc/UnifiedWebRTCManager';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface UseWebRTCConnectionForcerProps {
  sessionId: string | null;
  participantList: any[];
  setParticipantList: React.Dispatch<React.SetStateAction<any[]>>;
  participantStreams: { [id: string]: MediaStream };
  setParticipantStreams: React.Dispatch<React.SetStateAction<{ [id: string]: MediaStream }>>;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useWebRTCConnectionForcer = ({
  sessionId,
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseWebRTCConnectionForcerProps) => {
  const { toast } = useToast();
  const webrtcManagerRef = useRef<UnifiedWebRTCManager | null>(null);
  const isInitializing = useRef(false);

  // FORCE WebRTC connection initialization
  useEffect(() => {
    if (!sessionId || isInitializing.current) return;

    const forceInitializeWebRTC = async () => {
      isInitializing.current = true;
      console.log('🚀 FORCE WebRTC: Initializing connection for session:', sessionId);

      try {
        // Clean up existing manager
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.cleanup();
          webrtcManagerRef.current = null;
        }

        // Create new manager
        webrtcManagerRef.current = new UnifiedWebRTCManager();

        // Set up CRITICAL stream callback FIRST
        webrtcManagerRef.current.setOnStreamCallback((participantId: string, stream: MediaStream) => {
          console.log('🎥 FORCE WebRTC: STREAM RECEIVED from:', participantId, {
            streamId: stream?.id,
            tracks: stream?.getTracks()?.length || 0,
            videoTracks: stream?.getVideoTracks()?.length || 0,
            active: stream?.active
          });

          // IMMEDIATE stream processing
          if (participantId && stream) {
            setParticipantStreams(prev => {
              const updated = { ...prev, [participantId]: stream };
              console.log('✅ FORCE WebRTC: Stream added to state for:', participantId);
              return updated;
            });

            // IMMEDIATE participant update
            setParticipantList(prev => {
              const updated = prev.map(p => 
                p.id === participantId 
                  ? { ...p, hasVideo: true, selected: true, active: true }
                  : p
              );
              console.log('✅ FORCE WebRTC: Participant updated with video flag:', participantId);
              return updated;
            });

            // IMMEDIATE transmission update
            setTimeout(() => {
              console.log('🔄 FORCE WebRTC: Forcing transmission update');
              updateTransmissionParticipants();
            }, 100);

            toast({
              title: "Stream Conectado",
              description: `Vídeo recebido de ${participantId}`,
            });
          }
        });

        // Set up participant join callback
        webrtcManagerRef.current.setOnParticipantJoinCallback((participantId: string) => {
          console.log('👤 FORCE WebRTC: PARTICIPANT JOINED:', participantId);

          if (participantId) {
            setParticipantList(prev => {
              const existing = prev.find(p => p.id === participantId);
              if (existing) {
                console.log('🔄 FORCE WebRTC: Updating existing participant:', participantId);
                return prev.map(p => 
                  p.id === participantId 
                    ? { ...p, active: true, lastActive: Date.now() }
                    : p
                );
              } else {
                console.log('➕ FORCE WebRTC: Adding new participant:', participantId);
                const newParticipant = {
                  id: participantId,
                  name: `Participante ${participantId.substring(0, 4)}`,
                  joinedAt: Date.now(),
                  lastActive: Date.now(),
                  active: true,
                  selected: false,
                  hasVideo: false,
                  isMobile: false
                };
                return [...prev, newParticipant];
              }
            });

            toast({
              title: "Participante Conectado",
              description: `${participantId} entrou na sala`,
            });
          }
        });

        // Initialize as host with FORCE connection
        await webrtcManagerRef.current.initializeAsHost(sessionId);
        console.log('✅ FORCE WebRTC: Host initialization completed');

        toast({
          title: "WebRTC Conectado",
          description: "Pronto para receber participantes",
        });

      } catch (error) {
        console.error('❌ FORCE WebRTC: Initialization failed:', error);
        toast({
          title: "Erro WebRTC",
          description: `Falha na conexão: ${error?.message || 'Erro desconhecido'}`,
          variant: "destructive"
        });

        // Retry after 3 seconds
        setTimeout(() => {
          isInitializing.current = false;
          forceInitializeWebRTC();
        }, 3000);
      } finally {
        isInitializing.current = false;
      }
    };

    forceInitializeWebRTC();

    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.cleanup();
        webrtcManagerRef.current = null;
      }
    };
  }, [sessionId]);

  // Force connection health monitoring
  useEffect(() => {
    if (!sessionId || !webrtcManagerRef.current) return;

    const healthCheckInterval = setInterval(() => {
      const connectionState = webrtcManagerRef.current?.getConnectionState();
      const isConnected = unifiedWebSocketService.isConnected();

      console.log('🏥 FORCE WebRTC: Health check:', {
        webrtc: connectionState,
        websocket: isConnected,
        participants: participantList.length,
        streams: Object.keys(participantStreams).length
      });

      // Force reconnection if needed
      if (!isConnected && !isInitializing.current) {
        console.log('🔄 FORCE WebRTC: Forcing reconnection due to health check failure');
        unifiedWebSocketService.forceReconnect().catch(err => {
          console.error('❌ FORCE WebRTC: Reconnection failed:', err);
        });
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(healthCheckInterval);
  }, [sessionId, participantList.length, Object.keys(participantStreams).length]);

  // Debug stream states
  useEffect(() => {
    console.log('📊 FORCE WebRTC: Stream state changed:', {
      participantCount: participantList.length,
      streamCount: Object.keys(participantStreams).length,
      activeParticipants: participantList.filter(p => p.active).length,
      selectedParticipants: participantList.filter(p => p.selected).length,
      participants: participantList.map(p => ({
        id: p.id,
        hasVideo: p.hasVideo,
        active: p.active,
        selected: p.selected
      }))
    });
  }, [participantList, participantStreams]);

  const forceRefreshConnections = () => {
    console.log('🔄 FORCE WebRTC: Manual connection refresh triggered');
    
    if (webrtcManagerRef.current) {
      const participants = webrtcManagerRef.current.getParticipants();
      console.log('👥 FORCE WebRTC: Current participants:', participants);
      
      // Force update participant list
      setParticipantList(participants.map(p => ({
        ...p,
        active: true,
        lastActive: Date.now()
      })));
    }
  };

  return {
    forceRefreshConnections,
    webrtcManager: webrtcManagerRef.current
  };
};