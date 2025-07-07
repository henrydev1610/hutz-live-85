
import React, { useMemo } from 'react';
import { Participant } from './ParticipantGrid';
import ParticipantVideoContainer from './ParticipantVideoContainer';
import { useUniqueKeyGenerator } from '@/hooks/live/useUniqueKeyGenerator';

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
  const { generateUniqueKey } = useUniqueKeyGenerator();
  
  // Memoizar cálculos para evitar re-renderizações desnecessárias
  const { gridCols, selectedParticipants, emptySlots } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(Math.max(participantCount, 1)));
    const selected = participantList
      .filter(p => (p.selected || p.hasVideo || p.active) && !p.id.includes('placeholder'))
      .sort((a, b) => {
        // Prioritize active participants first, then by connection time
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return (a.connectedAt || a.joinedAt) - (b.connectedAt || b.joinedAt);
      })
      .slice(0, participantCount);
    const empty = Math.max(0, participantCount - selected.length);
    
    return {
      gridCols: cols,
      selectedParticipants: selected,
      emptySlots: empty
    };
  }, [participantList, participantCount]);

  console.log('🎭 FIXED: ParticipantPreviewGrid render:', {
    totalParticipants: participantList.length,
    selectedParticipants: selectedParticipants.length,
    participantCount,
    gridCols,
    emptySlots
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
      {/* Participantes reais com chaves únicas */}
      {selectedParticipants.map((participant, index) => (
        <ParticipantVideoContainer
          key={generateUniqueKey(participant.id, 'participant')}
          participant={participant}
          index={index}
          stream={participantStreams[participant.id] || null}
        />
      ))}
      
      {/* Slots vazios com chaves únicas baseadas no índice */}
      {Array.from({ length: emptySlots }).map((_, index) => {
        const emptyKey = generateUniqueKey(`empty-${selectedParticipants.length + index}`, 'empty');
        return (
          <div 
            key={emptyKey}
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
        );
      })}
    </div>
  );
};

export default ParticipantPreviewGrid;
