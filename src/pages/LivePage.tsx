
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
import { WebRTCDebugToasts } from '@/components/live/WebRTCDebugToasts';
import { getEnvironmentInfo, clearConnectionCache } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

const LivePage: React.FC = () => {
  const { toast } = useToast();
  const state = useLivePageState();
  const [showHealthMonitor, setShowHealthMonitor] = useState(false);
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

  // Environment detection and cache management
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    console.log('🌍 LIVE PAGE: Environment detected:', envInfo);
    
    // Clear cache on first load to ensure fresh state
    console.log('🧹 LIVE PAGE: Initial cache clear');
    clearConnectionCache();
    clearDeviceCache();
  }, []);

  // ENHANCED: Transmission participants update with debugging and cache management
  const updateTransmissionParticipants = () => {
    console.log('🔄 HOST: Updating transmission participants with cache awareness');
    
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const participantsWithStreams = state.participantList.map(p => ({
        ...p,
        hasStream: p.active && p.hasVideo
      }));
      
      const selectedParticipants = participantsWithStreams.filter(p => p.selected);
      
      console.log('📊 HOST: Transmission update with environment info:', {
        totalParticipants: participantsWithStreams.length,
        selectedParticipants: selectedParticipants.length,
        activeStreams: Object.keys(state.participantStreams).length,
        environment: getEnvironmentInfo()
      });
      
      try {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: participantsWithStreams,
          environment: getEnvironmentInfo(),
          timestamp: Date.now(),
          cacheVersion: Date.now() // Force cache refresh
        }, '*');
        
        console.log('✅ HOST: Participants sent to transmission window with cache busting');
      } catch (error) {
        console.error('❌ HOST: Failed to send participants to transmission:', error);
        
        // Retry with cache clear
        console.log('🔄 HOST: Retrying with cache clear');
        clearConnectionCache();
        setTimeout(() => {
          updateTransmissionParticipants();
        }, 1000);
      }
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
  useLivePageEffects({
    sessionId: state.sessionId,
    localStream: state.localStream,
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

  // Enhanced QR position update effect with cache busting
  useEffect(() => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      try {
        transmissionWindowRef.current.postMessage({
          type: 'update-qr-positions',
          qrCodePosition: state.qrCodePosition,
          qrDescriptionPosition: state.qrDescriptionPosition,
          qrCodeVisible: state.qrCodeVisible,
          qrCodeSvg: state.qrCodeSvg,
          qrCodeDescription: state.qrCodeDescription,
          selectedFont: state.selectedFont,
          selectedTextColor: state.selectedTextColor,
          qrDescriptionFontSize: state.qrDescriptionFontSize,
          cacheVersion: Date.now(), // Force cache refresh
          environment: getEnvironmentInfo()
        }, '*');
      } catch (error) {
        console.error('❌ LIVE PAGE: Failed to update QR positions:', error);
      }
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
      
      {/* Enhanced Debug Controls */}
      <div className="fixed bottom-4 left-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => setShowHealthMonitor(!showHealthMonitor)}
          className="bg-blue-500 text-white p-2 rounded-full text-xs"
          title="Debug Panel"
        >
          🔧 Debug
        </button>
        
        <button
          onClick={() => {
            const envInfo = getEnvironmentInfo();
            console.log('🌍 Environment Info:', envInfo);
            toast({
              title: "Environment Info",
              description: `${envInfo.isLovable ? 'Lovable' : envInfo.isLocalhost ? 'Local' : 'Production'} - ${envInfo.wsUrl}`,
            });
          }}
          className="bg-green-500 text-white p-2 rounded-full text-xs"
          title="Environment Info"
        >
          🌍 Env
        </button>
      </div>

      <WebRTCDebugToasts />
    </div>
  );
};

export default LivePage;
