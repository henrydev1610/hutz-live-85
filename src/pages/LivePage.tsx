
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

  // ENHANCED: Transmission participants update with debugging
  const updateTransmissionParticipants = () => {
    console.log('🔄 HOST: Updating transmission participants');
    
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const participantsWithStreams = state.participantList.map(p => ({
        ...p,
        hasStream: p.active && p.hasVideo
      }));
      
      const selectedParticipants = participantsWithStreams.filter(p => p.selected);
      
      console.log('📊 HOST: Transmission update:', {
        totalParticipants: participantsWithStreams.length,
        selectedParticipants: selectedParticipants.length,
        activeStreams: Object.keys(state.participantStreams).length
      });
      
      transmissionWindowRef.current.postMessage({
        type: 'update-participants',
        participants: participantsWithStreams,
        timestamp: Date.now()
      }, '*');
      
      console.log('✅ HOST: Participants sent to transmission window');
    } else {
      console.warn('⚠️ HOST: Transmission window not available for update');
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
      console.log('🚀 HOST: INITIALIZING SESSION:', state.sessionId);
      window.sessionStorage.setItem('currentSessionId', state.sessionId);
      
      const cleanup = initializeHostSession(state.sessionId, {
        onParticipantJoin: (id) => {
          console.log('📥 HOST: Participant join event:', id);
          participantManagement.handleParticipantJoin(id);
        },
        onParticipantLeave: (id) => {
          console.log(`📤 HOST: Participant leave event: ${id}`);
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: false, selected: false } : p)
          );
        },
        onParticipantHeartbeat: (id) => {
          console.log(`💓 HOST: Heartbeat from: ${id}`);
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: true, lastActive: Date.now() } : p)
          );
        }
      });

      // Initialize WebRTC with enhanced logging
      initHostWebRTC(state.sessionId).then(result => {
        if (result && result.webrtc) {
          console.log('✅ HOST: WebRTC initialized successfully');
          
          result.webrtc.setOnStreamCallback((participantId, stream) => {
            console.log('🎥 HOST: RECEIVED STREAM from:', participantId, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              active: stream.active
            });
            
            // Handle stream with enhanced processing
            participantManagement.handleParticipantStream(participantId, stream);
            
            // Update transmission immediately
            setTimeout(() => {
              console.log('🔄 HOST: Updating transmission after stream received');
              updateTransmissionParticipants();
            }, 200);
          });
          
          result.webrtc.setOnParticipantJoinCallback((participantId) => {
            console.log('👤 HOST: PARTICIPANT JOIN via WebRTC:', participantId);
            participantManagement.handleParticipantJoin(participantId);
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
        if (state.localStream) {
          state.localStream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [state.sessionId]);

  // ENHANCED: Monitor participant streams changes
  useEffect(() => {
    const streamCount = Object.keys(state.participantStreams).length;
    const selectedCount = state.participantList.filter(p => p.selected).length;
    
    console.log('📊 HOST: Stream monitoring:', {
      activeStreams: streamCount,
      selectedParticipants: selectedCount,
      transmissionOpen: state.transmissionOpen
    });
    
    // Auto-update transmission when streams change
    if (state.transmissionOpen && streamCount > 0) {
      console.log('🔄 HOST: Auto-updating transmission due to stream changes');
      setTimeout(() => {
        updateTransmissionParticipants();
      }, 300);
    }
  }, [state.participantStreams, state.participantList, state.transmissionOpen]);

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

  // Enhanced transmission message handler
  const handleTransmissionMessage = (event: MessageEvent) => {
    console.log('📨 HOST: Received message from transmission:', event.data.type);
    
    if (event.data.type === 'transmission-ready' && event.data.sessionId === state.sessionId) {
      console.log('🎯 HOST: Transmission ready, sending initial data');
      
      updateTransmissionParticipants();
      
      // Send existing streams to transmission
      Object.entries(state.participantStreams).forEach(([participantId, stream]) => {
        const participant = state.participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          console.log('📤 HOST: Sending existing stream to transmission:', participantId);
          
          if (participantManagement.transferStreamToTransmission) {
            participantManagement.transferStreamToTransmission(participantId, stream);
          }
        }
      });
    }
    else if (event.data.type === 'transmission-heartbeat') {
      console.log('💓 HOST: Transmission heartbeat -', event.data.activeParticipants, 'participants');
    }
    else if (event.data.type === 'participant-joined' && event.data.sessionId === state.sessionId) {
      console.log('👤 HOST: Participant joined via transmission message:', event.data.id);
      participantManagement.handleParticipantJoin(event.data.id);
    }
  };

  // Add transmission message listener
  useEffect(() => {
    window.addEventListener('message', handleTransmissionMessage);
    return () => window.removeEventListener('message', handleTransmissionMessage);
  }, [state.sessionId, state.participantStreams, state.participantList]);

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
