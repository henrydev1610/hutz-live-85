
import React from 'react';
import { Participant } from './ParticipantGrid';
import SimpleVideoQuadrant from './SimpleVideoQuadrant';

interface SimplifiedParticipantGridProps {
  participantList: Participant[];
  participantCount: number;
  participantStreams: {[id: string]: MediaStream};
  sessionId: string;
}

const SimplifiedParticipantGrid: React.FC<SimplifiedParticipantGridProps> = ({
  participantList,
  participantCount,
  participantStreams,
  sessionId
}) => {
  // Get real participants and filter selected ones
  const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-'));
  const selectedParticipants = realParticipants.filter(p => p.selected);
  
  // Create placeholders if needed
  const placeholders = Array.from({ length: Math.max(0, participantCount - selectedParticipants.length) }, (_, i) => ({
    id: `placeholder-${i}`,
    name: `P${selectedParticipants.length + i + 1}`,
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

  console.log('🎭 SIMPLIFIED GRID: Rendering participants', {
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
          <SimpleVideoQuadrant
            key={participant.id}
            participant={participant}
            index={index}
            sessionId={sessionId}
            webrtcStream={participantStreams[participant.id] || null}
          />
        ))}
      </div>
    </div>
  );
};

export default SimplifiedParticipantGrid;
