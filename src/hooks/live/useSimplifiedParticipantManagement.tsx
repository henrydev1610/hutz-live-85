import { useEffect, useCallback } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { streamSynchronizer } from '@/utils/StreamSynchronizer';
import { useToast } from '@/components/ui/use-toast';

interface UseSimplifiedParticipantManagementProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
  isHost: boolean;
}

export const useSimplifiedParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants,
  isHost
}: UseSimplifiedParticipantManagementProps) => {
  const { toast } = useToast();

  // SISTEMA ÚNICO: Stream handler direto via StreamSynchronizer
  const handleParticipantStream = useCallback(async (participantId: string, stream: MediaStream) => {
    console.log(`📹 SIMPLIFIED: Stream received for ${participantId}`);
    
    try {
      // Register stream with synchronizer
      streamSynchronizer.registerStream(participantId, stream);
      
      // Update participant streams state
      setParticipantStreams(prev => ({
        ...prev,
        [participantId]: stream
      }));
      
      // Update participant list to mark as active with video
      setParticipantList(prev => 
        prev.map(p => 
          p.id === participantId
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        )
      );
      
      // Update transmission immediately
      updateTransmissionParticipants();
      
      // Success toast for host
      if (isHost) {
        toast({
          title: "Participante Conectado",
          description: `Stream recebido de ${participantId}`,
        });
      }
      
      console.log(`✅ SIMPLIFIED: Stream processed successfully for ${participantId}`);
      
    } catch (error) {
      console.error(`❌ SIMPLIFIED: Failed to process stream for ${participantId}:`, error);
      
      toast({
        title: "Erro de Stream",
        description: `Falha ao processar stream de ${participantId}`,
        variant: "destructive"
      });
    }
  }, [setParticipantStreams, setParticipantList, updateTransmissionParticipants, isHost, toast]);

  // SISTEMA ÚNICO: Participant join handler
  const handleParticipantJoin = useCallback((participantId: string, participantInfo?: any) => {
    console.log(`👤 SIMPLIFIED: Participant joining: ${participantId}`);
    
    // Check if participant already exists
    const existingParticipant = participantList.find(p => p.id === participantId);
    if (existingParticipant) {
      console.log(`👤 SIMPLIFIED: Participant ${participantId} already exists, updating...`);
      
      setParticipantList(prev =>
        prev.map(p =>
          p.id === participantId
            ? { ...p, active: true, lastActive: Date.now() }
            : p
        )
      );
      return;
    }
    
    // Add new participant
    const newParticipant: Participant = {
      id: participantId,
      name: participantInfo?.name || `Participante ${participantId.slice(-4)}`,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: false,
      hasVideo: false,
      isMobile: participantInfo?.isMobile || false
    };
    
    setParticipantList(prev => [...prev, newParticipant]);
    
    // Success toast for host
    if (isHost) {
      toast({
        title: "Novo Participante",
        description: `${newParticipant.name} entrou na sessão`,
      });
    }
    
    console.log(`✅ SIMPLIFIED: Participant added: ${participantId}`);
  }, [participantList, setParticipantList, isHost, toast]);

  // SISTEMA ÚNICO: Participant selection
  const handleParticipantSelect = useCallback((participantId: string) => {
    console.log(`🎯 SIMPLIFIED: Selecting participant: ${participantId}`);
    
    setParticipantList(prev =>
      prev.map(p => ({
        ...p,
        selected: p.id === participantId ? !p.selected : p.selected
      }))
    );
    
    // Update transmission immediately
    updateTransmissionParticipants();
  }, [setParticipantList, updateTransmissionParticipants]);

  // SISTEMA ÚNICO: Participant removal
  const handleParticipantRemove = useCallback((participantId: string) => {
    console.log(`🗑️ SIMPLIFIED: Removing participant: ${participantId}`);
    
    // Remove from participant list
    setParticipantList(prev => prev.filter(p => p.id !== participantId));
    
    // Remove from streams
    setParticipantStreams(prev => {
      const updated = { ...prev };
      delete updated[participantId];
      return updated;
    });
    
    // Remove from stream synchronizer
    streamSynchronizer.removeParticipant(participantId);
    
    // Update transmission
    updateTransmissionParticipants();
    
    toast({
      title: "Participante Removido",
      description: `Participante ${participantId} foi removido`,
    });
  }, [setParticipantList, setParticipantStreams, updateTransmissionParticipants, toast]);

  // SISTEMA ÚNICO: Transfer stream to transmission
  const transferStreamToTransmission = useCallback((participantId: string) => {
    console.log(`📤 SIMPLIFIED: Transferring stream to transmission: ${participantId}`);
    
    const stream = participantStreams[participantId];
    if (!stream) {
      console.error(`❌ SIMPLIFIED: No stream found for ${participantId}`);
      return;
    }
    
    // Select the participant
    handleParticipantSelect(participantId);
    
    // Notify transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'stream-transfer',
        participantId,
        timestamp: Date.now()
      }, '*');
    }
    
    toast({
      title: "Stream Transferido",
      description: `Stream de ${participantId} enviado para transmissão`,
    });
  }, [participantStreams, handleParticipantSelect, transmissionWindowRef, toast]);

  // ETAPA 3: Lidar com detecção de participantes
  useEffect(() => {
    if (!isHost) return;

    const handleParticipantDiscovered = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log('🔍 DETECÇÃO: Participante descoberto:', participantId);
      
      // ETAPA 3: Solicitar offer IMEDIATAMENTE
      setTimeout(() => {
        console.log('🚀 CRÍTICO: Solicitando offer do participante:', participantId);
        
        // Usar RobustHostHandshake para solicitar offer
        import('@/webrtc/handshake/RobustHostHandshake').then(({ requestOfferFromParticipant }) => {
          requestOfferFromParticipant(participantId);
        });
      }, 100); // Delay mínimo de 100ms
    };

    window.addEventListener('participant-discovered', handleParticipantDiscovered as EventListener);
    
    return () => {
      window.removeEventListener('participant-discovered', handleParticipantDiscovered as EventListener);
    };
  }, [isHost]);

  // SISTEMA ÚNICO: Setup WebRTC stream callbacks
  useEffect(() => {
    if (!isHost || !sessionId) return;
    
    console.log('🔧 SIMPLIFIED: Setting up host stream callbacks');
    
    // Register global callback for host
    if (typeof window !== 'undefined') {
      window.hostStreamCallback = handleParticipantStream;
      
      // Setup stream synchronizer callback
      streamSynchronizer.onStreamAvailable = (participantId: string, callback: (stream: MediaStream) => void) => {
        console.log(`📝 SIMPLIFIED: Stream callback registered for ${participantId}`);
        
        // Check if stream is already available
        const existingStream = participantStreams[participantId];
        if (existingStream) {
          callback(existingStream);
        }
      };
    }
    
    return () => {
      console.log('🧹 SIMPLIFIED: Cleaning up host callbacks');
      // Keep callback for persistence across component re-renders
    };
  }, [isHost, sessionId, handleParticipantStream, participantStreams]);

  return {
    handleParticipantJoin,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantStream,
    transferStreamToTransmission
  };
};
