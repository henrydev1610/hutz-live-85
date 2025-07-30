
import React, { useEffect, useState } from 'react';
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
  // FASE 3: CONTAINER PRE-CREATION - Estado para slots P1-P4
  const [slots, setSlots] = useState<Participant[]>([]);
  
  // FASE 3: Pré-criar slots P1-P4 na inicialização
  useEffect(() => {
    console.log('🏗️ FASE 3: PRE-CREATION - Inicializando slots P1-P4');
    
    const preCreatedSlots = Array.from({ length: participantCount }, (_, i) => ({
      id: `slot-p${i + 1}`,
      name: `P${i + 1}`,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: false,
      selected: false,
      hasVideo: false,
      isMobile: false
    }));
    
    setSlots(preCreatedSlots);
  }, [participantCount]);
  
  // FASE 2: Listener para eventos de stream para atualização direta
  useEffect(() => {
    const handleStreamConnected = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🌉 FASE 2: GRID BRIDGE - Stream conectado no grid:', participantId);
      
      // Forçar re-render do grid quando stream conecta
      setSlots(currentSlots => [...currentSlots]);
    };
    
    window.addEventListener('participant-stream-connected', handleStreamConnected as EventListener);
    
    return () => {
      window.removeEventListener('participant-stream-connected', handleStreamConnected as EventListener);
    };
  }, []);
  
  // Combinar participantes reais com slots pré-criados
  const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-') && !p.id.startsWith('slot-'));
  const selectedParticipants = realParticipants.filter(p => p.selected);
  
  // FASE 1: Sistema de slots - P1 sempre recebe o primeiro participante
  const finalSlots = slots.map((slot, index) => {
    if (index < selectedParticipants.length) {
      // Substituir slot por participante real
      return selectedParticipants[index];
    }
    return slot; // Manter slot vazio
  });

  const allParticipants = finalSlots.slice(0, participantCount);

  // Grid layout based on participant count
  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  console.log('🎭 FASE 3: PREVIEW GRID - Rendering participants', {
    realParticipants: realParticipants.length,
    selectedParticipants: selectedParticipants.length,
    slots: slots.length,
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
