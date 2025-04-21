import { useRef, useState } from 'react';
import { User } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

interface QrCodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LivePreviewProps {
  qrCodeVisible: boolean;
  qrCodeSvg: string | null;
  qrCodePosition: QrCodePosition;
  setQrCodePosition: (position: QrCodePosition) => void;
  qrDescriptionPosition: QrCodePosition;
  setQrDescriptionPosition: (position: QrCodePosition) => void;
  qrCodeDescription: string;
  selectedFont: string;
  selectedTextColor: string;
  qrDescriptionFontSize: number;
  backgroundImage: string | null;
  selectedBackgroundColor: string;
  participantList: Participant[];
  participantCount: number;
}

const LivePreview = ({
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
}: LivePreviewProps) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [resizeHandleQR, setResizeHandleQR] = useState<string | null>(null);
  const [resizeHandleText, setResizeHandleText] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  
  const startDraggingQR = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!qrCodeVisible) return;
    
    const target = e.target as HTMLElement;
    if (target.className && typeof target.className === 'string' && target.className.includes('resize-handle')) {
      const handle = target.getAttribute('data-handle');
      setResizeHandleQR(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ 
        width: qrCodePosition.width, 
        height: qrCodePosition.height 
      });
    } else {
      setIsDraggingQR(true);
      setStartPos({ 
        x: e.clientX - qrCodePosition.x, 
        y: e.clientY - qrCodePosition.y 
      });
    }
  };

  const startDraggingText = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!qrCodeVisible) return;
    
    const target = e.target as HTMLElement;
    if (target.className && typeof target.className === 'string' && target.className.includes('resize-handle')) {
      const handle = target.getAttribute('data-handle');
      setResizeHandleText(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ 
        width: qrDescriptionPosition.width, 
        height: qrDescriptionPosition.height 
      });
    } else {
      setIsDraggingText(true);
      setStartPos({ 
        x: e.clientX - qrDescriptionPosition.x, 
        y: e.clientY - qrDescriptionPosition.y 
      });
    }
  };

  const stopDragging = () => {
    setIsDraggingQR(false);
    setIsDraggingText(false);
    setResizeHandleQR(null);
    setResizeHandleText(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingQR) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      
      const container = previewContainerRef.current?.getBoundingClientRect();
      
      if (container) {
        const x = Math.max(0, Math.min(newX, container.width - qrCodePosition.width));
        const y = Math.max(0, Math.min(newY, container.height - qrCodePosition.height));
        
        setQrCodePosition({ ...qrCodePosition, x, y });
      }
    } else if (isDraggingText) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      
      const container = previewContainerRef.current?.getBoundingClientRect();
      
      if (container) {
        const x = Math.max(0, Math.min(newX, container.width - qrDescriptionPosition.width));
        const y = Math.max(0, Math.min(newY, container.height - qrDescriptionPosition.height));
        
        setQrDescriptionPosition({ ...qrDescriptionPosition, x, y });
      }
    } else if (resizeHandleQR) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      
      let newWidth = startSize.width;
      let newHeight = startSize.height;
      
      if (resizeHandleQR.includes('r')) { 
        newWidth = Math.max(20, startSize.width + dx);
      }
      if (resizeHandleQR.includes('b')) { 
        newHeight = Math.max(20, startSize.height + dy);
      }
      
      const size = Math.max(newWidth, newHeight);
      
      setQrCodePosition({ 
        ...qrCodePosition, 
        width: size,
        height: size
      });
    } else if (resizeHandleText) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      
      let newWidth = startSize.width;
      let newHeight = startSize.height;
      
      if (resizeHandleText.includes('r')) { 
        newWidth = Math.max(30, startSize.width + dx);
      }
      if (resizeHandleText.includes('b')) { 
        newHeight = Math.max(15, startSize.height + dy);
      }
      
      setQrDescriptionPosition({ 
        ...qrDescriptionPosition, 
        width: newWidth,
        height: newHeight
      });
    }
  };

  const gridCols = Math.ceil(Math.sqrt(participantCount));

  return (
    <div 
      className="aspect-video relative bg-black rounded-lg overflow-hidden" 
      onMouseMove={handleMouseMove} 
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      ref={previewContainerRef}
      style={{ height: '600px' }}
    >
      <div 
        className="absolute inset-0" 
        style={{
          backgroundColor: backgroundImage ? 'transparent' : selectedBackgroundColor,
        }}
      >
        {backgroundImage && (
          <img 
            src={backgroundImage} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      <div className="absolute top-[5%] right-[5%] bottom-[5%] left-[30%]">
        <div 
          className="grid gap-2 h-full"
          style={{ 
            gridTemplateColumns: `repeat(${gridCols}, 1fr)` 
          }}
        >
          {participantList
            .filter(p => p.selected)
            .slice(0, participantCount)
            .map((participant) => (
              <div key={participant.id} className="bg-black/40 rounded overflow-hidden flex items-center justify-center">
                <User className="h-8 w-8 text-white/30" />
              </div>
            ))}
          
          {Array(Math.max(0, participantCount - participantList.filter(p => p.selected).length)).fill(0).map((_, i) => (
            <div key={`empty-preview-${i}`} className="bg-black/20 rounded overflow-hidden flex items-center justify-center">
              <User className="h-8 w-8 text-white/30" />
            </div>
          ))}
        </div>
      </div>
      
      {qrCodeVisible && (
        <>
          <div 
            className="absolute cursor-move"
            style={{
              left: `${qrCodePosition.x}px`,
              top: `${qrCodePosition.y}px`,
              width: `${qrCodePosition.width}px`,
            }}
            onMouseDown={startDraggingQR}
            ref={qrCodeRef}
          >
            <div 
              className="w-full bg-white p-1 rounded-lg"
              style={{
                height: `${qrCodePosition.height}px`,
              }}
            >
              <div className="w-full h-full bg-white flex items-center justify-center overflow-hidden">
                {qrCodeSvg ? (
                  <img src={qrCodeSvg} alt="QR Code" className="w-full h-full" />
                ) : (
                  <div className="w-8 h-8 bg-black/20 rounded" />
                )}
              </div>
              
              <div className="absolute right-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-ne-resize resize-handle" data-handle="tr"></div>
              <div className="absolute right-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-se-resize resize-handle" data-handle="br"></div>
              <div className="absolute left-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-sw-resize resize-handle" data-handle="bl"></div>
              <div className="absolute left-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-nw-resize resize-handle" data-handle="tl"></div>
            </div>
          </div>
          
          <div 
            className="absolute cursor-move"
            style={{
              left: `${qrDescriptionPosition.x}px`,
              top: `${qrDescriptionPosition.y}px`,
              width: `${qrDescriptionPosition.width}px`,
              height: `${qrDescriptionPosition.height}px`,
              color: selectedTextColor,
              fontFamily: selectedFont,
              fontSize: `${qrDescriptionFontSize}px`,
              fontWeight: 'bold',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(255,255,255,0.3)',
              borderRadius: '4px',
              padding: '4px',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
            onMouseDown={startDraggingText}
            ref={textRef}
          >
            {qrCodeDescription}
            
            <div className="absolute right-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-ne-resize resize-handle" data-handle="tr"></div>
            <div className="absolute right-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-se-resize resize-handle" data-handle="br"></div>
            <div className="absolute left-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-sw-resize resize-handle" data-handle="bl"></div>
            <div className="absolute left-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-nw-resize resize-handle" data-handle="tl"></div>
          </div>
        </>
      )}
    </div>
  );
};

export default LivePreview;
