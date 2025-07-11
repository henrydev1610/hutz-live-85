import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface MobileCameraConnectorProps {
  participantStreams: {[id: string]: MediaStream};
  onStreamUpdate: (participantId: string, stream: MediaStream) => void;
}

const MobileCameraConnector: React.FC<MobileCameraConnectorProps> = ({
  participantStreams,
  onStreamUpdate
}) => {
  const connectionRef = useRef<boolean>(false);

  useEffect(() => {
    console.log('📱 MOBILE CONNECTOR: Monitoring streams:', Object.keys(participantStreams));
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      if (stream && stream.active) {
        console.log(`📱 CRITICAL: Processing mobile stream from ${participantId}:`, {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active
        });
        
        // CRITICAL: Ensure stream is properly processed
        onStreamUpdate(participantId, stream);
        
        if (!connectionRef.current) {
          connectionRef.current = true;
          toast.success(`📱 Câmera móvel conectada! Participante: ${participantId.slice(-4)}`);
        }
      }
    });
  }, [participantStreams, onStreamUpdate]);

  return null; // This is a logical component, no UI
};

export default MobileCameraConnector;