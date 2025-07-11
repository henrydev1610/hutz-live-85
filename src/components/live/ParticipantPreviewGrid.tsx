
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
    
    console.log('🎭 CRITICAL: [GRID_FILTER] Processing participants:', {
      totalParticipants: participantList.length,
      participantCount,
      allParticipants: participantList.map(p => ({
        id: p.id,
        name: p.name,
        active: p.active,
        selected: p.selected,
        hasVideo: p.hasVideo,
        hasStream: !!participantStreams[p.id],
        streamId: participantStreams[p.id]?.id
      }))
    });
    
    // CRITICAL: Enhanced filter to prioritize participants with active streams
    const selected = participantList
      .filter(p => {
        const isPlaceholder = p.id.includes('placeholder');
        const hasStream = !!participantStreams[p.id];
        const isActiveOrSelected = p.active || p.selected || p.hasVideo;
        const isConnectedParticipant = p.id.includes('participant-') || p.id.includes('mobile-');
        
        // CRITICAL: Include if not placeholder AND has valid stream OR is legitimate participant
        const shouldInclude = !isPlaceholder && (hasStream || isActiveOrSelected || isConnectedParticipant);
        
        console.log(`🔍 [GRID_FILTER] Participant ${p.id}:`, {
          isPlaceholder,
          hasStream,
          isActiveOrSelected,
          isConnectedParticipant,
          shouldInclude,
          streamTracks: hasStream ? participantStreams[p.id].getTracks().length : 0,
          streamActive: hasStream ? participantStreams[p.id].active : false
        });
        
        return shouldInclude;
      })
      .sort((a, b) => {
        // Prioritize participants with streams first, then active, then by connection time
        const aHasStream = !!participantStreams[a.id];
        const bHasStream = !!participantStreams[b.id];
        
        if (aHasStream && !bHasStream) return -1;
        if (!aHasStream && bHasStream) return 1;
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return (a.connectedAt || a.joinedAt) - (b.connectedAt || b.joinedAt);
      })
      .slice(0, participantCount);
    
    const empty = Math.max(0, participantCount - selected.length);
    
    console.log('✅ CRITICAL: [GRID_FILTER] Final selection:', {
      selectedCount: selected.length,
      selectedIds: selected.map(p => p.id),
      emptySlots: empty
    });
    
    return {
      gridCols: cols,
      selectedParticipants: selected,
      emptySlots: empty
    };
  }, [participantList, participantCount, participantStreams]);

  console.log('🎭 CRITICAL: [PREVIEW_GRID] Rendering with:', {
    totalParticipants: participantList.length,
    selectedParticipants: selectedParticipants.length,
    participantCount,
    gridCols,
    emptySlots,
    availableStreams: Object.keys(participantStreams).length,
    selectedWithStreams: selectedParticipants.filter(p => participantStreams[p.id]).length
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
