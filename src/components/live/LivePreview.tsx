
import { useRef, useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { AspectRatio } from "@/components/ui/aspect-ratio";

export interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  lastActive: number;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  isAdmin?: boolean;
}

interface QRCodeSettings {
  show: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: 'small' | 'medium' | 'large';
}

interface TextSettings {
  show: boolean;
  position: 'top' | 'bottom';
  text: string;
  color?: string;
  fontSize?: 'small' | 'medium' | 'large';
}

interface LivePreviewProps {
  sessionId: string;
  qrCodeSettings: QRCodeSettings;
  qrCodeDataUrl: string;
  textSettings: TextSettings;
  onQRPositionChange: (position: QRCodeSettings['position']) => void;
  onTextPositionChange: (position: TextSettings['position']) => void;
  backgroundImage?: string;
  selectedBackgroundColor: string;
  participantList: Participant[];
  participantCount: number;
  participantStreams?: {[id: string]: MediaStream};
}

const LivePreview = ({
  sessionId,
  qrCodeSettings,
  qrCodeDataUrl,
  textSettings,
  onQRPositionChange,
  onTextPositionChange,
  backgroundImage,
  selectedBackgroundColor,
  participantList,
  participantCount,
  participantStreams = {}
}: LivePreviewProps) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{[id: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[id: string]: HTMLVideoElement | null}>({});
  
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Calculate QR code position
  const getQRPosition = () => {
    switch (qrCodeSettings.position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  // Calculate QR code size
  const getQRSize = () => {
    switch (qrCodeSettings.size) {
      case 'small':
        return 'w-16 h-16';
      case 'medium':
        return 'w-24 h-24';
      case 'large':
        return 'w-32 h-32';
      default:
        return 'w-24 h-24';
    }
  };

  // Calculate text position
  const getTextPosition = () => {
    switch (textSettings.position) {
      case 'top':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      default:
        return 'bottom-4 left-1/2 -translate-x-1/2';
    }
  };

  // Calculate text size
  const getTextSize = () => {
    switch (textSettings.fontSize) {
      case 'small':
        return 'text-sm';
      case 'medium':
        return 'text-lg';
      case 'large':
        return 'text-2xl';
      default:
        return 'text-lg';
    }
  };

  // Handle QR code drag start
  const handleQRDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingQR(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  // Handle text drag start
  const handleTextDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingText(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingQR) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      // Determine new position based on drag direction
      if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
        setDragStartX(e.clientX);
        setDragStartY(e.clientY);
        
        const currentPos = qrCodeSettings.position;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal drag
          if (currentPos === 'top-left' && deltaX > 0) {
            onQRPositionChange('top-right');
          } else if (currentPos === 'top-right' && deltaX < 0) {
            onQRPositionChange('top-left');
          } else if (currentPos === 'bottom-left' && deltaX > 0) {
            onQRPositionChange('bottom-right');
          } else if (currentPos === 'bottom-right' && deltaX < 0) {
            onQRPositionChange('bottom-left');
          }
        } else {
          // Vertical drag
          if (currentPos === 'top-left' && deltaY > 0) {
            onQRPositionChange('bottom-left');
          } else if (currentPos === 'top-right' && deltaY > 0) {
            onQRPositionChange('bottom-right');
          } else if (currentPos === 'bottom-left' && deltaY < 0) {
            onQRPositionChange('top-left');
          } else if (currentPos === 'bottom-right' && deltaY < 0) {
            onQRPositionChange('top-right');
          }
        }
      }
    } else if (isDraggingText) {
      const deltaY = e.clientY - dragStartY;
      
      // Change position when drag distance is significant
      if (Math.abs(deltaY) > 30) {
        setDragStartY(e.clientY);
        
        const currentPos = textSettings.position;
        if (currentPos === 'top' && deltaY > 0) {
          onTextPositionChange('bottom');
        } else if (currentPos === 'bottom' && deltaY < 0) {
          onTextPositionChange('top');
        }
      }
    }
  };

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    setIsDraggingQR(false);
    setIsDraggingText(false);
  };

  // Function to add or update video element in container
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream) => {
    const participantId = container.id.replace('preview-participant-video-', '');
    let videoElement = videoElements.current[participantId];
    
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = 'w-full h-full object-cover';
      
      videoElements.current[participantId] = videoElement;
      
      // Clear container before adding
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      container.appendChild(videoElement);
      
      // Add event listeners for video
      videoElement.onloadedmetadata = () => {
        videoElement?.play().catch(err => console.error('Error playing video:', err));
      };
    }
    
    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(err => console.error('Error playing video:', err));
    }
  };

  // Effect to update video elements when streams change
  useEffect(() => {
    if (!participantStreams) return;
    
    // Get selected participants
    const selectedParticipants = participantList.filter(p => p.selected);
    
    selectedParticipants.forEach((participant) => {
      if (participantStreams[participant.id] && videoRefs.current[participant.id]) {
        const container = videoRefs.current[participant.id];
        if (container) {
          updateVideoElement(container, participantStreams[participant.id]);
        }
      }
    });
    
    // Log if we have participant streams but no matching containers
    Object.keys(participantStreams).forEach(id => {
      if (!videoRefs.current[id]) {
        console.log(`Have stream for ${id} but no container reference`);
      }
    });
  }, [participantStreams, participantList]);

  // Calculate grid columns and rows based on participant count
  const calculateGrid = () => {
    const selectedParticipants = participantList.filter(p => p.selected);
    const count = selectedParticipants.length;
    
    if (count === 0) return { cols: 1, rows: 1 };
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: 4 }; // Maximum grid
  };

  const { cols, rows } = calculateGrid();
  const selectedParticipants = participantList.filter(p => p.selected);

  // Double click to toggle debug mode
  const handleDoubleClick = () => {
    setShowDebug(!showDebug);
  };

  return (
    <div 
      ref={previewContainerRef}
      className="relative w-full border border-border rounded-lg overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <AspectRatio ratio={16 / 9}>
        <div 
          className="absolute inset-0 flex items-center justify-center" 
          style={{
            backgroundColor: selectedBackgroundColor || '#000000',
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Participant Grid */}
          <div 
            className="w-full h-full p-2"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: '4px'
            }}
          >
            {selectedParticipants.length > 0 ? (
              selectedParticipants.map((participant, index) => (
                <div 
                  key={participant.id}
                  className="relative w-full h-full bg-black/50 rounded overflow-hidden"
                >
                  {/* Video container */}
                  <div className="absolute inset-0">
                    {/* Actual video will be inserted here */}
                    <div 
                      id={`preview-participant-video-${participant.id}`} 
                      className="absolute inset-0 w-full h-full overflow-hidden"
                      ref={el => {
                        videoRefs.current[participant.id] = el;
                        // If we already have a stream for this participant, update the video element
                        if (el && participantStreams && participantStreams[participant.id]) {
                          updateVideoElement(el, participantStreams[participant.id]);
                        }
                      }}
                    >
                      {/* Video will be inserted here dynamically */}
                    </div>
                    
                    {/* Placeholder if no video */}
                    {(!participant.hasVideo && !participantStreams[participant.id]) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <User className="w-12 h-12 text-white/40" />
                      </div>
                    )}
                    
                    {/* Debug overlay */}
                    {showDebug && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs p-1 rounded">
                        ID: {participant.id.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                  
                  {/* Name label */}
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50">
                    <p className="text-white text-xs text-center truncate">
                      {participant.name || 'Participante'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full row-span-full flex items-center justify-center">
                <div className="text-white/70 text-center">
                  <User className="w-16 h-16 mx-auto mb-2 opacity-30" />
                  <p>Nenhum participante selecionado</p>
                </div>
              </div>
            )}
          </div>
          
          {/* QR Code */}
          {qrCodeSettings.show && (
            <div
              ref={qrCodeRef}
              className={`absolute cursor-move ${getQRPosition()} ${getQRSize()} bg-white p-1 rounded-lg shadow-lg`}
              onMouseDown={handleQRDragStart}
            >
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code"
                className="w-full h-full"
              />
            </div>
          )}
          
          {/* Text Overlay */}
          {textSettings.show && textSettings.text && (
            <div
              ref={textRef}
              className={`absolute cursor-move ${getTextPosition()} bg-black/60 px-4 py-2 rounded-full`}
              onMouseDown={handleTextDragStart}
            >
              <p 
                className={`${getTextSize()} font-bold text-center`}
                style={{ color: textSettings.color || 'white' }}
              >
                {textSettings.text}
              </p>
            </div>
          )}
        </div>
      </AspectRatio>
    </div>
  );
};

export default LivePreview;
