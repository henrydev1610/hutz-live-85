
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC, recoverStreamConnection } from '@/utils/webrtc';
import { useStreamSynchronizer } from './useStreamSyncronizer';
import { useStreamHealthMonitor } from './useStreamHealthMonitor';

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

  // FASE 5: Stream Health Monitor
  const { forceHealthCheck } = useStreamHealthMonitor({
    participantStreams,
    onStreamIssue: (participantId, issue) => {
      console.log(`🏥 STREAM HEALTH ISSUE: ${participantId} - ${issue}`);
      
      // FASE 5: Auto-recovery attempt
      setTimeout(() => {
        console.log(`🔄 STREAM HEALTH: Attempting auto-recovery for ${participantId}`);
        recoverStreamConnection(participantId);
      }, 2000);
    }
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

      // FASE 1: Configure callbacks FIRST before WebRTC initialization
      console.log('🔧 HOST: Pre-configuring stream callbacks before WebRTC init');
      
      // Initialize WebRTC with CRITICAL static host ID - UNIFIED SYSTEM
      initHostWebRTC(sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ HOST: UNIFIED WebRTC initialized with STATIC HOST ID');
          
          // FASE 1: CRITICAL - Set up callbacks IMMEDIATELY when WebRTC is created
          console.log('🔧 HOST: Setting up stream callbacks immediately');
          result.webrtc.setOnStreamCallback((participantId, stream) => {
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
          
          result.webrtc.setOnParticipantJoinCallback((participantId) => {
            console.log('👤 HOST: UNIFIED Participant join callback from WebRTC:', participantId);
            handleParticipantJoin(participantId);
          });

          console.log('🔗 HOST: UNIFIED WebRTC callbacks configured with STATIC HOST ID');
          
          // FASE 2: Process any buffered streams immediately after callback setup
          console.log('🔄 HOST: Processing any buffered streams');
          result.webrtc.processBufferedStreams();
          
          // Success notification
          toast({
            title: "WebRTC Ativo",
            description: "Host pronto para receber participantes (ID: host)",
          });
          
        } else {
          console.error('❌ HOST: Failed to initialize UNIFIED WebRTC');
          
          toast({
            title: "Erro de inicialização",
            description: "Falha ao inicializar WebRTC. Verifique a conexão.",
            variant: "destructive"
          });
        }
      }).catch(error => {
        console.error('❌ HOST: UNIFIED WebRTC initialization error:', error);
        
        toast({
          title: "Erro WebRTC",
          description: "Problema na inicialização do WebRTC",
          variant: "destructive"
        });
      });

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
        // FASE 5: Force health check after stream changes
        forceHealthCheck();
      }, 300);
    }
  }, [participantStreams, participantList, transmissionOpen, updateTransmissionParticipants, forceSyncNow]);

  return {
    forceSyncNow,
    forceHealthCheck
  };
};
