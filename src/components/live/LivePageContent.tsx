
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LivePreview from '@/components/live/LivePreview';
import TransmissionControls from '@/components/live/TransmissionControls';
import LiveControlTabs from '@/components/live/LiveControlTabs';
import { Participant } from '@/components/live/ParticipantGrid';

interface LivePageContentProps {
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
}

const LivePageContent: React.FC<LivePageContentProps> = ({
  state,
  participantManagement,
  transmissionOpen,
  sessionId,
  onStartTransmission,
  onFinishTransmission,
  onFileSelect,
  onRemoveImage,
  onGenerateQRCode,
  onQRCodeToTransmission
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 min-h-[700px]">
          <CardHeader className="flex flex-row justify-between items-center">
            <div className="flex items-center gap-4 w-full">
              <CardTitle className="flex items-center gap-2">
                Controle de Transmissão
              </CardTitle>
              <TransmissionControls
                transmissionOpen={transmissionOpen}
                sessionId={sessionId}
                onStartTransmission={onStartTransmission}
                onFinishTransmission={onFinishTransmission}
              />
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              Gerencie participantes, layout e aparência da sua transmissão ao vivo
            </CardDescription>
            
            <LiveControlTabs
              participantList={state.participantList}
              onSelectParticipant={participantManagement.handleParticipantSelect}
              onRemoveParticipant={participantManagement.handleParticipantRemove}
              participantStreams={state.participantStreams}
              sessionId={sessionId || ''}
              participantCount={state.participantCount}
              setParticipantCount={state.setParticipantCount}
              qrCodeDescription={state.qrCodeDescription}
              setQrCodeDescription={state.setQrCodeDescription}
              selectedFont={state.selectedFont}
              setSelectedFont={state.setSelectedFont}
              selectedTextColor={state.selectedTextColor}
              setSelectedTextColor={state.setSelectedTextColor}
              qrDescriptionFontSize={state.qrDescriptionFontSize}
              setQrDescriptionFontSize={state.setQrDescriptionFontSize}
              selectedBackgroundColor={state.selectedBackgroundColor}
              setSelectedBackgroundColor={state.setSelectedBackgroundColor}
              backgroundImage={state.backgroundImage}
              onFileSelect={onFileSelect}
              onRemoveImage={onRemoveImage}
              fileInputRef={state.fileInputRef}
              qrCodeGenerated={!!sessionId}
              qrCodeVisible={state.qrCodeVisible}
              qrCodeURL={state.qrCodeURL}
              finalAction={state.finalAction}
              setFinalAction={state.setFinalAction}
              finalActionImage={state.finalActionImage}
              setFinalActionImage={state.setFinalActionImage}
              finalActionLink={state.finalActionLink}
              setFinalActionLink={state.setFinalActionLink}
              finalActionCoupon={state.finalActionCoupon}
              setFinalActionCoupon={state.setFinalActionCouponCode}
              onGenerateQRCode={onGenerateQRCode}
              onQRCodeToTransmission={onQRCodeToTransmission}
            />
          </CardContent>
        </Card>
      </div>
      
      <div>
        <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 min-h-[700px]">
          <CardHeader>
            <CardTitle>
              Pré-visualização
            </CardTitle>
            <CardDescription>
              Veja como sua transmissão será exibida
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-[650px] flex items-center justify-center">
              <LivePreview 
                qrCodeVisible={state.qrCodeVisible}
                qrCodeSvg={state.qrCodeSvg}
                qrCodePosition={state.qrCodePosition}
                setQrCodePosition={state.setQrCodePosition}
                qrDescriptionPosition={state.qrDescriptionPosition}
                setQrDescriptionPosition={state.setQrDescriptionPosition}
                qrCodeDescription={state.qrCodeDescription}
                selectedFont={state.selectedFont}
                selectedTextColor={state.selectedTextColor}
                qrDescriptionFontSize={state.qrDescriptionFontSize}
                backgroundImage={state.backgroundImage}
                selectedBackgroundColor={state.selectedBackgroundColor}
                participantList={state.participantList}
                participantCount={state.participantCount}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LivePageContent;
