
import React from 'react';
import LivePageHeader from '@/components/live/LivePageHeader';
import LivePageContent from '@/components/live/LivePageContent';
import FinalActionDialog from '@/components/live/FinalActionDialog';

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
    </div>
  );
};

export default LivePageContainer;
