
import React from 'react';
import { Participant } from './ParticipantGrid';
import ParticipantPreviewGrid from './ParticipantPreviewGrid';
import QRCodeOverlay from './QRCodeOverlay';
import LiveIndicator from './LiveIndicator';

interface LivePreviewProps {
  qrCodeVisible: boolean;
  qrCodeSvg: string | null;
  qrCodePosition: { x: number; y: number; width: number; height: number };
  setQrCodePosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  qrDescriptionPosition: { x: number; y: number; width: number; height: number };
  setQrDescriptionPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  qrCodeDescription: string;
  selectedFont: string;
  selectedTextColor: string;
  qrDescriptionFontSize: number;
  backgroundImage: string | null;
  selectedBackgroundColor: string;
  participantList: Participant[];
  participantCount: number;
  participantStreams: {[id: string]: MediaStream};
  onStreamReceived: (participantId: string, stream: MediaStream) => void;
}

const LivePreview: React.FC<LivePreviewProps> = ({
  qrCodeVisible,
  qrCodeSvg,
  qrCodePosition,
  setQrCodePosition,
  qrDescriptionPosition,
  setQrDescriptionPosition,
  qrCodeDescription,
  selectedFont,
  selectedTextColor,
  qrDescriptionFontSize,
  backgroundImage,
  selectedBackgroundColor,
  participantList,
  participantCount,
  participantStreams,
  onStreamReceived
}) => {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden live-preview">
      {/* Container with background color or image */}
      <div className="absolute inset-0" style={{ backgroundColor: selectedBackgroundColor }}>
        {backgroundImage && (
          <img 
            src={backgroundImage} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* Participant grid preview */}
      <ParticipantPreviewGrid 
        participantList={participantList}
        participantCount={participantCount}
        participantStreams={participantStreams}
        onStreamReceived={onStreamReceived}
      />
      
      {/* QR Code and description overlays */}
      <QRCodeOverlay
        qrCodeVisible={qrCodeVisible}
        qrCodeSvg={qrCodeSvg}
        qrCodePosition={qrCodePosition}
        setQrCodePosition={setQrCodePosition}
        qrDescriptionPosition={qrDescriptionPosition}
        setQrDescriptionPosition={setQrDescriptionPosition}
        qrCodeDescription={qrCodeDescription}
        selectedFont={selectedFont}
        selectedTextColor={selectedTextColor}
        qrDescriptionFontSize={qrDescriptionFontSize}
      />
      
      {/* Live indicator */}
      <LiveIndicator />
    </div>
  );
};

export default LivePreview;
