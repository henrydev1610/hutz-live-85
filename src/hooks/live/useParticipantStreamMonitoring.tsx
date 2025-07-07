
import { useEffect, useRef } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseParticipantStreamMonitoringProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef: React.MutableRefObject<Window | null>) => void;
  transferStreamToTransmission: (participantId: string, stream: MediaStream) => void;
  sessionId: string | null;
}

export const useParticipantStreamMonitoring = ({
  participantList,
  setParticipantList,
  participantStreams,
  transmissionWindowRef,
  transferStreamToTransmission,
  sessionId
}: UseParticipantStreamMonitoringProps) => {
  const lastUpdateRef = useRef<number>(0);
  const processedStreamsRef = useRef(new Set<string>());

  // DRASTICALLY SIMPLIFIED stream monitoring - only state updates
  useEffect(() => {
    const now = Date.now();
    
    // Debounce agressivo de 2 segundos para evitar updates excessivos
    if (now - lastUpdateRef.current < 2000) {
      console.log('🔥 CRITICAL: Debouncing stream monitoring update');
      return;
    }
    
    lastUpdateRef.current = now;
    
    const activeStreams = Object.keys(participantStreams).length;
    const activeParticipants = participantList.filter(p => p.active).length;
    const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo).length;
    const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder')).length;
    
    console.log('🔍 CRITICAL: Stream monitoring - ULTRA SIMPLIFIED:', {
      totalStreams: activeStreams,
      activeParticipants,
      selectedParticipants,
      realParticipants,
      sessionId
    });
    
    // ONLY update participant state - NO video processing here
    let stateChanged = false;
    
    for (const [participantId, stream] of Object.entries(participantStreams)) {
      const streamKey = `${participantId}-${stream.id}`;
      
      // Skip if already processed
      if (processedStreamsRef.current.has(streamKey)) {
        continue;
      }
      
      console.log(`📋 CRITICAL: Updating ONLY state for: ${participantId}`);
      
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        // Update existing participant state only
        setParticipantList(prev => prev.map(p => 
          p.id === participantId 
            ? { 
                ...p, 
                hasVideo: true, 
                active: true, 
                selected: true,
                lastActive: Date.now() 
              }
            : p
        ));
        stateChanged = true;
      } else {
        // Add new participant but mark as processed
        console.log(`➕ CRITICAL: Adding new participant: ${participantId}`);
        
        const newParticipant: Participant = {
          id: participantId,
          name: `Participante ${participantId.substring(0, 8)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: true,
          hasVideo: true
        };
        
        setParticipantList(prev => [...prev, newParticipant]);
        stateChanged = true;
      }
      
      // Only send to transmission window - NO video element updates
      transferStreamToTransmission(participantId, stream);
      processedStreamsRef.current.add(streamKey);
    }
    
    if (stateChanged) {
      console.log('✅ CRITICAL: Participant state updated successfully');
    }

  }, [participantStreams, sessionId, transferStreamToTransmission, setParticipantList, participantList]);
  
  // Cleanup processed streams when streams are removed
  useEffect(() => {
    const currentStreamKeys = Object.entries(participantStreams).map(([id, stream]) => `${id}-${stream.id}`);
    const processedKeys = Array.from(processedStreamsRef.current);
    
    processedKeys.forEach(key => {
      if (!currentStreamKeys.includes(key)) {
        processedStreamsRef.current.delete(key);
      }
    });
  }, [participantStreams]);
};
