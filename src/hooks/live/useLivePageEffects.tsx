
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

  // Enhanced session initialization effect - Start WebRTC immediately on mount
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

      // Initialize WebRTC with enhanced logging
      initHostWebRTC(sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ HOST: WebRTC initialized successfully');
          
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 HOST: RECEIVED STREAM from:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              active: stream.active
            });
            
            handleParticipantStream(participantId, stream);
            
            // Update transmission immediately
            setTimeout(() => {
              console.log('🔄 HOST: Updating transmission after stream received');
              updateTransmissionParticipants();
            }, 200);
          });
          
          result.webrtc.setOnParticipantJoinCallback((participantId) => {
            console.log('👤 HOST: PARTICIPANT JOIN via WebRTC:', participantId);
            handleParticipantJoin(participantId);
          });
        } else {
          console.error('❌ HOST: Failed to initialize WebRTC');
          
          toast({
            title: "Erro de inicialização",
            description: "Falha ao inicializar WebRTC. Verifique a conexão.",
            variant: "destructive"
          });
        }
      }).catch(error => {
        console.error('❌ HOST: WebRTC initialization error:', error);
        
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

  // NEW: Enhanced auto-reconnection monitoring effect
  useEffect(() => {
    if (!sessionId) return;
    
    const checkWebRTCHealth = setInterval(() => {
      console.log('🔍 HOST: CRITICAL - Checking WebRTC health...');
      
      // Check if WebRTC is still connected
      const webrtcManager = require('@/utils/webrtc').getWebRTCManager();
      if (webrtcManager) {
        const state = webrtcManager.getConnectionState();
        console.log('📊 HOST: Connection state:', state);
        
        // Also check if we have active streams but no participants showing video
        const currentParticipants = participantList.filter(p => !p.id.startsWith('placeholder-'));
        const participantsWithVideo = currentParticipants.filter(p => p.hasVideo);
        
        console.log('👥 HOST: Participants status:', {
          total: currentParticipants.length,
          withVideo: participantsWithVideo.length,
          activeStreams: Object.keys(participantStreams).length
        });
        
        // CRITICAL: If we have participants but no video, force recovery
        const needsRecovery = state.overall === 'failed' || 
                             state.websocket === 'failed' ||
                             (currentParticipants.length > 0 && participantsWithVideo.length === 0);
        
        if (needsRecovery) {
          console.log('🚨 HOST: CRITICAL - Connection needs recovery, attempting fix...');
          
          // Re-initialize WebRTC
          initHostWebRTC(sessionId).then(result => {
            if (result && result.webrtc) {
              console.log('✅ HOST: CRITICAL - WebRTC recovery successful');
              
              result.webrtc.setOnStreamCallback((participantId, stream) => {
                console.log('🎥 HOST: CRITICAL - RECOVERY STREAM RECEIVED from:', participantId);
                console.log('🔍 HOST: Stream details:', {
                  streamId: stream.id,
                  active: stream.active,
                  videoTracks: stream.getVideoTracks().length,
                  audioTracks: stream.getAudioTracks().length
                });
                
                handleParticipantStream(participantId, stream);
                setTimeout(() => updateTransmissionParticipants(), 200);
              });
              
              result.webrtc.setOnParticipantJoinCallback((participantId) => {
                console.log('👤 HOST: CRITICAL - RECOVERY PARTICIPANT JOIN:', participantId);
                handleParticipantJoin(participantId);
              });
            }
          }).catch(error => {
            console.error('❌ HOST: CRITICAL - WebRTC recovery failed:', error);
          });
        }
      }
    }, 10000); // Check every 10 seconds for faster detection
    
    return () => clearInterval(checkWebRTCHealth);
  }, [sessionId, participantList, participantStreams]);

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
