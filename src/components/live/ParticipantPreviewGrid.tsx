
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
  
  // CRITICAL: ALWAYS show participants with streams - simplified logic
  const { gridCols, selectedParticipants, emptySlots } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(Math.max(participantCount, 1)));
    
    // FORCE DISPLAY: Any participant with a stream MUST be shown
    const participantsWithStreams = participantList.filter(p => {
      const hasStream = !!participantStreams[p.id];
      const isRealParticipant = !p.id.includes('placeholder') && !p.id.includes('empty');
      
      console.log(`🎯 MOBILE-CRITICAL: ${p.id}:`, {
        hasStream,
        isRealParticipant,
        isMobile: p.isMobile,
        active: p.active,
        hasVideo: p.hasVideo,
        streamId: participantStreams[p.id]?.id,
        videoTracks: participantStreams[p.id]?.getVideoTracks().length || 0,
        WILL_SHOW: hasStream && isRealParticipant
      });
      
      // CRITICAL: Show ALL participants with streams, regardless of other conditions
      return isRealParticipant && hasStream;
    });
    
    // CRITICAL: Also include mobile participants marked as active/hasVideo even without streams yet
    const mobileParticipantsWithoutStreams = participantList.filter(p => {
      const hasStream = !!participantStreams[p.id];
      const isRealParticipant = !p.id.includes('placeholder') && !p.id.includes('empty');
      const isMobileReady = p.isMobile && (p.active || p.hasVideo);
      
      return isRealParticipant && !hasStream && isMobileReady;
    });
    
    // Combine and prioritize
    const allEligibleParticipants = [...participantsWithStreams, ...mobileParticipantsWithoutStreams];
    
    const selected = allEligibleParticipants
      .sort((a, b) => {
        // PRIORITY 1: Participants with actual streams (HIGHEST)
        const aHasStream = !!participantStreams[a.id];
        const bHasStream = !!participantStreams[b.id];
        if (aHasStream && !bHasStream) return -1;
        if (!aHasStream && bHasStream) return 1;
        
        // PRIORITY 2: Mobile participants (mobile cameras get priority)
        if (a.isMobile && !b.isMobile) return -1;
        if (!a.isMobile && b.isMobile) return 1;
        
        // PRIORITY 3: Active participants
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        
        // PRIORITY 4: Connection time (newest first for mobile)
        return (b.connectedAt || b.joinedAt || 0) - (a.connectedAt || a.joinedAt || 0);
      })
      .slice(0, participantCount);
      
    const empty = Math.max(0, participantCount - selected.length);
    
    console.log(`🎯 MOBILE-FINAL: Selected ${selected.length} participants:`, 
      selected.map(p => ({ 
        id: p.id.substring(0, 8), 
        isMobile: p.isMobile, 
        hasStream: !!participantStreams[p.id],
        active: p.active 
      }))
    );
    
    return {
      gridCols: cols,
      selectedParticipants: selected,
      emptySlots: empty
    };
  }, [participantList, participantCount, participantStreams]);

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
