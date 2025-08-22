import { useEffect, useRef } from 'react';

interface UseWebRTCBridgeProps {
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<any[]>>;
}

export const useWebRTCBridge = ({
  participantStreams,
  setParticipantStreams,
  setParticipantList
}: UseWebRTCBridgeProps) => {
  const bridgeRef = useRef(new Map<string, MediaStream>());

  useEffect(() => {
    console.log('🌉 WEBRTC BRIDGE: Configurando ponte WebRTC → React');
    
    // PONTE PRINCIPAL: Escutar eventos WebRTC diretos
    const handleWebRTCStream = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🌉 WEBRTC BRIDGE: Recebido stream WebRTC:', participantId, stream?.id);
      
      if (!participantId || !stream) {
        console.warn('⚠️ WEBRTC BRIDGE: Dados inválidos recebidos');
        return;
      }
      
      // Verificar se é stream novo ou atualização
      const existingStream = bridgeRef.current.get(participantId);
      if (existingStream?.id === stream.id) {
        console.log('🔄 WEBRTC BRIDGE: Stream já existe, pulando atualização');
        return;
      }
      
      // Armazenar stream na ponte
      bridgeRef.current.set(participantId, stream);
      
      // ATUALIZAÇÃO 1: Streams do participante
      console.log('📊 WEBRTC BRIDGE: Atualizando participantStreams');
      setParticipantStreams(prevStreams => {
        const updated = { ...prevStreams, [participantId]: stream };
        console.log('📊 WEBRTC BRIDGE: ParticipantStreams atualizado:', Object.keys(updated));
        return updated;
      });
      
      // ATUALIZAÇÃO 2: Lista de participantes (marcar como tendo vídeo)
      console.log('👥 WEBRTC BRIDGE: Atualizando lista de participantes');
      setParticipantList(prevList => {
        const updated = prevList.map(p => 
          p.id === participantId 
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        );
        
        // Se participante não existe, criar novo
        const exists = prevList.some(p => p.id === participantId);
        if (!exists) {
          console.log('👤 WEBRTC BRIDGE: Criando novo participante:', participantId);
          updated.push({
            id: participantId,
            name: `Participante ${participantId.slice(-4)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true, // Auto-selecionar primeiro participante
            hasVideo: true,
            isMobile: true
          });
        }
        
        console.log('👥 WEBRTC BRIDGE: ParticipantList atualizado:', updated.length);
        return updated;
      });
      
      // NOTIFICAÇÃO: Toast visual
      console.log('🎉 WEBRTC BRIDGE: Stream conectado com sucesso!');
      window.dispatchEvent(new CustomEvent('webrtc-bridge-success', {
        detail: { participantId, streamId: stream.id }
      }));
    };
    
    // PONTE DE FORÇA: Fallback para casos extremos
    const handleForceUpdate = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🔥 WEBRTC BRIDGE FORCE: Forçando atualização:', participantId);
      
      if (stream) {
        handleWebRTCStream({ detail: { participantId, stream } } as CustomEvent);
      }
    };
    
    // Registrar todos os event listeners
    window.addEventListener('participant-stream-connected', handleWebRTCStream as EventListener);
    window.addEventListener('force-stream-state-update', handleForceUpdate as EventListener);
    window.addEventListener('stream-received', handleWebRTCStream as EventListener);
    
    // BroadcastChannel para comunicação cross-tab
    const bc = new BroadcastChannel('webrtc-stream-bridge');
    bc.onmessage = (event) => {
      const { action, participantId, streamId } = event.data;
      if (action === 'stream-received') {
        console.log('📻 WEBRTC BRIDGE: Recebido via BroadcastChannel:', participantId, streamId);
        // Força re-render via timestamp
        setParticipantStreams(prev => ({ ...prev }));
      }
    };
    
    return () => {
      console.log('🧹 WEBRTC BRIDGE: Limpando listeners');
      window.removeEventListener('participant-stream-connected', handleWebRTCStream as EventListener);
      window.removeEventListener('force-stream-state-update', handleForceUpdate as EventListener);
      window.removeEventListener('stream-received', handleWebRTCStream as EventListener);
      bc.close();
      bridgeRef.current.clear();
    };
  }, [setParticipantStreams, setParticipantList]);

  // Método para debug: verificar estado da ponte
  const debugBridge = () => {
    console.log('🔍 WEBRTC BRIDGE DEBUG:', {
      bridgeStreams: Array.from(bridgeRef.current.keys()),
      participantStreams: Object.keys(participantStreams),
      bridgeSize: bridgeRef.current.size
    });
  };

  return { debugBridge };
};