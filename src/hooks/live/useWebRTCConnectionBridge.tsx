import { useEffect } from 'react';

interface UseWebRTCConnectionBridgeProps {
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * FASE 3: Hook para corrigir Bridge Host→React
 * Garante que eventos ontrack do WebRTC cheguem até o React
 */
export const useWebRTCConnectionBridge = ({
  participantStreams,
  setParticipantStreams,
  setParticipantList
}: UseWebRTCConnectionBridgeProps) => {

  useEffect(() => {
    console.log('🌉 FASE 3: Configurando Connection Bridge Host→React');
    
    // BRIDGE ÚNICO: Sem verificações redundantes
    const handleWebRTCTrack = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log(`🎯 BRIDGE-ÚNICO: ${participantId}`);
      
      if (!participantId || !stream) return;
      
      // Atualizar estados diretamente
      setParticipantStreams(prev => ({ ...prev, [participantId]: stream }));
      
      setParticipantList(prev => {
        const exists = prev.some(p => p.id === participantId);
        if (!exists) {
          return [...prev, {
            id: participantId,
            name: `Mobile-${participantId.slice(-4)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: prev.length === 0,
            hasVideo: true,
            isMobile: true
          }];
        }
        return prev.map(p => 
          p.id === participantId 
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        );
      });
    };
    
    // HANDLERS SIMPLIFICADOS: Sem múltiplas camadas
    const handleForceConnection = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      if (stream) handleWebRTCTrack({ detail: { participantId, stream } } as CustomEvent);
    };
    
    const handleWebRTCStateChange = (event: CustomEvent) => {
      const { participantId, state } = event.detail;
      console.log(`🔗 ${participantId} → ${state}`);
    };
    
    // LISTENERS ÚNICOS: Apenas essenciais
    window.addEventListener('participant-stream-connected', handleWebRTCTrack as EventListener);
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    
    return () => {
      window.removeEventListener('participant-stream-connected', handleWebRTCTrack as EventListener);
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    };
  }, [setParticipantStreams, setParticipantList, participantStreams]);

  // Debug method
  const debugConnectionBridge = () => {
    console.log('🔍 FASE 3 DEBUG:', {
      participantStreams: Object.keys(participantStreams),
      streamCount: Object.keys(participantStreams).length
    });
  };

  return { debugConnectionBridge };
};