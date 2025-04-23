
import React, { useRef, useEffect, useState } from 'react';
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
  const [visibleParticipants, setVisibleParticipants] = useState<Participant[]>([]);
  const videoRefs = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Filter visible participants whenever the participants array changes
  useEffect(() => {
    // Filter out participants that are explicitly marked as not visible
    const visible = participants.filter(p => p.isVisible !== false);
    setVisibleParticipants(visible);
    
    console.log('[StreamPreview] All participants:', participants);
    console.log('[StreamPreview] Visible participants:', visible);
    
    // Debug output to help identify why participants aren't showing
    if (participants.length > 0 && visible.length === 0) {
      console.error('[StreamPreview] Warning: There are participants but none are visible!');
      participants.forEach(p => {
        console.log(`Participant ${p.id} (${p.name}) visibility status: ${p.isVisible !== false ? 'Should be visible' : 'Hidden'}`);
        console.log(`Participant ${p.id} has stream:`, !!p.stream);
      });
    }
  }, [participants]);
  
  // Attach streams to video elements when they change
  useEffect(() => {
    console.log('[StreamPreview] Attaching streams to video elements. Participants count:', visibleParticipants.length);
    
    visibleParticipants.forEach(participant => {
      const videoElement = videoRefs.current[participant.id];
      if (videoElement && participant.stream && videoElement.srcObject !== participant.stream) {
        console.log(`[StreamPreview] Setting stream for ${participant.id}:`, participant.stream);
        videoElement.srcObject = participant.stream;
        
        // Force play if needed
        videoElement.play().catch(err => {
          console.error(`[StreamPreview] Error playing video for ${participant.id}:`, err);
        });
      } else if (!participant.stream) {
        console.log(`[StreamPreview] No stream available for ${participant.id}`);
      } else if (!videoElement) {
        console.log(`[StreamPreview] No video element reference for ${participant.id}`);
      }
    });
  }, [visibleParticipants]);
  
  // Determine grid layout based on number of participants
  const getGridClass = () => {
    const count = visibleParticipants.length;
    
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };
  
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
      {visibleParticipants.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/50 text-center px-4">
            Nenhum participante visível.
            <br />
            Adicione participantes para iniciar a transmissão.
          </p>
        </div>
      ) : (
        <div className={`absolute inset-0 grid ${getGridClass()} gap-2 p-4`}>
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
                    if (element) {
                      videoRefs.current[participant.id] = element;
                      if (participant.stream && element.srcObject !== participant.stream) {
                        element.srcObject = participant.stream;
                        console.log(`[StreamPreview] Setting stream for ${participant.id} in grid:`, participant.stream);
                      }
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
      )}

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
