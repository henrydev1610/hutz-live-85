
import React from 'react';
import { Participant } from './ParticipantGrid';
import SimplifiedParticipantGrid from './SimplifiedParticipantGrid';

interface ParticipantPreviewGridProps {
  participantList: Participant[];
  participantCount: number;
  participantStreams: {[id: string]: MediaStream};
  sessionId?: string;
}

const ParticipantPreviewGrid: React.FC<ParticipantPreviewGridProps> = ({
  participantList,
  participantCount,
  participantStreams,
  sessionId = 'default'
}) => {
  console.log('🎭 PREVIEW GRID: Using simplified grid system', {
    participantCount,
    sessionId,
    streams: Object.keys(participantStreams).length
  });

  return (
    <SimplifiedParticipantGrid
      participantList={participantList}
      participantCount={participantCount}
      participantStreams={participantStreams}
      sessionId={sessionId}
    />
  );
};

export default ParticipantPreviewGrid;
