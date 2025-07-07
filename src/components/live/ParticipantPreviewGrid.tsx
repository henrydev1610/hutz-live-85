
import React from 'react';
import { Participant } from './ParticipantGrid';
import ParticipantVideoContainer from './ParticipantVideoContainer';

interface ParticipantPreviewGridProps {
  participantList: Participant[];
  participantCount: number;
}

const ParticipantPreviewGrid: React.FC<ParticipantPreviewGridProps> = ({
  participantList,
  participantCount
}) => {
  // Calculate the grid layout based on participant count
  const gridCols = Math.ceil(Math.sqrt(Math.max(participantCount, 1)));
  const selectedParticipants = participantList.filter(p => p.selected || p.hasVideo).slice(0, participantCount);

  console.log('🎭 ParticipantPreviewGrid render:', {
    totalParticipants: participantList.length,
    selectedParticipants: selectedParticipants.length,
    participantCount,
    gridCols
  });

  return (
    <div 
      className="participant-grid absolute right-[5%] top-[5%] bottom-[5%] left-[30%]"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: '8px'
      }}
    >
      {selectedParticipants.map((participant, index) => (
        <ParticipantVideoContainer
          key={participant.id}
          participant={participant}
          index={index}
        />
      ))}
      
      {/* Fill remaining slots with empty containers if needed */}
      {Array.from({ length: Math.max(0, participantCount - selectedParticipants.length) }).map((_, index) => (
        <div 
          key={`empty-${index}`}
          className="participant-video aspect-video bg-gray-800/30 rounded-md overflow-hidden relative border-2 border-dashed border-gray-600"
          style={{ minHeight: '120px', minWidth: '160px' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/40">
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-xs">Aguardando</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ParticipantPreviewGrid;
