
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC } from '@/utils/webrtc';
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
      
      // CRÍTICO: Inicializar objetos globais para transmissão
      if (!window.sharedParticipantStreams) {
        window.sharedParticipantStreams = {};
        console.log('🌐 GLOBAL: sharedParticipantStreams initialized');
      }
      if (!window.streamBackup) {
        window.streamBackup = {};
        console.log('🌐 GLOBAL: streamBackup initialized');
      }
      
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

      // Initialize WebRTC with CRITICAL static host ID - UNIFIED SYSTEM
      initHostWebRTC(sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ HOST: UNIFIED WebRTC initialized with STATIC HOST ID');
          
          // CRITICAL: Set up callbacks for stream and participant management
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 HOST: UNIFIED STREAM RECEIVED from:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              active: stream.active,
              timestamp: Date.now()
            });
            
            // IMEDIATO: Armazenar no window global para transmissão
            if (!window.sharedParticipantStreams) {
              window.sharedParticipantStreams = {};
            }
            if (!window.streamBackup) {
              window.streamBackup = {};
            }
            
            window.sharedParticipantStreams[participantId] = stream;
            window.streamBackup[participantId] = stream;
            
            console.log('📡 GLOBAL: Stream stored in window objects for transmission access', {
              participantId,
              streamId: stream.id,
              globalKeys: Object.keys(window.sharedParticipantStreams),
              backupKeys: Object.keys(window.streamBackup)
            });
            
          // FASE 3: PROPAGAÇÃO ATIVA IMEDIATA para janela /live
          if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
            console.log(`📡 FASE 3: Enviando stream ${participantId} para janela /live via postMessage`);
            try {
              transmissionWindowRef.current.postMessage({
                type: 'immediate-stream-available',
                participantId: participantId,
                streamId: stream.id,
                timestamp: Date.now(),
                action: 'force-display'
              }, '*');
            } catch (error) {
              console.error(`❌ FASE 3: Erro ao enviar postMessage:`, error);
            }
          }

          // CRITICAL: Direct stream processing for immediate visibility
          handleParticipantStream(participantId, stream);
          
          // Force immediate update to transmission participants
          setTimeout(() => {
            console.log('🔄 HOST: UNIFIED Updating transmission after stream received');
            updateTransmissionParticipants();
            // CRITICAL: Also force stream sync
            forceSyncNow();
            
            // FASE 4: SISTEMA DE VERIFICAÇÃO - verificar se a janela /live exibiu o stream
            setTimeout(() => {
              if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
                transmissionWindowRef.current.postMessage({
                  type: 'verify-stream-display',
                  participantId: participantId,
                  verificationId: `verify-${Date.now()}`
                }, '*');
              }
            }, 2000);
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
      }, 300);
    }
  }, [participantStreams, participantList, transmissionOpen, updateTransmissionParticipants, forceSyncNow]);

  return {
    forceSyncNow
  };
};
