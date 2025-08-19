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
    console.log('🚨 CRÍTICO: Current participantStreams count:', Object.keys(participantStreams).length);
    
    // BRIDGE ÚNICO COM LOGS DETALHADOS
    const handleWebRTCTrack = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      
      console.log(`🚨 CRÍTICO [BRIDGE] Evento participant-stream-connected recebido:`, {
        participantId,
        streamId: stream?.id,
        streamActive: stream?.active,
        streamTracks: stream?.getTracks()?.length,
        videoTracks: stream?.getVideoTracks()?.length,
        currentStreamsCount: Object.keys(participantStreams).length,
        timestamp: Date.now()
      });
      
      if (!participantId || !stream) {
        console.error('❌ [BRIDGE] Dados inválidos no evento:', { participantId, stream });
        return;
      }
      
      if (!stream.active) {
        console.warn('⚠️ [BRIDGE] Stream não está ativo:', stream);
        return;
      }
      
      if (stream.getVideoTracks().length === 0) {
        console.warn('⚠️ [BRIDGE] Stream não tem tracks de vídeo:', stream);
        return;
      }
      
      // Atualizar estados diretamente
      console.log(`✅ [BRIDGE] Adicionando stream para ${participantId} ao estado React`);
      setParticipantStreams(prev => {
        const newState = { ...prev, [participantId]: stream };
        console.log(`🎯 [BRIDGE] Estado atualizado - streams ativos:`, Object.keys(newState).length);
        return newState;
      });
      
      setParticipantList(prev => {
        const exists = prev.some(p => p.id === participantId);
        if (!exists) {
          console.log(`➕ [BRIDGE] Adicionando novo participante: ${participantId}`);
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
        
        console.log(`🔄 [BRIDGE] Atualizando participante existente: ${participantId}`);
        return prev.map(p => 
          p.id === participantId 
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        );
      });
      
      // Forçar re-render dos componentes dependentes
      setTimeout(() => {
        console.log(`🔄 [BRIDGE] Stream count após atualização:`, Object.keys(participantStreams).length + 1);
        window.dispatchEvent(new CustomEvent('streams-updated', {
          detail: { participantId, streamCount: Object.keys(participantStreams).length + 1 }
        }));
      }, 100);
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