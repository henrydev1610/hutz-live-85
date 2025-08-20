
import React, { useState, useEffect } from 'react';
import DraggableWrapper from '@/components/common/DraggableWrapper';
import { Move } from 'lucide-react';

interface QRCodeOverlayProps {
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
}

const QRCodeOverlay: React.FC<QRCodeOverlayProps> = ({
  qrCodeVisible,
  qrCodeSvg,
  qrCodePosition,
  setQrCodePosition,
  qrDescriptionPosition,
  setQrDescriptionPosition,
  qrCodeDescription,
  selectedFont,
  selectedTextColor,
  qrDescriptionFontSize
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

  if (!qrCodeVisible && qrCodeSvg) {
    console.log('🎨 QR WARNING: QR Code não visível mas SVG existe!', { qrCodeVisible, qrCodeSvg: !!qrCodeSvg });
  }

  // MODO DEBUG: Sempre mostrar se tiver SVG
  if (!qrCodeSvg) {
    console.log('🎨 QR DEBUG: Nenhum SVG disponível', { qrCodeSvg });
    return null;
  }

  return (
    <>
      {/* QR Code preview with draggable and resizable functionality */}
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
        className={`bg-white p-1 rounded-lg z-50 ${isDraggingQrCode || isResizingQrCode ? 'ring-2 ring-primary' : ''}`}
        style={{ 
          width: `${qrCodePosition.width}px`, 
          height: `${qrCodePosition.height}px`,
          zIndex: 50,
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
      
      {/* QR Description with draggable and resizable functionality */}
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
        className={`flex items-center justify-center overflow-hidden z-50 ${isDraggingText || isResizingText ? 'ring-2 ring-primary' : ''}`}
        style={{ 
          width: `${qrDescriptionPosition.width}px`, 
          height: `${qrDescriptionPosition.height}px`,
          color: selectedTextColor,
          fontFamily: selectedFont,
          fontSize: `${qrDescriptionFontSize}px`,
          zIndex: 50,
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
    </>
  );
};

export default QRCodeOverlay;
