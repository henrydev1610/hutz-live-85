
import { useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { addParticipantToSession } from '@/utils/sessionUtils';

interface UseParticipantLifecycleProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantLifecycle = ({
  participantList,
  setParticipantList,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantLifecycleProps) => {
  const { toast } = useToast();

  const handleParticipantJoin = useCallback((participantId: string) => {
    console.log("🚀 CRITICAL: Participant joined:", participantId);
    
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        console.log(`🔄 Updating existing participant: ${participantId}`);
        return prev.map(p => p.id === participantId ? { 
          ...p, 
          active: true, 
          lastActive: Date.now(), 
          connectedAt: Date.now(),
          selected: true // AUTO-SELECT when participant joins
        } : p);
      }
      
      // Find placeholder to replace
      const placeholderIndex = prev.findIndex(p => p.id.startsWith('placeholder-') && !p.active);
      if (placeholderIndex !== -1) {
        const updated = [...prev];
        const participantName = `Participante ${participantId.substring(0, 8)}`;
        updated[placeholderIndex] = {
          id: participantId,
          name: participantName,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: true, // AUTO-SELECT when participant joins
          hasVideo: false,
          connectedAt: Date.now()
        };
        console.log(`✅ Replaced placeholder at index ${placeholderIndex} with ${participantId} - AUTO-SELECTED`);
        
        // Add to session
        if (sessionId) {
          addParticipantToSession(sessionId, participantId, participantName);
        }
        
        toast({
          title: "Participante conectado",
          description: `${participantName} entrou na sessão e foi selecionado automaticamente`,
        });
        
        return updated;
      }
      
      // Add new participant if no placeholder available
      const participantName = `Participante ${participantId.substring(0, 8)}`;
      const newParticipant = {
        id: participantId,
        name: participantName,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: true,
        selected: true, // AUTO-SELECT when participant joins
        hasVideo: false,
        connectedAt: Date.now()
      };
      
      if (sessionId) {
        addParticipantToSession(sessionId, participantId, participantName);
      }
      
      toast({
        title: "Novo participante",
        description: `${participantName} se conectou e foi selecionado automaticamente`,
      });
      
      console.log(`➕ Added new participant: ${participantId} - AUTO-SELECTED`);
      return [...prev, newParticipant];
    });
    
    // Update transmission window immediately
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'participant-joined',
        id: participantId,
        sessionId,
        autoSelected: true // Flag indicating auto-selection
      }, '*');
    }
    
    // Update transmission participants after a small delay to ensure state updates
    setTimeout(() => {
      updateTransmissionParticipants();
      
      // Send additional message to ensure transmission window shows the participant
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'force-participant-display',
          participantId: participantId,
          timestamp: Date.now()
        }, '*');
      }
    }, 200);
  }, [setParticipantList, sessionId, toast, transmissionWindowRef, updateTransmissionParticipants]);

  const handleParticipantSelect = useCallback((id: string) => {
    setParticipantList(prev => {
      const updatedList = prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p);
      
      // Update transmission window
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: updatedList
        }, '*');
        
        // If selecting and we have a stream, send it
        const participant = updatedList.find(p => p.id === id);
        if (participant?.selected) {
          console.log(`📹 Participant ${id} selected, updating transmission`);
          
          setTimeout(() => {
            if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
              transmissionWindowRef.current.postMessage({
                type: 'video-stream',
                participantId: id,
                hasStream: true,
                timestamp: Date.now()
              }, '*');
            }
          }, 100);
        }
      }
      
      return updatedList;
    });
  }, [setParticipantList, transmissionWindowRef]);

  const handleParticipantRemove = useCallback((id: string) => {
    setParticipantList(prev => {
      const newList = prev.filter(p => p.id !== id);
      
      // Add a new placeholder
      const nextId = `placeholder-${Date.now()}`;
      const newParticipant = {
        id: nextId,
        name: `Participante ${newList.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      };
      
      return [...newList, newParticipant];
    });
    
    // Remove stream
    setParticipantStreams(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, [setParticipantList, setParticipantStreams]);

  return {
    handleParticipantJoin,
    handleParticipantSelect,
    handleParticipantRemove
  };
};
