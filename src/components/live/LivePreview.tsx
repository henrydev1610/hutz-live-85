import React, { useState, useEffect, useRef } from 'react';
import { Participant } from './ParticipantGrid';
import DraggableWrapper from '@/components/common/DraggableWrapper';
import { Move } from 'lucide-react';

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
  const [isResizingQrCode, setIsResizingQrCode] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });

  // QR Code resize handlers
  const handleQrResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingQrCode(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setInitialSize({ width: qrCodePosition.width, height: qrCodePosition.height });
  };
  
  // Text resize handlers
  const handleTextResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingText(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setInitialSize({ width: qrDescriptionPosition.width, height: qrDescriptionPosition.height });
  };
  
  // Global resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingQrCode) {
        const dx = e.clientX - resizeStartPos.x;
        const dy = e.clientY - resizeStartPos.y;
        
        // Calculate new size (maintain aspect ratio for QR)
        const newWidth = Math.max(80, initialSize.width + dx);
        const newHeight = Math.max(80, initialSize.width + dx); // Keep square for QR
        
        setQrCodePosition(prev => ({
          ...prev,
          width: newWidth,
          height: newHeight
        }));
      } else if (isResizingText) {
        const dx = e.clientX - resizeStartPos.x;
        const dy = e.clientY - resizeStartPos.y;
        
        // Calculate new size
        const newWidth = Math.max(100, initialSize.width + dx);
        const newHeight = Math.max(40, initialSize.height + dy);
        
        setQrDescriptionPosition(prev => ({
          ...prev,
          width: newWidth,
          height: newHeight
        }));
      }
    };
    
    const handleMouseUp = () => {
      setIsResizingQrCode(false);
      setIsResizingText(false);
    };
    
    if (isResizingQrCode || isResizingText) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingQrCode, isResizingText, resizeStartPos, initialSize, qrCodePosition.width, setQrCodePosition, setQrDescriptionPosition]);

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
      
      {/* Participant grid preview with improved video containers */}
      <div 
        className="participant-grid absolute right-[5%] top-[5%] bottom-[5%] left-[30%]"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(participantCount))}, 1fr)`,
          gap: '8px'
        }}
      >
        {participantList.filter(p => p.selected).slice(0, participantCount).map((participant, index) => (
          <div 
            key={participant.id} 
            className="participant-video bg-gray-800/60 rounded-md overflow-hidden relative"
            id={`preview-participant-video-${participant.id}`}
            data-participant-id={participant.id}
            style={{ minHeight: '120px', minWidth: '160px' }}
          >
            {/* Video will be inserted here automatically by useVideoElementManagement */}
            {!participant.hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center text-white/50">
                  <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="text-xs">{participant.name}</p>
                </div>
              </div>
            )}
            
            {/* Participant info overlay */}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {participant.name || `P${index + 1}`}
            </div>
            
            {/* Video indicator */}
            {participant.hasVideo && (
              <div className="absolute top-2 right-2 bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
            )}
          </div>
        ))}
      </div>
      
      {/* QR Code preview with draggable and resizable functionality */}
      {qrCodeVisible && (
        <DraggableWrapper
          bounds="parent"
          onStart={() => setIsDraggingQrCode(true)}
          onStop={(e, data) => {
            setIsDraggingQrCode(false);
            setQrCodePosition(prev => ({
              ...prev,
              x: data.x,
              y: data.y
            }));
          }}
          position={{ x: qrCodePosition.x, y: qrCodePosition.y }}
          disabled={isResizingQrCode}
          className={`bg-white p-1 rounded-lg ${isDraggingQrCode || isResizingQrCode ? 'ring-2 ring-primary' : ''}`}
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
          
          {/* Resize handle */}
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-primary/80 rounded-tl-md flex items-center justify-center"
            onMouseDown={handleQrResizeStart}
          >
            <Move className="h-3 w-3 text-white" />
          </div>
        </DraggableWrapper>
      )}
      
      {/* QR Description with draggable and resizable functionality */}
      {qrCodeVisible && (
        <DraggableWrapper
          bounds="parent"
          onStart={() => setIsDraggingText(true)}
          onStop={(e, data) => {
            setIsDraggingText(false);
            setQrDescriptionPosition(prev => ({
              ...prev,
              x: data.x,
              y: data.y
            }));
          }}
          position={{ x: qrDescriptionPosition.x, y: qrDescriptionPosition.y }}
          disabled={isResizingText}
          className={`flex items-center justify-center overflow-hidden ${isDraggingText || isResizingText ? 'ring-2 ring-primary' : ''}`}
          style={{ 
            width: `${qrDescriptionPosition.width}px`, 
            height: `${qrDescriptionPosition.height}px`,
            color: selectedTextColor,
            fontFamily: selectedFont,
            fontSize: `${qrDescriptionFontSize}px`,
          }}
        >
          {qrCodeDescription}
          
          {/* Resize handle */}
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-primary/80 rounded-tl-md flex items-center justify-center"
            onMouseDown={handleTextResizeStart}
          >
            <Move className="h-3 w-3 text-white" />
          </div>
        </DraggableWrapper>
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
