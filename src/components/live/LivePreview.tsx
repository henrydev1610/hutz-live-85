
import { User } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
}

interface LivePreviewProps {
  participants: Participant[];
  participantCount: number;
  selectedBackgroundColor: string;
  backgroundImage: string | null;
  qrCodeSvg: string | null;
  qrCodeVisible: boolean;
  qrCodePosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  qrCodeDescription: string;
  qrDescriptionPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  qrDescriptionFontSize: number;
  selectedFont: string;
  selectedTextColor: string;
  participantStreams?: {[id: string]: MediaStream};
}

const LivePreview = ({
  participants,
  participantCount,
  selectedBackgroundColor,
  backgroundImage,
  qrCodeSvg,
  qrCodeVisible,
  qrCodePosition,
  qrCodeDescription,
  qrDescriptionPosition,
  qrDescriptionFontSize,
  selectedFont,
  selectedTextColor,
  participantStreams = {}
}: LivePreviewProps) => {
  const gridColumns = Math.ceil(Math.sqrt(participantCount));
  
  return (
    <div className="relative rounded-lg overflow-hidden aspect-video border border-white/10 bg-black">
      <div className="absolute inset-0" style={{ backgroundColor: selectedBackgroundColor }}>
        {backgroundImage && (
          <img src={backgroundImage} alt="Background" className="w-full h-full object-cover" />
        )}
      </div>
      
      <div 
        className="absolute"
        style={{
          top: '5%',
          right: '5%',
          bottom: '5%',
          left: '25%',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: '8px'
        }}
      >
        {Array.from({ length: participantCount }).map((_, i) => {
          const participant = participants[i];
          
          return (
            <div 
              key={i} 
              className="bg-black/40 rounded flex items-center justify-center overflow-hidden relative"
            >
              {participant ? (
                <div
                  id={`preview-participant-video-${participant.id}`}
                  className="absolute inset-0 overflow-hidden"
                >
                  {/* Video element will be inserted here dynamically */}
                  {!participantStreams[participant.id] && (
                    <div className="flex items-center justify-center h-full">
                      <User className="h-8 w-8 text-white/30" />
                    </div>
                  )}
                </div>
              ) : (
                <User className="h-8 w-8 text-white/30" />
              )}
            </div>
          );
        })}
      </div>
      
      {qrCodeVisible && qrCodeSvg && (
        <div 
          className="absolute bg-white p-1 rounded-lg"
          style={{
            left: `${qrCodePosition.x}px`,
            top: `${qrCodePosition.y}px`,
            width: `${qrCodePosition.width}px`,
            height: `${qrCodePosition.height}px`,
          }}
        >
          <img src={qrCodeSvg} alt="QR Code" className="w-full h-full" />
        </div>
      )}
      
      {qrCodeVisible && (
        <div 
          className="absolute flex items-center justify-center text-center"
          style={{
            left: `${qrDescriptionPosition.x}px`,
            top: `${qrDescriptionPosition.y}px`,
            width: `${qrDescriptionPosition.width}px`,
            height: `${qrDescriptionPosition.height}px`,
            color: selectedTextColor,
            fontSize: `${qrDescriptionFontSize}px`,
            fontFamily: selectedFont
          }}
        >
          {qrCodeDescription}
        </div>
      )}
      
      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></div>
        AO VIVO
      </div>
    </div>
  );
};

export default LivePreview;
