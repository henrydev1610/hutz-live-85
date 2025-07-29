import { useEffect, useCallback } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseAutoParticipantDetectionProps {
  sessionId: string;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  handleParticipantJoin: (participantId: string, participantInfo?: any) => void;
}

export const useAutoParticipantDetection = ({
  sessionId,
  setParticipantList,
  handleParticipantJoin
}: UseAutoParticipantDetectionProps) => {

  // Listener para eventos de descoberta automática
  const handleParticipantDiscovery = useCallback((event: CustomEvent) => {
    const { participantId } = event.detail;
    console.log('🔍 AUTO-DETECTION: Participante descoberto:', participantId);
    
    if (participantId && participantId.includes('participant-')) {
      console.log('✅ AUTO-DETECTION: Processando participante móvel');
      
      // Forçar adição à lista
      setParticipantList(prev => {
        const existing = prev.find(p => p.id === participantId);
        if (!existing) {
          console.log('🆕 AUTO-DETECTION: Adicionando novo participante');
          return [...prev, {
            id: participantId,
            name: `Mobile-${participantId.substring(0, 8)}`,
            hasVideo: false,
            active: true,
            selected: true,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            connectedAt: Date.now(),
            isMobile: true
          }];
        }
        
        return prev.map(p => 
          p.id === participantId 
            ? { ...p, active: true, selected: true, connectedAt: Date.now() }
            : p
        );
      });
      
      // Chamar handler de join
      handleParticipantJoin(participantId, {
        isMobile: true,
        selected: true,
        connectedAt: Date.now()
      });
    }
  }, [setParticipantList, handleParticipantJoin]);

  // Listener para BroadcastChannel
  useEffect(() => {
    const bc = new BroadcastChannel('participant-discovery');
    
    bc.onmessage = (event) => {
      const { type, participantId } = event.data;
      
      if (type === 'participant-joined' && participantId) {
        console.log('📡 BROADCAST: Participante descoberto via BroadcastChannel:', participantId);
        handleParticipantDiscovery(new CustomEvent('participant-discovered', {
          detail: { participantId }
        }));
      }
    };
    
    return () => bc.close();
  }, [handleParticipantDiscovery]);

  // Listener para eventos customizados
  useEffect(() => {
    window.addEventListener('participant-discovered', handleParticipantDiscovery as EventListener);
    
    return () => {
      window.removeEventListener('participant-discovered', handleParticipantDiscovery as EventListener);
    };
  }, [handleParticipantDiscovery]);

  // Verificação periódica de participantes órfãos
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔍 AUTO-DETECTION: Verificação periódica de participantes órfãos');
      
      // Verificar se há elementos video com streams mas sem participantes na lista
      const videoElements = document.querySelectorAll('video[data-participant-id]');
      
      videoElements.forEach(video => {
        const participantId = (video as HTMLVideoElement).getAttribute('data-participant-id');
        if (participantId) {
          setParticipantList(prev => {
            const existing = prev.find(p => p.id === participantId);
            if (!existing) {
              console.log('🔄 AUTO-DETECTION: Participante órfão detectado:', participantId);
              return [...prev, {
                id: participantId,
                name: `Orphan-${participantId.substring(0, 8)}`,
                hasVideo: true,
                active: true,
                selected: true,
                joinedAt: Date.now(),
                lastActive: Date.now(),
                connectedAt: Date.now(),
                isMobile: true
              }];
            }
            return prev;
          });
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [setParticipantList]);

  return {
    handleParticipantDiscovery
  };
};