
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
  
  // Detectar se estamos na janela de transmissão
  const isTransmissionWindow = window.name === 'transmission-window' || window.location.pathname.includes('transmission');
  
  // FASE 3: Pré-criar slots P1-P4 na inicialização
  useEffect(() => {
    const context = isTransmissionWindow ? 'TRANSMISSION' : 'HOST';
    console.log(`🏗️ FASE 3: PRE-CREATION [${context}] - Inicializando slots P1-P${participantCount}`);
    
    const preCreatedSlots = Array.from({ length: participantCount }, (_, i) => ({
      id: isTransmissionWindow ? `transmission-slot-p${i + 1}` : `slot-p${i + 1}`,
      name: `P${i + 1}`,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: false,
      selected: false,
      hasVideo: false,
      isMobile: false
    }));
    
    setSlots(preCreatedSlots);
    console.log(`🏗️ ${context}: Criados ${preCreatedSlots.length} slots`);
  }, [participantCount, isTransmissionWindow]);
  
  // PONTE WEBRTC→REACT: Múltiplos listeners para garantir bridge
  useEffect(() => {
    const context = isTransmissionWindow ? 'TRANSMISSION' : 'HOST';
    console.log(`🌉 PONTE WEBRTC→REACT [${context}]: Configurando listeners no grid`);
    
    const handleStreamConnected = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log(`🌉 PONTE BRIDGE [${context}]: Stream WebRTC recebido no grid:`, participantId, stream?.id);
      
      // Forçar re-render completo do grid
      setSlots(currentSlots => {
        console.log(`🔄 PONTE BRIDGE [${context}]: Forçando re-render do grid para stream:`, participantId);
        return [...currentSlots];
      });
    };
    
    const handleForceUpdate = (event: CustomEvent) => {
      const { participantId, streamId } = event.detail;
      console.log(`🔄 PONTE FORCE [${context}]: Forçando atualização para:`, participantId, streamId);
      
      // Re-render forçado mais agressivo
      setSlots(currentSlots => {
        const updated = currentSlots.map(slot => ({ ...slot }));
        console.log(`🔄 PONTE FORCE [${context}]: Grid atualizado forçadamente`);
        return updated;
      });
    };
    
    // Múltiplos event listeners para diferentes pontes
    window.addEventListener('participant-stream-connected', handleStreamConnected as EventListener);
    window.addEventListener('force-stream-state-update', handleForceUpdate as EventListener);
    window.addEventListener('stream-received', handleStreamConnected as EventListener);
    
    return () => {
      window.removeEventListener('participant-stream-connected', handleStreamConnected as EventListener);
      window.removeEventListener('force-stream-state-update', handleForceUpdate as EventListener);
      window.removeEventListener('stream-received', handleStreamConnected as EventListener);
    };
  }, [isTransmissionWindow]);
  
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

  const getGridRows = (count: number) => {
    if (count <= 1) return 'grid-rows-1';
    if (count <= 2) return 'grid-rows-1';
    if (count <= 4) return 'grid-rows-2';
    if (count <= 6) return 'grid-rows-2';
    if (count <= 9) return 'grid-rows-3';
    return 'grid-rows-4';
  };

  const context = isTransmissionWindow ? 'TRANSMISSION' : 'HOST';
  console.log(`🎭 FASE 3: PREVIEW GRID [${context}] - Rendering participants`, {
    realParticipants: realParticipants.length,
    selectedParticipants: selectedParticipants.length,
    slots: slots.length,
    totalShown: allParticipants.length,
    streams: Object.keys(participantStreams).length
  });

  return (
    <div className="absolute inset-0 p-8">
      <div className={`grid ${getGridClass(participantCount)} ${getGridRows(participantCount)} gap-6 h-full w-full`}>
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
