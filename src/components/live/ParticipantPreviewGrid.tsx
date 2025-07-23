
import React from 'react';
import { Participant } from './ParticipantGrid';
import UnifiedVideoContainer from './UnifiedVideoContainer';

interface ParticipantPreviewGridProps {
  participantList: Participant[];
  participantCount: number;
  participantStreams: {[id: string]: MediaStream};
}

const ParticipantPreviewGrid: React.FC<ParticipantPreviewGridProps> = ({
  participantList,
  participantCount,
  participantStreams
}) => {
  // Filter out placeholder participants and get real participants
  const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-'));
  const selectedParticipants = realParticipants.filter(p => p.selected);
  
  // Create placeholder participants to match participantCount if needed
  const placeholders = Array.from({ length: Math.max(0, participantCount - realParticipants.length) }, (_, i) => ({
    id: `placeholder-${i}`,
    name: `P${realParticipants.length + i + 1}`,
    joinedAt: Date.now(),
    lastActive: Date.now(),
    active: false,
    selected: false,
    hasVideo: false,
    isMobile: false
  }));

  const allParticipants = [...selectedParticipants, ...placeholders].slice(0, participantCount);

  // Grid layout based on participant count
  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  console.log('🎭 PREVIEW GRID: Rendering participants', {
    realParticipants: realParticipants.length,
    selectedParticipants: selectedParticipants.length,
    placeholders: placeholders.length,
    totalShown: allParticipants.length,
    streams: Object.keys(participantStreams).length
  });

  return (
    <div className="absolute inset-0 p-4">
      <div className={`grid ${getGridClass(participantCount)} gap-2 h-full`}>
        {allParticipants.map((participant, index) => (
          <UnifiedVideoContainer
            key={participant.id}
            participant={participant}
            index={index}
            stream={participantStreams[participant.id] || null}
          />
        ))}
      </div>
    </div>
  );
};

export default ParticipantPreviewGrid;
