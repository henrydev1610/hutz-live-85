
import { useRef, useEffect, useState } from 'react';
import { Participant } from '@/types/live';
import Draggable from 'react-draggable';

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
  const [qrCodeSize, setQrCodeSize] = useState(qrCode.size);
  const [textSize, setTextSize] = useState(16); // Default text size

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
    return 'grid-cols-4 grid-rows-5'; // For 17-20 participants
  };
  
  const visibleParticipants = participants.slice(0, layout);
  
  const handleQRCodeResize = (e: React.MouseEvent, direction: string) => {
    if (e.buttons !== 1) return; // Only resize on left click drag
    const delta = direction === 'x' ? e.movementX : e.movementY;
    setQrCodeSize(prev => Math.max(50, Math.min(400, prev + delta)));
  };

  const handleTextResize = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const delta = e.movementY;
    setTextSize(prev => Math.max(12, Math.min(48, prev - delta * 0.5)));
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden grid grid-cols-3 gap-4 p-4"
      style={{
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Left side - empty or content */}
      <div className="col-span-1">
        {/* QR Code */}
        {qrCode.visible && (
          <Draggable bounds="parent">
            <div 
              className="absolute cursor-move"
              style={{
                left: qrCode.position.x,
                top: qrCode.position.y,
                width: `${qrCodeSize}px`,
                height: `${qrCodeSize}px`,
              }}
            >
              <img src={qrCode.image} alt="QR Code" className="w-full h-full" />
              <div 
                className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
                onMouseMove={(e) => handleQRCodeResize(e, 'x')}
              />
            </div>
          </Draggable>
        )}
        
        {/* QR Code Text */}
        {qrCode.visible && qrCodeText.text && (
          <Draggable bounds="parent">
            <div 
              className="absolute px-2 py-1 cursor-move"
              style={{
                left: qrCodeText.position.x,
                top: qrCodeText.position.y,
                fontFamily: qrCodeFont,
                color: qrCodeColor,
                fontSize: `${textSize}px`,
              }}
            >
              {qrCodeText.text}
              <div 
                className="absolute right-0 bottom-0 w-4 h-4 cursor-ns-resize"
                onMouseMove={handleTextResize}
              />
            </div>
          </Draggable>
        )}
      </div>

      {/* Right side - Participants grid */}
      <div className={`col-span-2 grid ${getGridTemplate()} gap-2`}>
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
    </div>
  );
};

export default StreamPreview;
