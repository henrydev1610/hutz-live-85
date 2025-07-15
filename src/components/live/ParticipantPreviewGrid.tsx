
import React, { useMemo } from 'react';
import { Participant } from './ParticipantGrid';
import ParticipantVideoContainer from './ParticipantVideoContainer';
import { useUniqueKeyGenerator } from '@/hooks/live/useUniqueKeyGenerator';
import { useStreamDebugger } from '@/hooks/live/useStreamDebugger';

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
  const debugInfo = useStreamDebugger(participantList, participantStreams);
  
  // Simplified calculation prioritizing streams and mobile participants
  const { gridCols, selectedParticipants, emptySlots } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(Math.max(participantCount, 1)));
    
    // CRITICAL: Prioritize participants with streams (especially mobile)
    const participantsWithStreams = participantList.filter(p => {
      const hasStream = participantStreams[p.id];
      const isNonPlaceholder = !p.id.includes('placeholder');
      const hasVideoOrActive = p.hasVideo || p.active || p.selected;
      
      console.log(`🔍 MOBILE-FILTER: ${p.id}:`, {
        hasStream: !!hasStream,
        isNonPlaceholder,
        hasVideoOrActive,
        isMobile: p.isMobile,
        shouldShow: hasStream && isNonPlaceholder
      });
      
      // Show if has stream OR is marked as having video/active
      return isNonPlaceholder && (hasStream || hasVideoOrActive);
    });
    
    const selected = participantsWithStreams
      .sort((a, b) => {
        // PRIORITY 1: Participants with actual streams
        const aHasStream = !!participantStreams[a.id];
        const bHasStream = !!participantStreams[b.id];
        if (aHasStream && !bHasStream) return -1;
        if (!aHasStream && bHasStream) return 1;
        
        // PRIORITY 2: Mobile participants
        if (a.isMobile && !b.isMobile) return -1;
        if (!a.isMobile && b.isMobile) return 1;
        
        // PRIORITY 3: Active participants
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        
        // PRIORITY 4: Connection time
        return (a.connectedAt || a.joinedAt || 0) - (b.connectedAt || b.joinedAt || 0);
      })
      .slice(0, participantCount);
      
    const empty = Math.max(0, participantCount - selected.length);
    
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
    <div className="relative w-full h-full">
      {/* DEBUG PANEL - Always visible for troubleshooting */}
      <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded z-50 max-w-xs">
        <div className="font-bold text-green-400 mb-1">🔍 LIVE DEBUG</div>
        <div>Total: {debugInfo.totalParticipants} | Active: {debugInfo.activeParticipants}</div>
        <div>Streams: {debugInfo.streamsCount} | Mobile: {debugInfo.mobileParticipants}</div>
        <div>With Video: {debugInfo.participantsWithStreams}</div>
        <div className="text-gray-400 text-xs mt-1">{debugInfo.timestamp}</div>
      </div>
      
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
    </div>
  );
};

export default ParticipantPreviewGrid;
