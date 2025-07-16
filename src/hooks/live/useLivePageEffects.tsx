
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { UnifiedWebRTCManager } from '@/utils/webrtc/UnifiedWebRTCManager';
import { useStreamSynchronizer } from './useStreamSyncronizer';

interface UseLivePageEffectsProps {
  sessionId: string | null;
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  transmissionOpen: boolean;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  handleParticipantJoin: (id: string) => void;
  handleParticipantStream: (id: string, stream: MediaStream) => void;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateTransmissionParticipants: () => void;
  generateQRCode: (url: string, setQrCodeSvg: React.Dispatch<React.SetStateAction<string | null>>) => void;
  qrCodeURL: string;
  setQrCodeSvg: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useLivePageEffects = ({
  sessionId,
  participantStreams,
  participantList,
  transmissionOpen,
  transmissionWindowRef,
  handleParticipantJoin,
  handleParticipantStream,
  setParticipantList,
  updateTransmissionParticipants,
  generateQRCode,
  qrCodeURL,
  setQrCodeSvg
}: UseLivePageEffectsProps) => {
  const { toast } = useToast();

  // CRITICAL: Stream Synchronizer for assertive transmission
  const { forceSyncNow } = useStreamSynchronizer({
    participantStreams,
    participantList,
    transmissionWindowRef,
    sessionId
  });

  // QR Code generation effect
  useEffect(() => {
    if (qrCodeURL) {
      generateQRCode(qrCodeURL, setQrCodeSvg);
    }
  }, [qrCodeURL]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.close();
      }
      if (sessionId) {
        cleanupSession(sessionId);
      }
      // HOST: No local stream to cleanup - only manages remote streams
    };
  }, [sessionId]);

  // Enhanced session initialization effect with stream forwarding integration
  useEffect(() => {
    if (sessionId) {
      console.log('🚀 HOST: INITIALIZING SESSION:', sessionId);
      window.sessionStorage.setItem('currentSessionId', sessionId);
      
      const cleanup = initializeHostSession(sessionId, {
        onParticipantJoin: (id) => {
          console.log('📥 HOST: Participant join event:', id);
          handleParticipantJoin(id);
        },
        onParticipantLeave: (id) => {
          console.log(`📤 HOST: Participant leave event: ${id}`);
          setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: false, selected: false } : p)
          );
        },
        onParticipantHeartbeat: (id) => {
          console.log(`💓 HOST: Heartbeat from: ${id}`);
          setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: true, lastActive: Date.now() } : p)
          );
        }
      });

      // CRITICAL: Initialize UNIFIED WebRTC directly - Single System
      const initWebRTC = async () => {
        const webrtcManager = new UnifiedWebRTCManager();
        
        try {
          await webrtcManager.initializeAsHost(sessionId);
        console.log('✅ HOST: UNIFIED WebRTC initialized with static host ID');
        
        // CRITICAL: Set up callbacks for stream and participant management  
        webrtcManager.setOnStreamCallback((participantId, stream) => {
          console.log('🎥 HOST: UNIFIED STREAM RECEIVED from:', participantId, {
            streamId: stream.id,
            trackCount: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active,
            timestamp: Date.now()
          });
          
          // CRITICAL: Direct stream processing for immediate visibility
          handleParticipantStream(participantId, stream);
          
          // Force immediate update to transmission participants
          setTimeout(() => {
            console.log('🔄 HOST: UNIFIED Updating transmission after stream received');
            updateTransmissionParticipants();
            // CRITICAL: Also force stream sync
            forceSyncNow();
          }, 100);
          
          // Success feedback
          toast({
            title: "Câmera Conectada",
            description: `Recebendo vídeo de ${participantId}`,
          });
        });
        
        webrtcManager.setOnParticipantJoinCallback((participantId) => {
          console.log('👤 HOST: UNIFIED Participant join callback from WebRTC:', participantId);
          handleParticipantJoin(participantId);
        });

        console.log('🔗 HOST: UNIFIED WebRTC callbacks configured');
        
        // Success notification
        toast({
          title: "WebRTC Ativo",
          description: "Host pronto para receber participantes",
        });
        
      } catch (error) {
        console.error('❌ HOST: UNIFIED WebRTC initialization error:', error);
        
          toast({
            title: "Erro WebRTC",
            description: "Problema na inicialização do WebRTC",
            variant: "destructive"
          });
        }
      };
      
      initWebRTC();

      return () => {
        console.log('🧹 HOST: Cleaning up session');
        cleanup();
        // HOST: No local stream to cleanup - only manages remote streams
      };
    }
  }, [sessionId]);

  // Monitor participant streams changes
  useEffect(() => {
    const streamCount = Object.keys(participantStreams).length;
    const selectedCount = participantList.filter(p => p.selected).length;
    
    console.log('📊 HOST: Stream monitoring:', {
      activeStreams: streamCount,
      selectedParticipants: selectedCount,
      transmissionOpen: transmissionOpen
    });
    
    // Auto-update transmission when streams change
    if (transmissionOpen && streamCount > 0) {
      console.log('🔄 HOST: Auto-updating transmission due to stream changes');
      setTimeout(() => {
        updateTransmissionParticipants();
        // CRITICAL: Force stream sync to ensure consistency
        forceSyncNow();
      }, 300);
    }
  }, [participantStreams, participantList, transmissionOpen, updateTransmissionParticipants, forceSyncNow]);

  return {
    forceSyncNow
  };
};
