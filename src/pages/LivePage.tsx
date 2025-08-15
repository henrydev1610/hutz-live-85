
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
// FASE 3: Sistemas WebRTC conflitantes removidos
// import { useDesktopWebRTCStability } from '@/hooks/live/useDesktopWebRTCStability';
// import { useMobileWebRTCStability } from '@/hooks/live/useMobileWebRTCStability';
import { WebRTCDebugToasts } from '@/components/live/WebRTCDebugToasts';
import { getEnvironmentInfo, clearConnectionCache } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';
import { WebSocketDiagnostics } from '@/utils/debug/WebSocketDiagnostics';
import { ServerConnectivityTest } from '@/utils/debug/ServerConnectivityTest';
import { SystemHealthDashboard } from '@/utils/debug/SystemHealthDashboard';
import { backendHealthChecker } from '@/utils/debug/BackendHealthChecker';

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

  // FASE 3: SISTEMA WebRTC UNIFICADO - Removidos sistemas conflitantes
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline' | 'fallback'>('checking');
  const [showSystemHealth, setShowSystemHealth] = useState(false);

  // FASE 1-5: COMPLETE INITIALIZATION - Environment detection, health checking, and WebRTC management
  useEffect(() => {
    const initializeLivePage = async () => {
      console.log('🚀 LIVE PAGE: Complete initialization starting...');
      
      // FASE 1: Environment detection
      const envInfo = getEnvironmentInfo();
      console.log('🌍 ENVIRONMENT:', envInfo);
      
      // FASE 2: Clear cache for fresh state
      console.log('🧹 CACHE CLEAR: Initial cleanup');
      clearConnectionCache();
      clearDeviceCache();
      
      // FASE 3: Backend health check with fallback
      console.log('🔍 BACKEND HEALTH: Starting comprehensive check...');
      setBackendStatus('checking');
      
      try {
        const healthResult = await backendHealthChecker.testWithFallback();
        
        if (healthResult.success) {
          setBackendStatus(healthResult.fallbackUsed ? 'fallback' : 'online');
          console.log(`✅ BACKEND: ${healthResult.fallbackUsed ? 'Fallback' : 'Primary'} backend online:`, healthResult.url);
          
          toast({
            title: "Backend Conectado",
            description: `${healthResult.fallbackUsed ? 'Fallback' : 'Principal'}: ${new URL(healthResult.url).host}`,
          });
        } else {
          setBackendStatus('offline');
          console.error('❌ BACKEND: All backends offline');
          
          toast({
            title: "Backend Offline",
            description: "Servidor não está respondendo. Verifique sua conexão.",
            variant: "destructive"
          });
        }
      } catch (error) {
        setBackendStatus('offline');
        console.error('❌ BACKEND CHECK FAILED:', error);
      }
      
      // FASE 4: Start continuous backend monitoring
      backendHealthChecker.startMonitoring(30000); // Check every 30s
      
      // FASE 5: Enhanced diagnostics
      try {
        await WebSocketDiagnostics.runDiagnostics();
      } catch (error) {
        console.error('❌ WEBSOCKET DIAGNOSTICS FAILED:', error);
      }
    };
    
    initializeLivePage();

    // HOST-SPECIFIC: Setup WebRTC loop breaking listeners
    const handleForceReset = () => {
      console.log('🔄 LIVE PAGE HOST: Force WebRTC reset requested');
      try {
        import('@/utils/webrtc').then(({ getWebRTCManager }) => {
          const manager = getWebRTCManager();
          if (manager) {
            manager.cleanup();
            toast({
              title: "Conexão Resetada",
              description: "WebRTC foi reinicializado com sucesso.",
            });
          }
        });
      } catch (error) {
        console.error('❌ LIVE PAGE: Reset failed:', error);
      }
    };

    const handleLoopBreak = () => {
      console.log('⚡ LIVE PAGE HOST: Break WebRTC loop requested');
      try {
        import('@/utils/webrtc').then(({ getWebRTCManager }) => {
          const manager = getWebRTCManager();
          if (manager && typeof manager.breakConnectionLoop === 'function') {
            manager.breakConnectionLoop();
            toast({
              title: "Loop Quebrado",
              description: "Conexões em loop foram limpas.",
            });
          }
        });
      } catch (error) {
        console.error('❌ LIVE PAGE: Loop break failed:', error);
      }
    };

    // Desktop-specific event handlers for improved stability
    const handleDesktopForceReset = () => {
      console.log('🖥️ LIVE PAGE: Desktop force reset triggered');
      try {
        import('@/utils/webrtc').then(({ getWebRTCManager }) => {
          const manager = getWebRTCManager();
          if (manager) {
            manager.resetWebRTC();
          }
        });
        toast({
          title: "🖥️ Desktop Reset",
          description: "WebRTC connections reset for desktop stability.",
        });
      } catch (error) {
        console.error('❌ LIVE PAGE: Desktop reset failed:', error);
      }
    };

    const handleDesktopBreakLoops = () => {
      console.log('🚫 LIVE PAGE: Desktop break loops triggered');
      try {
        import('@/utils/webrtc').then(({ getWebRTCManager }) => {
          const manager = getWebRTCManager();
          if (manager && typeof manager.breakConnectionLoop === 'function') {
            manager.breakConnectionLoop();
          }
        });
        toast({
          title: "🚫 Loops Broken",
          description: "Desktop connection loops resolved.",
        });
      } catch (error) {
        console.error('❌ LIVE PAGE: Desktop loop break failed:', error);
      }
    };

    // Add event listeners for WebRTC control
    window.addEventListener('force-webrtc-reset', handleForceReset);
    window.addEventListener('break-webrtc-loop', handleLoopBreak);
    window.addEventListener('desktop-force-reset', handleDesktopForceReset);
    window.addEventListener('desktop-break-loops', handleDesktopBreakLoops);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('force-webrtc-reset', handleForceReset);
      window.removeEventListener('break-webrtc-loop', handleLoopBreak);
      window.removeEventListener('desktop-force-reset', handleDesktopForceReset);
      window.removeEventListener('desktop-break-loops', handleDesktopBreakLoops);
      
      // Stop backend monitoring
      backendHealthChecker.stopMonitoring();
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
      
      {/* FASE 5: System Health Dashboard */}
      <SystemHealthDashboard 
        isVisible={showSystemHealth}
        onClose={() => setShowSystemHealth(false)}
      />
      
      {/* Health Monitor */}
      <ConnectionHealthMonitor 
        isVisible={showHealthMonitor}
        onClose={() => setShowHealthMonitor(false)}
      />
      
      {/* FASE 5: Enhanced Debug Controls with Backend Status */}
      <div className="fixed bottom-4 left-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => setShowSystemHealth(!showSystemHealth)}
          className="bg-purple-500 text-white p-2 rounded-full text-xs"
          title="System Health"
        >
          📊 System
        </button>
        
        <button
          onClick={() => setShowHealthMonitor(!showHealthMonitor)}
          className="bg-blue-500 text-white p-2 rounded-full text-xs"
          title="Debug Panel"
        >
          🔧 Debug
        </button>
        
        <button
          onClick={async () => {
            const healthResult = await backendHealthChecker.testWithFallback();
            const envInfo = getEnvironmentInfo();
            
            console.log('🌍 Environment Info:', envInfo);
            console.log('🔍 Backend Health:', healthResult);
            
            toast({
              title: "System Status",
              description: `Backend: ${healthResult.success ? 'Online' : 'Offline'} | Env: ${envInfo.isLocalhost ? 'Local' : 'Production'}`,
            });
          }}
          className={`text-white p-2 rounded-full text-xs ${
            backendStatus === 'online' ? 'bg-green-500' : 
            backendStatus === 'fallback' ? 'bg-yellow-500' :
            backendStatus === 'checking' ? 'bg-blue-500' : 'bg-red-500'
          }`}
          title={`Backend Status: ${backendStatus}`}
        >
          {backendStatus === 'online' ? '🟢' : 
           backendStatus === 'fallback' ? '🟡' :
           backendStatus === 'checking' ? '🔄' : '🔴'} Backend
        </button>
        
        <button
          onClick={async () => {
            console.log('🔄 FORCE REFRESH: Clearing all caches and retesting...');
            clearConnectionCache();
            setBackendStatus('checking');
            
            const result = await backendHealthChecker.testWithFallback();
            setBackendStatus(result.success ? (result.fallbackUsed ? 'fallback' : 'online') : 'offline');
            
            toast({
              title: "System Refreshed",
              description: `Backend: ${result.success ? 'Available' : 'Unavailable'}`,
            });
          }}
          className="bg-purple-500 text-white p-2 rounded-full text-xs"
          title="Force Refresh"
        >
          🔄 Refresh
        </button>
      </div>

      <WebRTCDebugToasts />
      
      {/* FASE 5: Painel de Debug Lovable */}
      <LovableDebugPanel sessionId={state.sessionId} />
    </div>
  );
};

export default LivePage;
