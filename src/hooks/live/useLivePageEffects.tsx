
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC, getWebRTCManager } from '@/utils/webrtc';

interface UseLivePageEffectsProps {
  sessionId: string | null;
  localStream: MediaStream | null;
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
  localStream,
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, localStream]);

  // Enhanced session initialization effect
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

      // FASE 1: Initialize WebRTC with enhanced debug logging
      console.log('🚀 FASE 1: HOST EFFECTS: Starting WebRTC initialization...');
      initHostWebRTC(sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ FASE 1: HOST EFFECTS: WebRTC initialized successfully');
          
          // FASE 1: Verificar se o manager está disponível via getWebRTCManager
          const verifyManager = () => {
            const manager = getWebRTCManager();
            console.log('🔍 FASE 1: HOST EFFECTS: Manager verification:', !!manager);
            return manager;
          };
          
          const manager = verifyManager();
          if (!manager) {
            console.error('❌ FASE 1: HOST EFFECTS: Manager verification failed!');
            throw new Error('WebRTC manager not accessible after initialization');
          }
          
          // CORREÇÃO CRÍTICA: Registrar callbacks ANTES de qualquer inicialização
          console.log(`🎯 HOST-CRITICAL-SEQUENCE: Registrando callbacks ANTES da inicialização WebRTC`);
          
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 HOST-CRÍTICO: STREAM callback executado para:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              active: stream.active,
              timestamp: Date.now()
            });
            
            // VISUAL LOG: Toast para stream recebido no host
            toast({
              title: "🎥 Host Stream Callback",
              description: `${participantId.substring(0, 8)} - ${stream.getTracks().length} tracks`,
            });
            
            // VISUAL LOG: Evento customizado para debug
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('host-stream-received', {
                detail: { 
                  participantId, 
                  streamId: stream.id,
                  trackCount: stream.getTracks().length,
                  timestamp: Date.now()
                }
              }));
            }
            
            handleParticipantStream(participantId, stream);
            
            // Atualizar transmissão imediatamente
            setTimeout(() => {
              console.log('🔄 HOST-CRÍTICO: Atualizando transmissão após receber stream');
              updateTransmissionParticipants();
              
              // VISUAL LOG: Toast para atualização de transmissão
              toast({
                title: "📡 Transmissão Atualizada",
                description: `Participante ${participantId.substring(0, 8)} adicionado à transmissão`,
              });
            }, 200);
          });
          
          result.webrtc.setOnParticipantJoinCallback((participantId) => {
            console.log('👤 FASE 3: HOST EFFECTS: PARTICIPANT JOIN via WebRTC:', participantId);
            handleParticipantJoin(participantId);
          });
          
          console.log('✅ FASE 1: HOST EFFECTS: All callbacks set successfully');
        } else {
          console.error('❌ FASE 1: HOST EFFECTS: Failed to initialize WebRTC');
          
          toast({
            title: "Erro de inicialização",
            description: "Falha ao inicializar WebRTC. Verifique a conexão.",
            variant: "destructive"
          });
        }
      }).catch(error => {
        console.error('❌ FASE 1: HOST EFFECTS: WebRTC initialization error:', error);
        
        toast({
          title: "Erro WebRTC",
          description: "Problema na inicialização do WebRTC",
          variant: "destructive"
        });
      });

      return () => {
        console.log('🧹 HOST: Cleaning up session');
        cleanup();
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
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
      }, 300);
    }
  }, [participantStreams, participantList, transmissionOpen]);
};
