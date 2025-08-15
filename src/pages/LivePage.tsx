
import React, { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import LivePageContainer from '@/components/live/LivePageContainer';
import { LovableDebugPanel } from '@/components/debug/LovableDebugPanel';
import ConnectionHealthMonitor from '@/components/live/ConnectionHealthMonitor';
import { useLivePageState } from '@/hooks/live/useLivePageState';
import { useParticipantManagement } from '@/hooks/live/useParticipantManagement';
import { useQRCodeGeneration } from '@/hooks/live/useQRCodeGeneration';
import { useTransmissionWindow } from '@/hooks/live/useTransmissionWindow';
import { useFinalAction } from '@/hooks/live/useFinalAction';
import { useLivePageEffects } from '@/hooks/live/useLivePageEffects';
import { useTransmissionMessageHandler } from '@/hooks/live/useTransmissionMessageHandler';
import { useStreamDisplayManager } from '@/hooks/live/useStreamDisplayManager';
// FASE 1: Removed conflicting stability hooks
import { WebRTCDebugToasts } from '@/components/live/WebRTCDebugToasts';
import { WebRTCConnectionStatus } from '@/components/live/WebRTCConnectionStatus';
import { ServerConnectivityIndicator } from '@/components/live/ServerConnectivityIndicator';
import { consolidatedWebRTCManager } from '@/utils/webrtc/ConsolidatedWebRTCManager';
import { getEnvironmentInfo, clearConnectionCache } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';
import { WebSocketDiagnostics } from '@/utils/debug/WebSocketDiagnostics';
import { ServerConnectivityTest } from '@/utils/debug/ServerConnectivityTest';

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

  // Initialize centralized video display manager
  useStreamDisplayManager();

  // Environment detection and WebRTC management
  useEffect(() => {
    const envInfo = getEnvironmentInfo();
    console.log('🌍 LIVE PAGE: Environment detected:', envInfo);
    
    // Clear cache on first load to ensure fresh state
    console.log('🧹 LIVE PAGE: Initial cache clear');
    clearConnectionCache();
    clearDeviceCache();

    // HOST-SPECIFIC: Setup WebRTC loop breaking listeners
    const handleForceReset = () => {
      console.log('🔄 CONSOLIDATED: Force WebRTC reset requested');
      try {
        consolidatedWebRTCManager.cleanup();
        
        // Reinitialize if session exists
        if (state.sessionId) {
          consolidatedWebRTCManager.initializeAsHost(state.sessionId);
        }
        
        toast({
          title: "Conexão Resetada",
          description: "Sistema WebRTC consolidado foi reinicializado.",
        });
      } catch (error) {
        console.error('❌ CONSOLIDATED: Reset failed:', error);
      }
    };

    const handleLoopBreak = () => {
      console.log('⚡ CONSOLIDATED: Break WebRTC loop requested');
      try {
        consolidatedWebRTCManager.cleanup();
        toast({
          title: "Loop Quebrado",
          description: "Todas as conexões foram limpas.",
        });
      } catch (error) {
        console.error('❌ CONSOLIDATED: Loop break failed:', error);
      }
    };

    // Add event listeners for WebRTC control
    window.addEventListener('force-webrtc-reset', handleForceReset);
    window.addEventListener('break-webrtc-loop', handleLoopBreak);

    // Executar diagnósticos críticos na primeira carga
    const runInitialDiagnostics = async () => {
      console.log('🔧 LIVE PAGE: Running initial connectivity diagnostics...');
      
      try {
        // Teste de conectividade do servidor
        await ServerConnectivityTest.runComprehensiveTest();
        
        // Diagnósticos de WebSocket
        const wsResult = await WebSocketDiagnostics.runDiagnostics();
        
        if (!wsResult.success) {
          console.warn('⚠️ LIVE PAGE: WebSocket diagnostics failed:', wsResult.error);
          toast({
            title: "Problema de Conectividade",
            description: "Detectamos problemas de conexão. Verifique sua internet.",
            variant: "destructive",
          });
        }
        
      } catch (error) {
        console.error('❌ LIVE PAGE: Diagnostics failed:', error);
      }
    };

    runInitialDiagnostics();

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('force-webrtc-reset', handleForceReset);
      window.removeEventListener('break-webrtc-loop', handleLoopBreak);
    };
  }, [toast]);

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
    updateTransmissionParticipants,
    isHost: true // CORREÇÃO CRÍTICA: Forçar papel de host na rota /live
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
            const debugInfo = consolidatedWebRTCManager.getDebugInfo();
            console.log('🎯 CONSOLIDATED DEBUG:', debugInfo);
            toast({
              title: "Debug Info",
              description: `Connections: ${debugInfo.connectionsCount} | State: ${debugInfo.connectionState.overall}`,
            });
          }}
          className="bg-purple-500 text-white p-2 rounded-full text-xs"
          title="Consolidated WebRTC Debug"
        >
          🎯 WebRTC
        </button>
      </div>

      <WebRTCDebugToasts />
      <WebRTCConnectionStatus />
      <ServerConnectivityIndicator />
      
      {/* CONSOLIDADO: Painel de Debug Lovable */}
      <LovableDebugPanel sessionId={state.sessionId} />
    </div>
  );
};

export default LivePage;
