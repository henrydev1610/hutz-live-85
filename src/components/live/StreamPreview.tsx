
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
  const videoRefs = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Track stream attachment status with more detailed states
  const [streamStatus, setStreamStatus] = useState<{[key: string]: 'loading' | 'playing' | 'error' | 'notAvailable'}>({});
  
  // Enhanced debug output for monitoring participants and their streams
  useEffect(() => {
    console.log('[StreamPreview] Received participants:', participants.map(p => ({
      id: p.id,
      name: p.name,
      hasStream: !!p.stream,
      streamId: p.stream?.id,
      isVisible: p.isVisible,
      videoTracks: p.stream?.getVideoTracks().length || 0,
      audioTracks: p.stream?.getAudioTracks().length || 0
    })));
  }, [participants]);

  // Improved stream attachment logic with retries and better error handling
  useEffect(() => {
    console.log('[StreamPreview] Attempting to attach streams...');
    
    participants.forEach(participant => {
      if (!participant.stream) {
        console.log(`[StreamPreview] No stream for participant ${participant.id}`);
        setStreamStatus(prev => ({ ...prev, [participant.id]: 'notAvailable' }));
        return;
      }
      
      const videoElement = videoRefs.current[participant.id];
      
      if (!videoElement) {
        console.log(`[StreamPreview] No video element for ${participant.id}, will try again on next render`);
        return;
      }
      
      // Only set stream if it's different from current or not already playing
      if (videoElement.srcObject !== participant.stream || 
          videoElement.paused || 
          streamStatus[participant.id] === 'error') {
          
        console.log(`[StreamPreview] Attaching stream ${participant.stream.id} for ${participant.id}`);
        setStreamStatus(prev => ({ ...prev, [participant.id]: 'loading' }));
        
        try {
          // Detach any existing stream first
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
          
          // Attach the new stream
          videoElement.srcObject = participant.stream;
          
          // Set up event handlers
          videoElement.onloadedmetadata = () => {
            console.log(`[StreamPreview] Stream loaded for ${participant.id}`);
            
            // Try to play the video
            const playPromise = videoElement.play();
            if (playPromise) {
              playPromise
                .then(() => {
                  console.log(`[StreamPreview] Stream playing for ${participant.id}`);
                  setStreamStatus(prev => ({ ...prev, [participant.id]: 'playing' }));
                })
                .catch(err => {
                  console.error(`[StreamPreview] Error playing video for ${participant.id}:`, err);
                  setStreamStatus(prev => ({ ...prev, [participant.id]: 'error' }));
                  
                  // Try again after a short delay
                  setTimeout(() => {
                    if (videoElement && participant.stream) {
                      console.log(`[StreamPreview] Retrying playback for ${participant.id}`);
                      videoElement.play().catch(e => 
                        console.error(`[StreamPreview] Retry failed for ${participant.id}:`, e)
                      );
                    }
                  }, 1000);
                });
            }
          };
          
          videoElement.onplay = () => {
            console.log(`[StreamPreview] Stream playing for ${participant.id}`);
            setStreamStatus(prev => ({ ...prev, [participant.id]: 'playing' }));
          };
          
          videoElement.onerror = (e) => {
            console.error(`[StreamPreview] Video error for ${participant.id}:`, e);
            setStreamStatus(prev => ({ ...prev, [participant.id]: 'error' }));
          };
        } catch (err) {
          console.error(`[StreamPreview] Error attaching stream for ${participant.id}:`, err);
          setStreamStatus(prev => ({ ...prev, [participant.id]: 'error' }));
        }
      }
    });
  }, [participants, streamStatus]);

  // Determine grid layout based on number of visible participants
  const getGridClass = () => {
    const visibleCount = participants.filter(p => p.isVisible !== false).length;
    
    if (visibleCount <= 1) return "grid-cols-1";
    if (visibleCount <= 2) return "grid-cols-2";
    if (visibleCount <= 4) return "grid-cols-2";
    if (visibleCount <= 9) return "grid-cols-3";
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
      {participants.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/50 text-center px-4">
            Nenhum participante visível.
            <br />
            Adicione participantes para iniciar a transmissão.
          </p>
        </div>
      ) : (
        <div className={`absolute inset-0 grid ${getGridClass()} gap-2 p-4`}>
          {participants.filter(p => p.isVisible !== false).map((participant) => (
            <div 
              key={participant.id} 
              className="aspect-video relative overflow-hidden rounded bg-black/40"
            >
              {participant.stream ? (
                <video
                  id={`video-${participant.id}`}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  ref={(element) => {
                    if (element) {
                      videoRefs.current[participant.id] = element;
                      
                      // If we have a stream but no srcObject yet, set it immediately
                      if (participant.stream && element.srcObject !== participant.stream) {
                        console.log(`[StreamPreview] Setting stream ${participant.stream.id} on mount for ${participant.id}`);
                        try {
                          element.srcObject = participant.stream;
                        } catch (err) {
                          console.error(`[StreamPreview] Error setting stream on ref for ${participant.id}:`, err);
                        }
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
                <div className="flex items-center gap-2">
                  {/* Enhanced status indicator with different states */}
                  <span 
                    className={`h-2 w-2 rounded-full ${
                      streamStatus[participant.id] === 'playing' 
                        ? 'bg-green-500' 
                        : streamStatus[participant.id] === 'loading' 
                          ? 'bg-yellow-500 animate-pulse' 
                          : streamStatus[participant.id] === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                    }`}
                    title={streamStatus[participant.id] || 'unknown'}
                  ></span>
                </div>
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
