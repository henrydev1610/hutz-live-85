
import React, { useEffect } from 'react';
import LivePageHeader from '@/components/live/LivePageHeader';
import LivePageContent from '@/components/live/LivePageContent';
import FinalActionDialog from '@/components/live/FinalActionDialog';
import { clearConnectionCache, forceRefreshConnections } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

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
  closeFinalAction
}) => {
  // Cache management on mount and session changes
  useEffect(() => {
    console.log('🏠 LIVE CONTAINER: Initializing with cache management');
    
    // Clear cache periodically to prevent stale data
    const cacheInterval = setInterval(() => {
      console.log('🧹 LIVE CONTAINER: Periodic cache cleanup');
      clearConnectionCache();
      clearDeviceCache();
    }, 60000); // Every minute
    
    return () => {
      clearInterval(cacheInterval);
    };
  }, []);

  // Session-specific cache clearing
  useEffect(() => {
    if (sessionId) {
      console.log('🆕 LIVE CONTAINER: New session detected, clearing cache');
      clearConnectionCache();
      clearDeviceCache();
      forceRefreshConnections();
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
      />
      
      <FinalActionDialog
        finalActionOpen={state.finalActionOpen}
        setFinalActionOpen={state.setFinalActionOpen}
        finalActionTimeLeft={state.finalActionTimeLeft}
        onCloseFinalAction={closeFinalAction}
      />
      
      {/* Debug Cache Controls */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => {
            clearConnectionCache();
            clearDeviceCache();
            console.log('🧹 Manual cache clear triggered');
          }}
          className="bg-red-500 text-white p-2 rounded text-xs"
          title="Clear All Cache"
        >
          🧹 Clear Cache
        </button>
        
        <button
          onClick={() => {
            forceRefreshConnections();
            console.log('🔄 Manual connection refresh triggered');
          }}
          className="bg-blue-500 text-white p-2 rounded text-xs"
          title="Refresh Connections"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default LivePageContainer;
