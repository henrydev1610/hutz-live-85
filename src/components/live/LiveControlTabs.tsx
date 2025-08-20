
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MonitorPlay, Palette, QrCode } from "lucide-react";
import { Participant } from './ParticipantGrid';
import ParticipantGrid from './ParticipantGrid';
import LivePreview from './LivePreview';
import AppearanceSettings from './AppearanceSettings';
import TextSettings from './TextSettings';
import QrCodeSettings from './QrCodeSettings';

interface LiveControlTabsProps {
  participantList: Participant[];
  onSelectParticipant: (id: string) => void;
  onRemoveParticipant: (id: string) => void;
  participantStreams: {[id: string]: MediaStream};
  sessionId: string;
  participantCount: number;
  setParticipantCount: React.Dispatch<React.SetStateAction<number>>;
  qrCodeDescription: string;
  setQrCodeDescription: React.Dispatch<React.SetStateAction<string>>;
  selectedFont: string;
  setSelectedFont: React.Dispatch<React.SetStateAction<string>>;
  selectedTextColor: string;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<string>>;
  qrDescriptionFontSize: number;
  setQrDescriptionFontSize: React.Dispatch<React.SetStateAction<number>>;
  qrCodePosition: { x: number; y: number; width: number; height: number };
  setQrCodePosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  selectedBackgroundColor: string;
  setSelectedBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  backgroundImage: string | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  qrCodeGenerated: boolean;
  qrCodeVisible: boolean;
  qrCodeURL: string;
  finalAction: 'none' | 'image' | 'coupon';
  setFinalAction: React.Dispatch<React.SetStateAction<'none' | 'image' | 'coupon'>>;
  finalActionImage: string | null;
  setFinalActionImage: React.Dispatch<React.SetStateAction<string | null>>;
  finalActionLink: string;
  setFinalActionLink: React.Dispatch<React.SetStateAction<string>>;
  finalActionCoupon: string;
  setFinalActionCoupon: React.Dispatch<React.SetStateAction<string>>;
  onGenerateQRCode: () => void;
  onQRCodeToTransmission: () => void;
}

const LiveControlTabs: React.FC<LiveControlTabsProps> = ({
  participantList,
  onSelectParticipant,
  onRemoveParticipant,
  participantStreams,
  sessionId,
  participantCount,
  setParticipantCount,
  qrCodeDescription,
  setQrCodeDescription,
  selectedFont,
  setSelectedFont,
  selectedTextColor,
  setSelectedTextColor,
  qrDescriptionFontSize,
  setQrDescriptionFontSize,
  qrCodePosition,
  setQrCodePosition,
  selectedBackgroundColor,
  setSelectedBackgroundColor,
  backgroundImage,
  onFileSelect,
  onRemoveImage,
  fileInputRef,
  qrCodeGenerated,
  qrCodeVisible,
  qrCodeURL,
  finalAction,
  setFinalAction,
  finalActionImage,
  setFinalActionImage,
  finalActionLink,
  setFinalActionLink,
  finalActionCoupon,
  setFinalActionCoupon,
  onGenerateQRCode,
  onQRCodeToTransmission
}) => {
  return (
    <Tabs defaultValue="participants" className="w-full">
      <TabsList className="grid grid-cols-4 mb-6">
        <TabsTrigger value="participants">
          <Users className="h-4 w-4 mr-2" />
          Participantes
        </TabsTrigger>
        <TabsTrigger value="layout">
          <MonitorPlay className="h-4 w-4 mr-2" />
          Layout
        </TabsTrigger>
        <TabsTrigger value="appearance">
          <Palette className="h-4 w-4 mr-2" />
          Aparência
        </TabsTrigger>
        <TabsTrigger value="qrcode">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="participants">
        <ParticipantGrid 
          participants={participantList}
          onSelectParticipant={onSelectParticipant}
          onRemoveParticipant={onRemoveParticipant}
          participantStreams={participantStreams}
          sessionId={sessionId}
        />
      </TabsContent>
      
      <TabsContent value="layout">
        <TextSettings 
          participantCount={participantCount}
          setParticipantCount={setParticipantCount}
          qrCodeDescription={qrCodeDescription}
          setQrCodeDescription={setQrCodeDescription}
          selectedFont={selectedFont}
          setSelectedFont={setSelectedFont}
          selectedTextColor={selectedTextColor}
          setSelectedTextColor={setSelectedTextColor}
          qrDescriptionFontSize={qrDescriptionFontSize}
          setQrDescriptionFontSize={setQrDescriptionFontSize}
        />
      </TabsContent>
      
      <TabsContent value="appearance">
        <AppearanceSettings 
          selectedBackgroundColor={selectedBackgroundColor}
          setSelectedBackgroundColor={setSelectedBackgroundColor}
          backgroundImage={backgroundImage}
          onFileSelect={onFileSelect}
          onRemoveImage={onRemoveImage}
          fileInputRef={fileInputRef}
        />
      </TabsContent>
      
      <TabsContent value="qrcode">
        <QrCodeSettings 
          qrCodeGenerated={qrCodeGenerated}
          qrCodeVisible={qrCodeVisible}
          qrCodeURL={qrCodeURL}
          qrCodePosition={qrCodePosition}
          setQrCodePosition={setQrCodePosition}
          finalAction={finalAction}
          setFinalAction={setFinalAction}
          finalActionImage={finalActionImage}
          setFinalActionImage={setFinalActionImage}
          finalActionLink={finalActionLink}
          setFinalActionLink={setFinalActionLink}
          finalActionCoupon={finalActionCoupon}
          setFinalActionCoupon={setFinalActionCoupon}
          onGenerateQRCode={onGenerateQRCode}
          onQRCodeToTransmission={onQRCodeToTransmission}
        />
      </TabsContent>
    </Tabs>
  );
};

export default LiveControlTabs;
