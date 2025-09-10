import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ParticipantIdStabilityOptions {
  participantId: string;
  sessionId: string | undefined;
  onStabilityBreach?: (oldId: string, newId: string) => void;
}

/**
 * FASE 1: Hook para monitorar estabilidade do participantId
 * Detecta e corrige quando participantId muda durante reconexões
 */
export const useParticipantIdStability = ({
  participantId,
  sessionId,
  onStabilityBreach
}: ParticipantIdStabilityOptions) => {
  const previousIdRef = useRef<string>(participantId);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  
  useEffect(() => {
    // Detectar mudança de participantId para a mesma sessão
    if (sessionIdRef.current === sessionId && previousIdRef.current !== participantId) {
      console.error(`🚨 FASE 1: participantId INSTABILITY DETECTED!`);
      console.error(`Previous: ${previousIdRef.current}`);
      console.error(`Current: ${participantId}`);
      console.error(`SessionId: ${sessionId}`);
      
      toast.error('⚠️ ID do participante mudou durante reconexão');
      
      // Notificar callback se fornecido
      onStabilityBreach?.(previousIdRef.current, participantId);
      
      // Tentar corrigir usando o ID anterior se ainda válido
      const storageKey = `participantId-${sessionId}`;
      const storedId = sessionStorage.getItem(storageKey);
      
      if (storedId && storedId !== participantId) {
        console.log(`🔧 FASE 1: Attempting to restore stable ID: ${storedId}`);
        
        // Emit event para componentes se ajustarem
        window.dispatchEvent(new CustomEvent('participant-id-stability-breach', {
          detail: {
            oldId: participantId,
            stableId: storedId,
            sessionId
          }
        }));
      }
    }
    
    // Atualizar referências
    previousIdRef.current = participantId;
    sessionIdRef.current = sessionId;
  }, [participantId, sessionId, onStabilityBreach]);
  
  // Função para forçar estabilização
  const forceStabilization = () => {
    if (!sessionId) return null;
    
    const storageKey = `participantId-${sessionId}`;
    const stableId = sessionStorage.getItem(storageKey);
    
    if (stableId && stableId !== participantId) {
      console.log(`🔧 FASE 1: Force stabilization - using ${stableId} instead of ${participantId}`);
      return stableId;
    }
    
    return participantId;
  };
  
  // Função para validar se ID está estável
  const isStable = () => {
    if (!sessionId) return true;
    
    const storageKey = `participantId-${sessionId}`;
    const stableId = sessionStorage.getItem(storageKey);
    
    return !stableId || stableId === participantId;
  };
  
  return {
    isStable: isStable(),
    forceStabilization,
    stableId: forceStabilization()
  };
};