
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
  
  // MOBILE-CRITICAL: Force mobile stream prioritization
  const { gridCols, selectedParticipants, emptySlots } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(Math.max(participantCount, 1)));
    
    // CRITICAL: Filter for mobile participants with streams first
    const mobileParticipantsWithStreams = participantList.filter(p => {
      const hasStream = participantStreams[p.id];
      const isNonPlaceholder = !p.id.includes('placeholder');
      const isMobile = p.isMobile;
      const isActive = p.active || p.selected;
      
      console.log(`📱 MOBILE-CRITICAL-FILTER: ${p.id}:`, {
        hasStream: !!hasStream,
        isNonPlaceholder,
        isMobile,
        isActive,
        shouldShow: hasStream && isNonPlaceholder && isMobile
      });
      
      // PRIORITY: Mobile participants with streams
      return isNonPlaceholder && hasStream && isMobile;
    });
    
    // FALLBACK: Show other participants with streams
    const otherParticipants = participantList.filter(p => {
      const hasStream = participantStreams[p.id];
      const isNonPlaceholder = !p.id.includes('placeholder');
      const isNotMobile = !p.isMobile;
      const isActive = p.active || p.selected;
      
      // Show active participants with streams (non-mobile)
      return isNonPlaceholder && hasStream && isNotMobile && isActive;
    });
    
    // MOBILE-FIRST: Always prioritize mobile streams
    const allEligibleParticipants = [...mobileParticipantsWithStreams, ...otherParticipants];
    
    console.log(`🎯 MOBILE-CRITICAL-PRIORITY:`, {
      mobileCount: mobileParticipantsWithStreams.length,
      otherCount: otherParticipants.length,
      totalEligible: allEligibleParticipants.length,
      participantCount
    });
    
    const selected = allEligibleParticipants
      .sort((a, b) => {
        // ABSOLUTE PRIORITY: Mobile participants ALWAYS first
        if (a.isMobile && !b.isMobile) return -1;
        if (!a.isMobile && b.isMobile) return 1;
        
        // SECOND: Participants with actual streams
        const aHasStream = !!participantStreams[a.id];
        const bHasStream = !!participantStreams[b.id];
        if (aHasStream && !bHasStream) return -1;
        if (!aHasStream && bHasStream) return 1;
        
        // THIRD: Connection time (most recent first)
        return (b.connectedAt || b.joinedAt || 0) - (a.connectedAt || a.joinedAt || 0);
      })
      .slice(0, participantCount);
      
    const empty = Math.max(0, participantCount - selected.length);
    
    return {
      gridCols: cols,
      selectedParticipants: selected,
      emptySlots: empty
    };
  }, [participantList, participantCount, participantStreams]);

  console.log('📱 MOBILE-CRITICAL-RENDER: ParticipantPreviewGrid:', {
    totalParticipants: participantList.length,
    selectedParticipants: selectedParticipants.length,
    mobileSelected: selectedParticipants.filter(p => p.isMobile).length,
    participantCount,
    gridCols,
    emptySlots,
    streamIds: selectedParticipants.map(p => ({ id: p.id, mobile: p.isMobile, stream: !!participantStreams[p.id] }))
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
