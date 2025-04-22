
import React, { useState, useEffect } from 'react';
import { Participant } from './ParticipantGrid';
import Draggable from 'react-draggable';

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
  participantCount
}) => {
  const [isDraggingQrCode, setIsDraggingQrCode] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  
  // Helper function to update position based on drag event
  const updatePosition = (position: { x: number; y: number; width: number; height: number }, 
                          newPosition: { x: number; y: number }) => {
    return {
      ...position,
      x: newPosition.x,
      y: newPosition.y
    };
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
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
      <div 
        className="absolute right-[5%] top-[5%] bottom-[5%] left-[30%]"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(participantCount))}, 1fr)`,
          gap: '8px'
        }}
      >
        {participantList.filter(p => p.selected).slice(0, participantCount).map((participant, index) => (
          <div 
            key={participant.id} 
            className="bg-gray-800/60 rounded-md overflow-hidden relative"
            id={`preview-participant-video-${participant.id}`}
          >
            {!participant.hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* QR Code preview with draggable functionality */}
      {qrCodeVisible && (
        <Draggable
          bounds="parent"
          onStart={() => setIsDraggingQrCode(true)}
          onStop={(e, data) => {
            setIsDraggingQrCode(false);
            setQrCodePosition(prev => updatePosition(prev, { x: data.x, y: data.y }));
          }}
          position={{ x: qrCodePosition.x, y: qrCodePosition.y }}
        >
          <div 
            className={`absolute bg-white p-1 rounded-lg cursor-move ${isDraggingQrCode ? 'ring-2 ring-primary' : ''}`}
            style={{ 
              width: `${qrCodePosition.width}px`, 
              height: `${qrCodePosition.height}px`,
            }}
          >
            {qrCodeSvg ? (
              <img 
                src={qrCodeSvg} 
                alt="QR Code" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                QR Code
              </div>
            )}
          </div>
        </Draggable>
      )}
      
      {/* QR Description with draggable functionality */}
      {qrCodeVisible && (
        <Draggable
          bounds="parent"
          onStart={() => setIsDraggingText(true)}
          onStop={(e, data) => {
            setIsDraggingText(false);
            setQrDescriptionPosition(prev => updatePosition(prev, { x: data.x, y: data.y }));
          }}
          position={{ x: qrDescriptionPosition.x, y: qrDescriptionPosition.y }}
        >
          <div 
            className={`absolute cursor-move flex items-center justify-center overflow-hidden ${isDraggingText ? 'ring-2 ring-primary' : ''}`}
            style={{ 
              width: `${qrDescriptionPosition.width}px`, 
              height: `${qrDescriptionPosition.height}px`,
              color: selectedTextColor,
              fontFamily: selectedFont,
              fontSize: `${qrDescriptionFontSize}px`,
            }}
          >
            {qrCodeDescription}
          </div>
        </Draggable>
      )}
      
      {/* Live indicator */}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
        AO VIVO
      </div>
    </div>
  );
};

export default LivePreview;
