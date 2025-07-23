import React, { useEffect, useRef } from 'react';
import { LocalVideoTrack, RemoteVideoTrack } from 'twilio-video';

interface TwilioVideoContainerProps {
  track: LocalVideoTrack | RemoteVideoTrack | null;
  participantName: string;
  isLocal?: boolean;
  className?: string;
}

export function TwilioVideoContainer({ 
  track, 
  participantName, 
  isLocal = false, 
  className = "" 
}: TwilioVideoContainerProps) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!track || !videoRef.current) return;

    // Anexar o track do Twilio ao elemento
    const videoElement = track.attach();
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.style.borderRadius = '8px';
    
    // Limpar container e adicionar vídeo
    videoRef.current.innerHTML = '';
    videoRef.current.appendChild(videoElement);

    // Cleanup ao desmontar
    return () => {
      if (videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement);
      }
    };
  }, [track]);

  return (
    <div className={`relative bg-muted rounded-lg overflow-hidden ${className}`}>
      <div ref={videoRef} className="w-full h-full" />
      
      {/* Nome do participante */}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {participantName} {isLocal && '(Você)'}
      </div>
      
      {/* Indicador quando não há vídeo */}
      {!track && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl text-primary">
                {participantName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{participantName}</p>
            <p className="text-xs text-muted-foreground">Sem vídeo</p>
          </div>
        </div>
      )}
    </div>
  );
}