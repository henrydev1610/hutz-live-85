
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC, getWebRTCManager } from '@/utils/webrtc';
import { useAutoParticipantDetection } from './useAutoParticipantDetection';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface UseLivePageEffectsProps {
  sessionId: string | null;
  localStream: MediaStream | null;
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  transmissionOpen: boolean;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  handleParticipantJoin: (id: string, participantInfo?: any) => void;
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

  // Hook de auto-detecção de participantes
  useAutoParticipantDetection({
    sessionId: sessionId || '',
    setParticipantList,
    handleParticipantJoin
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, localStream]);

  // WebSocket event handlers with enhanced participant detection
  useEffect(() => {
    if (sessionId) {
      const unifiedService = unifiedWebSocketService;

      // CORREÇÃO CRÍTICA: Set up callbacks for enhanced participant detection
      unifiedService.setCallbacks({
        onUserConnected: (data) => {
          console.log('🔗 LIVE EFFECTS: User connected via WebSocket:', data);
          
          // CORREÇÃO CRÍTICA: Validar e extrair userId do objeto
          if (!data || typeof data !== 'object' || !data.userId) {
            console.error('❌ onUserConnected: Formato inválido:', data);
            return;
          }
          
          const { userId } = data;
          console.log('🎯 CRÍTICO: Processando conexão de participante:', userId);
          
          // FASE F: Verificar se é um participante válido e implementar fluxo determinístico
          if (userId && typeof userId === 'string' && userId.includes('participant-')) {
            console.log('✅ PARTICIPANTE DETECTADO: Iniciando fluxo determinístico');
            
            // Chamar handleParticipantJoin
            handleParticipantJoin(userId, {
              isMobile: true,
              selected: true,
              connectedAt: Date.now()
            });
            
            // Atualizar lista de participantes
            setParticipantList(prev => {
              const existing = prev.find(p => p.id === userId);
              if (!existing) {
                console.log('🆕 FLUXO DETERMINÍSTICO: Adicionando participante:', userId);
                return [...prev, {
                  id: userId,
                  name: `Mobile-${userId.substring(0, 8)}`,
                  hasVideo: false,
                  active: true,
                  selected: true,
                  joinedAt: Date.now(),
                  lastActive: Date.now(),
                  connectedAt: Date.now(),
                  isMobile: true
                }];
              }
              return prev.map(p => 
                p.id === userId 
                  ? { ...p, active: true, selected: true, connectedAt: Date.now() }
                  : p
              );
            });

            // ETAPA 3: Solicitar offer IMEDIATAMENTE após detecção do participante
            setTimeout(() => {
              import('@/webrtc/handshake/HostHandshake').then(({ requestOfferFromParticipant }) => {
                console.log('🚀 CRÍTICO: HOST solicitando offer IMEDIATO do participante:', userId);
                requestOfferFromParticipant(userId);
                
                // TIMEOUT: Se não receber offer em 10s, tentar novamente
                setTimeout(() => {
                  console.log('⚠️ TIMEOUT: Reenvindo solicitação de offer para:', userId);
                  requestOfferFromParticipant(userId);
                }, 10000);
                
              }).catch(err => {
                console.error('❌ HOST: Erro crítico ao solicitar offer:', err);
              });
            }, 500); // Reduzido para resposta mais rápida

          } else {
            console.log('ℹ️ HOST DETECTADO:', userId);
            handleParticipantJoin(userId);
          }
        },
        onUserDisconnected: (userId) => {
          console.log('🔗 LIVE EFFECTS: User disconnected via WebSocket:', userId);
          setParticipantList(prev => 
            prev.map(p => 
              p.id === userId 
                ? { ...p, active: false, lastActive: Date.now() }
                : p
            )
          );
        },
        onStreamStarted: (participantId, streamInfo) => {
          console.log('🎥 LIVE EFFECTS: Stream started via WebSocket:', participantId, streamInfo);
          // This will be handled by the participant streams logic
        }
      });
    }
  }, [sessionId, handleParticipantJoin, setParticipantList]);

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

      // FASE D: Initialize WebRTC com handlers padronizados
      console.log('🚀 WEBRTC INIT: Starting WebRTC initialization...');
      initHostWebRTC(sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ WEBRTC INIT: WebRTC initialized successfully');

          // FASE D: Garantir que os handlers WebRTC estão configurados
          import('@/webrtc/handshake/HostHandshake').then(() => {
            console.log('✅ HOST HANDSHAKE: Handlers padronizados carregados');
          });
          
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
          
          // FASE C: Registrar window.hostStreamCallback para ponte host→popup
          console.log(`🎯 PONTE HOST→POPUP: Registrando callbacks WebRTC`);
          
          // REMOVIDO: window.hostStreamCallback duplicado
          // Já registrado em useParticipantManagement ANTES do WebRTC setup
          
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 WEBRTC CALLBACK: Stream callback executado para:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              active: stream.active,
              timestamp: Date.now()
            });
            
            // FLUXO ÚNICO: Usar window.hostStreamCallback se disponível
            if (typeof window !== 'undefined' && window.hostStreamCallback) {
              window.hostStreamCallback(participantId, stream);
            } else {
              console.warn('⚠️ window.hostStreamCallback não disponível, usando fallback');
              handleParticipantStream(participantId, stream);
              setTimeout(() => updateTransmissionParticipants(), 300);
            }
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
