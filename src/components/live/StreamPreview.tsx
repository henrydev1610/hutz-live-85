
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
  const [resizing, setResizing] = useState(false);

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

  useEffect(() => {
    const handleResizeMouseUp = () => {
      if (resizing) {
        setResizing(false);
      }
    };

    document.addEventListener('mouseup', handleResizeMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [resizing]);
  
  const handleQRCodeResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = qrCodeSize;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizing) return;
      
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const diagonal = Math.max(deltaX, deltaY);
      
      setQrCodeSize(Math.max(50, Math.min(400, startSize + diagonal)));
    };
    
    const handleMouseUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTextResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    
    const startY = e.clientY;
    const startSize = textSize;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizing) return;
      
      const deltaY = moveEvent.clientY - startY;
      setTextSize(Math.max(12, Math.min(48, startSize - deltaY * 0.1)));
    };
    
    const handleMouseUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden flex"
      style={{
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Left side - QR Code and text - 1/3 of screen */}
      <div className="w-1/3 p-4 relative">
        {/* QR Code */}
        {qrCode.visible && (
          <Draggable bounds="parent" cancel=".resize-handle">
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
                className="absolute right-0 bottom-0 w-6 h-6 bg-white/10 hover:bg-white/30 rounded-bl resize-handle cursor-se-resize"
                onMouseDown={handleQRCodeResize}
              />
            </div>
          </Draggable>
        )}
        
        {/* QR Code Text */}
        {qrCode.visible && qrCodeText.text && (
          <Draggable bounds="parent" cancel=".resize-handle">
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
                className="absolute right-0 bottom-0 w-5 h-5 bg-white/10 hover:bg-white/30 rounded-bl resize-handle cursor-ns-resize"
                onMouseDown={handleTextResize}
              />
            </div>
          </Draggable>
        )}
      </div>

      {/* Right side - Participants grid - 2/3 of screen */}
      <div className="w-2/3 p-4">
        <div className={`grid ${getGridTemplate()} gap-3 h-full`}>
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
    </div>
  );
};

export default StreamPreview;
