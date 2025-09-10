import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ConnectionStabilityOptions {
  participantId: string;
  sessionId: string | undefined;
  unifiedWebSocketService: any;
  onReconnection?: (wasSuccessful: boolean) => void;
}

/**
 * FASE 2: Hook para garantir reconexão inteligente preservando participantId
 * Evita que reconexões automáticas criem novos IDs ou destruam streams válidos
 */
export const useParticipantConnectionStability = ({
  participantId,
  sessionId,
  unifiedWebSocketService,
  onReconnection
}: ConnectionStabilityOptions) => {
  const lastParticipantIdRef = useRef<string>(participantId);
  const reconnectionInProgressRef = useRef(false);
  
  // Função para preservar participantId durante reconexões
  const preserveParticipantId = useCallback(() => {
    if (sessionId) {
      const storageKey = `participantId-${sessionId}`;
      sessionStorage.setItem(storageKey, participantId);
      console.log(`🔒 FASE 2: ParticipantId preserved - ${participantId}`);
    }
  }, [participantId, sessionId]);
  
  // Função para reconexão inteligente
  const performIntelligentReconnection = useCallback(async () => {
    if (reconnectionInProgressRef.current) {
      console.log(`⏳ FASE 2: Reconnection already in progress for ${participantId}`);
      return false;
    }
    
    console.log(`🔄 FASE 2: Starting intelligent reconnection for ${participantId}`);
    reconnectionInProgressRef.current = true;
    
    try {
      // Preservar participantId antes de reconectar
      preserveParticipantId();
      
      // Verificar se stream protegido ainda existe
      const protectedStream = (window as any).__participantSharedStream;
      const hasProtectedStream = protectedStream && (protectedStream as any).__isProtected;
      
      if (hasProtectedStream) {
        console.log(`🛡️ FASE 2: Protected stream detected during reconnection - preserving`);
        toast.info('🔄 Reconectando preservando stream...');
      } else {
        console.log(`⚠️ FASE 2: No protected stream found during reconnection`);
        toast.warning('🔄 Reconectando sem stream protegido');
      }
      
      // Realizar reconexão através do serviço existente
      if (unifiedWebSocketService && unifiedWebSocketService.connect) {
        await unifiedWebSocketService.connect();
        
        // Aguardar estabilização
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Validar que participantId foi preservado
        const currentStoredId = sessionId ? sessionStorage.getItem(`participantId-${sessionId}`) : null;
        if (currentStoredId === participantId) {
          console.log(`✅ FASE 2: ParticipantId successfully preserved after reconnection`);
          onReconnection?.(true);
          return true;
        } else {
          console.error(`❌ FASE 2: ParticipantId NOT preserved - stored: ${currentStoredId}, current: ${participantId}`);
          onReconnection?.(false);
          return false;
        }
      } else {
        console.error(`❌ FASE 2: WebSocket service not available for reconnection`);
        onReconnection?.(false);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ FASE 2: Intelligent reconnection failed for ${participantId}:`, error);
      onReconnection?.(false);
      return false;
    } finally {
      reconnectionInProgressRef.current = false;
    }
  }, [participantId, sessionId, unifiedWebSocketService, preserveParticipantId, onReconnection]);
  
  // Monitorar mudanças de participantId não intencionais
  useEffect(() => {
    if (lastParticipantIdRef.current !== participantId) {
      console.warn(`⚠️ FASE 2: ParticipantId changed from ${lastParticipantIdRef.current} to ${participantId}`);
      
      // Tentar restaurar ID anterior se ainda válido
      const previousId = lastParticipantIdRef.current;
      if (sessionId) {
        const storageKey = `participantId-${sessionId}`;
        const storedId = sessionStorage.getItem(storageKey);
        
        if (storedId === previousId) {
          console.log(`🔧 FASE 2: Attempting to restore previous participantId: ${previousId}`);
          
          // Emit event para componente pai ajustar
          window.dispatchEvent(new CustomEvent('participant-id-restore-needed', {
            detail: {
              currentId: participantId,
              previousId,
              storedId,
              sessionId
            }
          }));
        }
      }
      
      lastParticipantIdRef.current = participantId;
    }
  }, [participantId, sessionId]);
  
  // Setup automatic preservation on mount
  useEffect(() => {
    preserveParticipantId();
  }, [preserveParticipantId]);
  
  // Listen for WebSocket disconnection events
  useEffect(() => {
    const handleDisconnection = () => {
      console.log(`📡 FASE 2: WebSocket disconnection detected for ${participantId}`);
      
      // Schedule intelligent reconnection with delay
      setTimeout(() => {
        if (!reconnectionInProgressRef.current) {
          console.log(`🔄 FASE 2: Auto-triggering intelligent reconnection`);
          performIntelligentReconnection().catch(error => {
            console.error(`❌ FASE 2: Auto-reconnection failed:`, error);
          });
        }
      }, 3000); // 3 second delay for network stabilization
    };
    
    // Listen for custom disconnection events
    window.addEventListener('websocket-disconnected', handleDisconnection);
    
    return () => {
      window.removeEventListener('websocket-disconnected', handleDisconnection);
    };
  }, [participantId, performIntelligentReconnection]);
  
  return {
    preserveParticipantId,
    performIntelligentReconnection,
    isReconnecting: reconnectionInProgressRef.current
  };
};