import React, { useEffect } from 'react';
import LivePageHeader from '@/components/live/LivePageHeader';
import LivePageContent from '@/components/live/LivePageContent';
import FinalActionDialog from '@/components/live/FinalActionDialog';
import { clearConnectionCache, forceRefreshConnections, getEnvironmentInfo, validateURLConsistency } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';
import { Room, RemoteParticipant } from 'livekit-client';

interface LivePageContainerProps {
  state: any;
  participantManagement: any;
  transmissionOpen: boolean;
  sessionId: string | null;
  onStartTransmission: () => void;
  onFinishTransmission: () => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onGenerateQRCode: () => void;
  onQRCodeToTransmission: () => void;
  closeFinalAction: () => void;
  onStreamReceived: (participantId: string, stream: MediaStream) => void;
  livekitRoom?: Room | null;
  livekitParticipants?: RemoteParticipant[];
}

const LivePageContainer: React.FC<LivePageContainerProps> = ({
  state,
  participantManagement,
  transmissionOpen,
  sessionId,
  onStartTransmission,
  onFinishTransmission,
  onFileSelect,
  onRemoveImage,
  onGenerateQRCode,
  onQRCodeToTransmission,
  closeFinalAction,
  onStreamReceived,
  livekitRoom,
  livekitParticipants = []
}) => {
  // FASE 5: Enhanced cache management with URL sync validation
  useEffect(() => {
    console.log('🏠 LIVE CONTAINER: Initializing with ENHANCED cache management and URL sync');
    
    // FASE 5: Initial URL consistency check
    const isConsistent = validateURLConsistency();
    if (!isConsistent) {
      console.warn('⚠️ LIVE CONTAINER: URL inconsistency detected at startup');
      forceRefreshConnections();
    }
    
    // Clear cache periodically to prevent stale data
    const cacheInterval = setInterval(() => {
      console.log('🧹 LIVE CONTAINER: Periodic cache cleanup with URL validation');
      clearConnectionCache();
      clearDeviceCache();
      
      // FASE 5: Periodic URL consistency check
      const stillConsistent = validateURLConsistency();
      if (!stillConsistent) {
        console.warn('⚠️ LIVE CONTAINER: URL drift detected, forcing refresh');
        forceRefreshConnections();
      }
    }, 60000); // Every minute
    
    return () => {
      clearInterval(cacheInterval);
    };
  }, []);

  // FASE 2: Session-specific cache clearing with environment validation
  useEffect(() => {
    if (sessionId) {
      console.log('🆕 LIVE CONTAINER: New session detected, clearing cache and validating environment');
      clearConnectionCache();
      clearDeviceCache();
      forceRefreshConnections();
      
      // FASE 5: Environment consistency check
      const envInfo = getEnvironmentInfo();
      if (!envInfo.urlMapping.isURLSynced) {
        console.error('❌ LIVE CONTAINER: CRITICAL - URLs not properly synced for mobile streaming');
      }
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen container mx-auto py-8 px-4 relative">
      <LivePageHeader />
      
      <LivePageContent
        state={state}
        participantManagement={participantManagement}
        transmissionOpen={transmissionOpen}
        sessionId={sessionId}
        onStartTransmission={onStartTransmission}
        onFinishTransmission={onFinishTransmission}
        onFileSelect={onFileSelect}
        onRemoveImage={onRemoveImage}
        onGenerateQRCode={onGenerateQRCode}
        onQRCodeToTransmission={onQRCodeToTransmission}
        onStreamReceived={onStreamReceived}
        livekitRoom={livekitRoom}
        livekitParticipants={livekitParticipants}
      />
      
      <FinalActionDialog
        finalActionOpen={state.finalActionOpen}
        setFinalActionOpen={state.setFinalActionOpen}
        finalActionTimeLeft={state.finalActionTimeLeft}
        onCloseFinalAction={closeFinalAction}
      />
      
      {/* FASE 5: Enhanced Debug Controls with mobile info */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => {
            clearConnectionCache();
            clearDeviceCache();
            console.log('🧹 Manual cache clear triggered with URL sync');
            const envInfo = getEnvironmentInfo();
            console.log('🌐 Environment after cache clear:', envInfo);
          }}
          className="bg-red-500 text-white p-2 rounded text-xs"
          title="Clear All Cache + URL Check"
        >
          🧹 Clear Cache
        </button>
        
        <button
          onClick={() => {
            forceRefreshConnections();
            console.log('🔄 Manual connection refresh with URL validation');
            const isConsistent = validateURLConsistency();
            console.log('🔍 URL consistency after refresh:', isConsistent ? '✅' : '❌');
          }}
          className="bg-blue-500 text-white p-2 rounded text-xs"
          title="Refresh Connections + URL Sync"
        >
          🔄 Refresh
        </button>
        
        {/* FASE 5: Mobile URL Debug Button */}
        <button
          onClick={() => {
            const envInfo = getEnvironmentInfo();
            const urlSyncStatus = envInfo.urlMapping.isURLSynced ? '✅ SYNCED' : '❌ NOT_SYNCED';
            const mobileStatus = envInfo.mobileInfo.accessedViaQR ? '📱 QR' : '🖥️ Direct';
            console.log(`🌐 Quick Status: URLs ${urlSyncStatus}, Access ${mobileStatus}`);
            alert(`URLs: ${urlSyncStatus}\nAccess: ${mobileStatus}\nBackend: ${envInfo.urlMapping.backend}`);
          }}
          className="bg-green-500 text-white p-2 rounded text-xs"
          title="URL + Mobile Status"
        >
          📱 Status
        </button>
      </div>
    </div>
  );
};

export default LivePageContainer;
