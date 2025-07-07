
import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import LivePageHeader from '@/components/live/LivePageHeader';
import LivePageContent from '@/components/live/LivePageContent';
import FinalActionDialog from '@/components/live/FinalActionDialog';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC } from '@/utils/webrtc';
import { useLivePageState } from '@/hooks/live/useLivePageState';
import { useParticipantManagement } from '@/hooks/live/useParticipantManagement';
import { useQRCodeGeneration } from '@/hooks/live/useQRCodeGeneration';
import { useTransmissionWindow } from '@/hooks/live/useTransmissionWindow';
import { useFinalAction } from '@/hooks/live/useFinalAction';

const LivePage: React.FC = () => {
  const { toast } = useToast();
  const state = useLivePageState();
  const { generateQRCode, handleGenerateQRCode, handleQRCodeToTransmission } = useQRCodeGeneration();
  const { transmissionWindowRef, openTransmissionWindow, finishTransmission } = useTransmissionWindow();
  
  const { closeFinalAction } = useFinalAction({
    finalActionOpen: state.finalActionOpen,
    finalActionTimeLeft: state.finalActionTimeLeft,
    finalActionTimerId: state.finalActionTimerId,
    setFinalActionTimeLeft: state.setFinalActionTimeLeft,
    setFinalActionTimerId: state.setFinalActionTimerId,
    setFinalActionOpen: state.setFinalActionOpen
  });

  // QR Code generation effect
  useEffect(() => {
    if (state.qrCodeURL) {
      generateQRCode(state.qrCodeURL, state.setQrCodeSvg);
    }
  }, [state.qrCodeURL]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.close();
      }
      if (state.sessionId) {
        cleanupSession(state.sessionId);
      }
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.sessionId, state.localStream]);

  const updateTransmissionParticipants = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const participantsWithStreams = state.participantList.map(p => ({
        ...p,
        hasStream: p.active
      }));
      
      transmissionWindowRef.current.postMessage({
        type: 'update-participants',
        participants: participantsWithStreams
      }, '*');
    }
  };

  const participantManagement = useParticipantManagement({
    participantList: state.participantList,
    setParticipantList: state.setParticipantList,
    participantStreams: state.participantStreams,
    setParticipantStreams: state.setParticipantStreams,
    sessionId: state.sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // Enhanced session initialization effect with better debugging
  useEffect(() => {
    if (state.sessionId) {
      console.log('🚀 INITIALIZING SESSION:', state.sessionId);
      window.sessionStorage.setItem('currentSessionId', state.sessionId);
      
      const cleanup = initializeHostSession(state.sessionId, {
        onParticipantJoin: (id) => {
          console.log('📥 Host received participant join:', id);
          participantManagement.handleParticipantJoin(id);
        },
        onParticipantLeave: (id) => {
          console.log(`📤 Host received participant leave: ${id}`);
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: false } : p)
          );
        },
        onParticipantHeartbeat: (id) => {
          console.log(`💓 Host received heartbeat from: ${id}`);
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: true, lastActive: Date.now() } : p)
          );
        }
      });

      // Initialize WebRTC with enhanced logging
      initHostWebRTC(state.sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ WebRTC initialized successfully');
          
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 HOST RECEIVED STREAM:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length
            });
            participantManagement.handleParticipantStream(participantId, stream);
          });
          
          result.webrtc.setOnParticipantJoinCallback((participantId) => {
            console.log('👤 HOST RECEIVED PARTICIPANT JOIN:', participantId);
            participantManagement.handleParticipantJoin(participantId);
          });
        } else {
          console.error('❌ Failed to initialize WebRTC');
          
          toast({
            title: "Erro de inicialização",
            description: "Falha ao inicializar WebRTC. Verifique a conexão.",
            variant: "destructive"
          });
        }
      }).catch(error => {
        console.error('❌ WebRTC initialization error:', error);
        
        toast({
          title: "Erro WebRTC",
          description: "Problema na inicialização do WebRTC",
          variant: "destructive"
        });
      });

      return () => {
        cleanup();
        if (state.localStream) {
          state.localStream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [state.sessionId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        state.setBackgroundImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackgroundImage = () => {
    state.setBackgroundImage(null);
    toast({
      title: "Imagem removida",
      description: "A imagem de fundo foi removida com sucesso."
    });
  };

  const handleTransmissionMessage = (event: MessageEvent) => {
    if (event.data.type === 'transmission-ready' && event.data.sessionId === state.sessionId) {
      updateTransmissionParticipants();
      
      Object.entries(state.participantStreams).forEach(([participantId, stream]) => {
        const participant = state.participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          const channel = new BroadcastChannel(`live-session-${state.sessionId}`);
          channel.postMessage({
            type: 'video-stream',
            participantId,
            stream: {
              hasStream: true
            }
          });
        }
      });
    }
    else if (event.data.type === 'participant-joined' && event.data.sessionId === state.sessionId) {
      participantManagement.handleParticipantJoin(event.data.id);
    }
  };

  // QR position update effect
  useEffect(() => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'update-qr-positions',
        qrCodePosition: state.qrCodePosition,
        qrDescriptionPosition: state.qrDescriptionPosition,
        qrCodeVisible: state.qrCodeVisible,
        qrCodeSvg: state.qrCodeSvg,
        qrCodeDescription: state.qrCodeDescription,
        selectedFont: state.selectedFont,
        selectedTextColor: state.selectedTextColor,
        qrDescriptionFontSize: state.qrDescriptionFontSize
      }, '*');
    }
  }, [
    state.qrCodePosition, 
    state.qrDescriptionPosition, 
    state.qrCodeVisible, 
    state.qrCodeSvg, 
    state.qrCodeDescription,
    state.selectedFont,
    state.selectedTextColor,
    state.qrDescriptionFontSize
  ]);

  return (
    <div className="min-h-screen container mx-auto py-8 px-4 relative">
      <LivePageHeader />
      
      <LivePageContent
        state={state}
        participantManagement={participantManagement}
        transmissionOpen={state.transmissionOpen}
        sessionId={state.sessionId}
        onStartTransmission={() => openTransmissionWindow(state, updateTransmissionParticipants)}
        onFinishTransmission={() => finishTransmission(state, closeFinalAction)}
        onFileSelect={handleFileSelect}
        onRemoveImage={removeBackgroundImage}
        onGenerateQRCode={() => handleGenerateQRCode(state)}
        onQRCodeToTransmission={() => handleQRCodeToTransmission(state.setQrCodeVisible)}
      />
      
      <FinalActionDialog
        finalActionOpen={state.finalActionOpen}
        setFinalActionOpen={state.setFinalActionOpen}
        finalActionTimeLeft={state.finalActionTimeLeft}
        onCloseFinalAction={closeFinalAction}
      />
    </div>
  );
};

export default LivePage;
