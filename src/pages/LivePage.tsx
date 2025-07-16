
import React, { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import LivePageContainer from '@/components/live/LivePageContainer';
import ConnectionHealthMonitor from '@/components/live/ConnectionHealthMonitor';
import { useLivePageState } from '@/hooks/live/useLivePageState';
import { useParticipantManagement } from '@/hooks/live/useParticipantManagement';
import { useQRCodeGeneration } from '@/hooks/live/useQRCodeGeneration';
import { useTransmissionWindow } from '@/hooks/live/useTransmissionWindow';
import { useFinalAction } from '@/hooks/live/useFinalAction';
import { useLivePageEffects } from '@/hooks/live/useLivePageEffects';
import { useTransmissionMessageHandler } from '@/hooks/live/useTransmissionMessageHandler';
import { useWebRTCStabilityIntegration } from '@/hooks/live/useWebRTCStabilityIntegration';
import { useHostRemoteStreamManager } from '@/hooks/live/useHostRemoteStreamManager';
import { useStreamForwarding } from '@/hooks/live/useStreamForwarding';
import { ConnectionStabilityIndicator } from '@/components/live/ConnectionStabilityIndicator';

const LivePage: React.FC = () => {
  const { toast } = useToast();
  const state = useLivePageState();
  const [showHealthMonitor, setShowHealthMonitor] = useState(false);
  const stability = useWebRTCStabilityIntegration();
  const { generateQRCode, handleGenerateQRCode, handleQRCodeToTransmission } = useQRCodeGeneration();
  const { transmissionWindowRef, openTransmissionWindow, finishTransmission } = useTransmissionWindow();
  
  // HOST: Manage remote streams display (no local camera)
  useHostRemoteStreamManager({
    participantStreams: state.participantStreams,
    participantList: state.participantList,
    transmissionWindowRef
  });
  
  // CRITICAL: Forward streams to transmission window
  const { forceStreamUpdate } = useStreamForwarding({
    participantStreams: state.participantStreams,
    participantList: state.participantList,
    sessionId: state.sessionId,
    transmissionWindowRef
  });
  
  const { closeFinalAction } = useFinalAction({
    finalActionOpen: state.finalActionOpen,
    finalActionTimeLeft: state.finalActionTimeLeft,
    finalActionTimerId: state.finalActionTimerId,
    setFinalActionTimeLeft: state.setFinalActionTimeLeft,
    setFinalActionTimerId: state.setFinalActionTimerId,
    setFinalActionOpen: state.setFinalActionOpen
  });

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

  // Use the effects hook
  const { forceSyncNow } = useLivePageEffects({
    sessionId: state.sessionId,
    participantStreams: state.participantStreams,
    participantList: state.participantList,
    transmissionOpen: state.transmissionOpen,
    transmissionWindowRef,
    handleParticipantJoin: participantManagement.handleParticipantJoin,
    handleParticipantStream: participantManagement.handleParticipantStream,
    setParticipantList: state.setParticipantList,
    updateTransmissionParticipants,
    generateQRCode,
    qrCodeURL: state.qrCodeURL,
    setQrCodeSvg: state.setQrCodeSvg
  });

  // Use the transmission message handler
  useTransmissionMessageHandler({
    sessionId: state.sessionId,
    participantStreams: state.participantStreams,
    participantList: state.participantList,
    transmissionWindowRef,
    updateTransmissionParticipants,
    handleParticipantJoin: participantManagement.handleParticipantJoin,
    transferStreamToTransmission: participantManagement.transferStreamToTransmission
  });

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
    <div className="relative">
      <LivePageContainer
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
        closeFinalAction={closeFinalAction}
      />
      
      {/* Health Monitor */}
      <ConnectionHealthMonitor 
        isVisible={showHealthMonitor}
        onClose={() => setShowHealthMonitor(false)}
      />
      
      {/* Enhanced Debug Button */}
      <div className="fixed bottom-4 left-4 space-y-2">
        <button
          onClick={() => setShowHealthMonitor(!showHealthMonitor)}
          className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {showHealthMonitor ? 'Ocultar' : 'Mostrar'} Diagnósticos
        </button>
        
        {/* Force Stream Update Button */}
        <button
          onClick={() => {
            console.log('🔄 HOST: Force stream update requested');
            forceStreamUpdate();
            if (forceSyncNow) {
              forceSyncNow();
            }
            updateTransmissionParticipants();
          }}
          className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
        >
          Atualizar Streams
        </button>
        
        {/* Quick Status Indicator */}
        <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          WebRTC: {stability.connectionStatus.webrtc === 'connected' ? '✅ Conectado' : '❌ Desconectado'}
        </div>
      </div>
    </div>
  );
};

export default LivePage;
