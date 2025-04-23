
import { useEffect, useRef } from "react";
import { useParticipantStore } from "@/stores/participantStore";
import { useSettingsStore } from "@/stores/settingsStore";
import QrCodeDisplay from "./QrCodeDisplay";

interface BroadcastViewProps {
  sessionId: string;
}

const BroadcastView = ({ sessionId }: BroadcastViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { participants, selectedParticipants } = useParticipantStore();
  const { 
    layoutMaxParticipants, 
    backgroundColor, 
    backgroundImageUrl, 
    qrCode 
  } = useSettingsStore();

  useEffect(() => {
    document.title = "Transmissão ao Vivo";
    
    // Listen for window close
    const handleBeforeUnload = () => {
      console.log("Broadcast window closing");
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Calculate grid layout based on selected participants
  const getGridTemplate = () => {
    const count = selectedParticipants.length;
    
    if (count <= 0) return "grid-cols-1";
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-3 grid-rows-2";
    if (count <= 9) return "grid-cols-3 grid-rows-3";
    if (count <= 12) return "grid-cols-4 grid-rows-3";
    return "grid-cols-4 grid-rows-4";
  };

  const backgroundStyle = backgroundImageUrl 
    ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor };

  return (
    <div 
      ref={containerRef}
      className="h-screen w-screen overflow-hidden"
      style={backgroundStyle}
    >
      <div className={`grid ${getGridTemplate()} gap-1 h-full w-full p-1`}>
        {selectedParticipants.slice(0, layoutMaxParticipants).map(id => {
          const participant = participants[id];
          if (!participant) return null;
          
          return (
            <div 
              key={id} 
              className="bg-black/20 rounded overflow-hidden flex items-center justify-center"
            >
              <video 
                autoPlay 
                playsInline 
                muted
                className="max-h-full max-w-full object-contain"
                id={`broadcast-video-${id}`}
              />
            </div>
          );
        })}
      </div>
      
      {qrCode.isVisible && (
        <QrCodeDisplay isPreview={false} />
      )}
    </div>
  );
};

export default BroadcastView;
