
import { useRef, useEffect } from 'react';
import { Participant } from '@/types/live';

interface StreamPreviewProps {
  participants: Participant[];
  layout: number;
  backgroundColor: string;
  backgroundImage: string | null;
  qrCode: {
    visible: boolean;
    image: string;
    position: { x: number; y: number };
    size: number;
  };
  qrCodeText: {
    text: string;
    position: { x: number; y: number };
  };
  qrCodeFont: string;
  qrCodeColor: string;
}

const StreamPreview = ({
  participants,
  layout,
  backgroundColor,
  backgroundImage,
  qrCode,
  qrCodeText,
  qrCodeFont,
  qrCodeColor
}: StreamPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate grid layout based on number of visible participants
  const getGridTemplate = () => {
    const count = Math.min(participants.length, layout);
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    if (count <= 12) return 'grid-cols-4 grid-rows-3';
    if (count <= 16) return 'grid-cols-4 grid-rows-4';
    if (count <= 20) return 'grid-cols-5 grid-rows-4';
    return 'grid-cols-6 grid-rows-4'; // For 21-24 participants
  };
  
  const visibleParticipants = participants.slice(0, layout);
  
  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Participants grid */}
      <div className={`grid ${getGridTemplate()} gap-1 p-2 w-full h-full`}>
        {visibleParticipants.map((participant) => (
          <div 
            key={participant.id} 
            className="aspect-square relative overflow-hidden rounded bg-black/40"
          >
            {participant.stream && (
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                ref={(element) => {
                  if (element && participant.stream) {
                    element.srcObject = participant.stream;
                  }
                }}
              />
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 text-xs rounded">
              {participant.name}
            </div>
          </div>
        ))}
      </div>
      
      {/* QR Code */}
      {qrCode.visible && (
        <div 
          className="absolute"
          style={{
            left: `${qrCode.position.x}px`,
            top: `${qrCode.position.y}px`,
            width: `${qrCode.size}px`,
            height: `${qrCode.size}px`,
            cursor: 'move'
          }}
        >
          <img src={qrCode.image} alt="QR Code" className="w-full h-full" />
        </div>
      )}
      
      {/* QR Code Text */}
      {qrCode.visible && qrCodeText.text && (
        <div 
          className="absolute px-2 py-1 text-center"
          style={{
            left: `${qrCodeText.position.x}px`,
            top: `${qrCodeText.position.y}px`,
            fontFamily: qrCodeFont,
            color: qrCodeColor,
            cursor: 'move'
          }}
        >
          {qrCodeText.text}
        </div>
      )}
    </div>
  );
};

export default StreamPreview;
