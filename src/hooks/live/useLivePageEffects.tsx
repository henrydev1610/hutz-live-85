
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC } from '@/utils/webrtc';

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

      // Initialize WebRTC with enhanced logging and error handling
      const initializeWebRTC = async () => {
        try {
          const result = await initHostWebRTC(sessionId);
          
          if (result && result.webrtc) {
            console.log('✅ HOST: WebRTC initialized successfully');
            
            result.webrtc.setOnStreamCallback((participantId, stream) => {
              console.log('🎥 HOST: RECEIVED STREAM from:', participantId, {
                streamId: stream?.id,
                trackCount: stream?.getTracks()?.length || 0,
                videoTracks: stream?.getVideoTracks()?.length || 0,
                active: stream?.active
              });
              
              // Verificações de segurança
              if (!participantId || !stream) {
                console.error('❌ HOST: Invalid stream callback parameters');
                return;
              }
              
              handleParticipantStream(participantId, stream);
              
              // Update transmission immediately
              setTimeout(() => {
                console.log('🔄 HOST: Updating transmission after stream received');
                try {
                  updateTransmissionParticipants();
                } catch (error) {
                  console.error('❌ HOST: Error updating transmission:', error);
                }
              }, 200);
            });
            
            result.webrtc.setOnParticipantJoinCallback((participantId) => {
              console.log('👤 HOST: PARTICIPANT JOIN via WebRTC:', participantId);
              
              // Verificação de segurança
              if (!participantId) {
                console.error('❌ HOST: Invalid participant ID in join callback');
                return;
              }
              
              handleParticipantJoin(participantId);
            });
            
            // Success toast
            toast({
              title: "Sessão Iniciada",
              description: "Aguardando participantes...",
            });
            
          } else {
            throw new Error('WebRTC initialization returned null');
          }
        } catch (error) {
          console.error('❌ HOST: WebRTC initialization error:', error);
          
          toast({
            title: "Erro WebRTC",
            description: `Problema na inicialização: ${error?.message || 'Erro desconhecido'}`,
            variant: "destructive"
          });
          
          // Attempt recovery after delay
          setTimeout(() => {
            console.log('🔄 HOST: Attempting WebRTC recovery...');
            initHostWebRTC(sessionId).catch(recoveryError => {
              console.error('❌ HOST: Recovery failed:', recoveryError);
            });
          }, 5000);
        }
      };
      
      // Call the async initialization
      initializeWebRTC();

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
