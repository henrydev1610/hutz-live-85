import React, { useEffect } from 'react';

interface StreamForcerProps {
  participantStreams: {[id: string]: MediaStream};
  updateTransmissionParticipants: () => void;
}

/**
 * CRITICAL: Forces stream updates to transmission window
 * This component ensures mobile camera streams are immediately transmitted
 */
const StreamForcer: React.FC<StreamForcerProps> = ({
  participantStreams,
  updateTransmissionParticipants
}) => {
  
  useEffect(() => {
    const streamIds = Object.keys(participantStreams);
    
    if (streamIds.length > 0) {
      console.log('🚀 STREAM FORCER: Detected new streams, forcing transmission update');
      console.log('📊 STREAM FORCER: Current streams:', streamIds.map(id => ({
        participantId: id,
        streamId: participantStreams[id].id,
        active: participantStreams[id].active,
        videoTracks: participantStreams[id].getVideoTracks().length
      })));
      
      // Force immediate transmission update
      setTimeout(() => {
        updateTransmissionParticipants();
      }, 100);
      
      // Force again after 1 second to ensure it took
      setTimeout(() => {
        updateTransmissionParticipants();
      }, 1000);
    }
  }, [participantStreams, updateTransmissionParticipants]);

  return null; // This is a logical component
};

export default StreamForcer;