
import React, { useRef, useEffect } from 'react';
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
  
  const visibleParticipants = participants.filter(p => p.isVisible !== false);
  
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
      <div className="absolute inset-0 grid grid-cols-4 gap-2 p-4">
        {visibleParticipants.map((participant) => (
          <div 
            key={participant.id} 
            className="aspect-video relative overflow-hidden rounded bg-black/40"
          >
            {participant.stream ? (
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
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="bg-secondary/60 rounded-full p-6">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 bg-black/50 px-2 py-1 text-xs rounded flex justify-between items-center">
              <span>{participant.name}</span>
              <span className={`h-2 w-2 rounded-full ${participant.stream ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            </div>
          </div>
        ))}
      </div>

      {qrCode.visible && (
        <Draggable bounds="parent">
          <div 
            className="absolute cursor-move"
            style={{
              left: qrCode.position.x,
              top: qrCode.position.y,
              width: `${qrCode.size}px`,
              height: `${qrCode.size}px`
            }}
          >
            <img src={qrCode.image} alt="QR Code" className="w-full h-full" />
          </div>
        </Draggable>
      )}
      
      {qrCode.visible && qrCodeText.text && (
        <Draggable bounds="parent">
          <div 
            className="absolute px-2 py-1 cursor-move"
            style={{
              left: qrCodeText.position.x,
              top: qrCodeText.position.y,
              fontFamily: qrCodeFont,
              color: qrCodeColor,
            }}
          >
            {qrCodeText.text}
          </div>
        </Draggable>
      )}
    </div>
  );
};

export default StreamPreview;
