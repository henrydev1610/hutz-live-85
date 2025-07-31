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
    
    // PONTE PRINCIPAL: ontrack → React State
    const handleWebRTCTrack = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🌉 FASE 3: Track recebido via bridge:', participantId, stream?.id);
      
      if (!participantId || !stream) {
        console.warn('⚠️ FASE 3: Dados inválidos no bridge');
        return;
      }
      
      // Verificar se é stream novo
      const existingStream = participantStreams[participantId];
      if (existingStream?.id === stream.id) {
        console.log('🔄 FASE 3: Stream já existe, verificando se tracks mudaram');
        
        // Verificar se há mudanças nas tracks
        const existingTracks = existingStream.getTracks().map(t => t.id).sort();
        const newTracks = stream.getTracks().map(t => t.id).sort();
        
        if (JSON.stringify(existingTracks) === JSON.stringify(newTracks)) {
          console.log('🔄 FASE 3: Tracks idênticas, pulando atualização');
          return;
        }
      }
      
      console.log('📊 FASE 3: Atualizando participantStreams');
      setParticipantStreams(prevStreams => {
        const updated = { ...prevStreams, [participantId]: stream };
        console.log('📊 FASE 3: ParticipantStreams atualizado:', Object.keys(updated));
        
        // PONTE VISUAL: Disparar evento de sucesso
        window.dispatchEvent(new CustomEvent('webrtc-bridge-success', {
          detail: { participantId, streamId: stream.id, timestamp: Date.now() }
        }));
        
        return updated;
      });
      
      console.log('👥 FASE 3: Atualizando lista de participantes');
      setParticipantList(prevList => {
        const updated = prevList.map(p => 
          p.id === participantId 
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        );
        
        // Se participante não existe, criar novo
        const exists = prevList.some(p => p.id === participantId);
        if (!exists) {
          console.log('👤 FASE 3: Criando novo participante:', participantId);
          updated.push({
            id: participantId,
            name: `Participante ${participantId.slice(-4)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: updated.length === 0, // Auto-selecionar primeiro
            hasVideo: true,
            isMobile: true
          });
        }
        
        console.log('👥 FASE 3: ParticipantList atualizado:', updated.length);
        return updated;
      });
    };
    
    // PONTE DE FORÇA: Para casos onde ontrack normal falha
    const handleForceConnection = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      console.log('🔥 FASE 3 FORCE: Forçando conexão:', participantId);
      
      if (stream) {
        handleWebRTCTrack({ detail: { participantId, stream } } as CustomEvent);
      }
    };
    
    // PONTE VISUAL: Logging de estados WebRTC
    const handleWebRTCStateChange = (event: CustomEvent) => {
      const { participantId, state, timestamp } = event.detail;
      console.log(`🔗 FASE 3 STATE: ${participantId} → ${state} (${new Date(timestamp).toLocaleTimeString()})`);
      
      // Toast visual para mudanças importantes
      if (state === 'connected') {
        console.log(`✅ FASE 3: Conexão WebRTC estabelecida com ${participantId}`);
        window.dispatchEvent(new CustomEvent('webrtc-connection-established', {
          detail: { participantId, timestamp }
        }));
      } else if (state === 'failed') {
        console.error(`❌ FASE 3: Conexão WebRTC falhou com ${participantId}`);
      }
    };
    
    // PONTE DE RETRY: Para casos onde stream não aparece
    const handleStreamMissing = (event: CustomEvent) => {
      const { participantId, error } = event.detail;
      console.error(`🚨 FASE 3 MISSING: Stream ausente para ${participantId}:`, error);
      
      // Tentar recuperar stream após delay
      setTimeout(() => {
        console.log(`🔄 FASE 3 RETRY: Tentando recuperar stream para ${participantId}`);
        // Forçar re-handshake
        window.dispatchEvent(new CustomEvent('force-webrtc-retry', {
          detail: { participantId }
        }));
      }, 2000);
    };
    
    // Registrar todos os listeners
    window.addEventListener('participant-stream-connected', handleWebRTCTrack as EventListener);
    window.addEventListener('force-stream-state-update', handleForceConnection as EventListener);
    window.addEventListener('stream-received', handleWebRTCTrack as EventListener);
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    window.addEventListener('stream-missing-error', handleStreamMissing as EventListener);
    
    // BroadcastChannel para comunicação cross-tab
    const bc = new BroadcastChannel('webrtc-connection-bridge');
    bc.onmessage = (event) => {
      const { action, participantId, streamId } = event.data;
      if (action === 'stream-connected') {
        console.log('📻 FASE 3: Recebido via BroadcastChannel:', participantId, streamId);
        // Forçar re-render
        setParticipantStreams(prev => ({ ...prev }));
      }
    };
    
    return () => {
      console.log('🧹 FASE 3: Limpando Connection Bridge');
      window.removeEventListener('participant-stream-connected', handleWebRTCTrack as EventListener);
      window.removeEventListener('force-stream-state-update', handleForceConnection as EventListener);
      window.removeEventListener('stream-received', handleWebRTCTrack as EventListener);
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
      window.removeEventListener('stream-missing-error', handleStreamMissing as EventListener);
      bc.close();
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