
import { useEffect } from 'react';
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
  updateVideoElementsImmediately,
  transferStreamToTransmission,
  sessionId
}: UseParticipantStreamMonitoringProps) => {

  // Enhanced stream monitoring with better DOM-ready checks and auto-selection
  useEffect(() => {
    const activeStreams = Object.keys(participantStreams).length;
    const activeParticipants = participantList.filter(p => p.active).length;
    const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo).length;
    const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-')).length;
    
    console.log('🔍 CRITICAL Stream Monitor - ENHANCED:', {
      totalStreams: activeStreams,
      activeParticipants,
      selectedParticipants,
      realParticipants,
      domReady: document.readyState,
      gridContainers: document.querySelectorAll('.participant-grid').length
    });
    
    // Only process if we have streams and DOM is ready
    if (activeStreams === 0) {
      console.log('📋 No streams to process');
      return;
    }
    
    // Process streams with enhanced error handling
    const processStreamsWithRetry = async (attempt = 1, maxAttempts = 3) => {
      console.log(`🎬 Processing streams attempt ${attempt}/${maxAttempts}`);
      
      try {
        // Process each stream
        for (const [participantId, stream] of Object.entries(participantStreams)) {
          console.log(`📹 Processing stream for participant: ${participantId}`, {
            streamActive: stream.active,
            trackCount: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
          });
          
          const participant = participantList.find(p => p.id === participantId);
          if (participant) {
            console.log(`✅ Found participant ${participantId}, updating for transmission`);
            
            // Ensure participant is marked correctly AND selected for transmission
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
            
            // Process video display
            setTimeout(async () => {
              try {
                console.log(`🎯 Updating video display for ${participantId}`);
                await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
                transferStreamToTransmission(participantId, stream);
                console.log(`✅ Video display updated successfully for ${participantId}`);
              } catch (error) {
                console.error(`❌ Failed to update video display for ${participantId}:`, error);
                
                if (attempt < maxAttempts) {
                  console.log(`🔄 Will retry processing for ${participantId}`);
                }
              }
            }, 200 * attempt);
            
          } else {
            console.warn(`⚠️ Stream received for unknown participant: ${participantId}`);
            
            // Add new real participant for this stream and auto-select
            const newParticipant: Participant = {
              id: participantId,
              name: `Participante ${participantId.substring(0, 8)}`,
              joinedAt: Date.now(),
              lastActive: Date.now(),
              active: true,
              selected: true,
              hasVideo: true
            };
            
            console.log(`➕ Adding new auto-selected participant: ${participantId}`);
            setParticipantList(prev => [...prev, newParticipant]);
            
            // Process video display for new participant
            setTimeout(async () => {
              try {
                await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
                transferStreamToTransmission(participantId, stream);
                console.log(`✅ New participant video display updated: ${participantId}`);
              } catch (error) {
                console.error(`❌ Failed to update new participant video: ${participantId}`, error);
              }
            }, 300 * attempt);
          }
        }
        
        console.log(`✅ Stream processing completed successfully (attempt ${attempt})`);
        
      } catch (error) {
        console.error(`❌ Stream processing failed (attempt ${attempt}):`, error);
        
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying stream processing (attempt ${attempt + 1})`);
          setTimeout(() => processStreamsWithRetry(attempt + 1, maxAttempts), 1000);
        } else {
          console.error('❌ All stream processing attempts failed');
        }
      }
    };

    // Start processing based on DOM readiness
    if (document.readyState === 'complete') {
      processStreamsWithRetry();
    } else {
      console.log('⏳ Waiting for DOM to be ready before processing streams...');
      const handleLoad = () => {
        console.log('✅ DOM ready, starting stream processing');
        processStreamsWithRetry();
      };
      
      window.addEventListener('load', handleLoad, { once: true });
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [participantList, participantStreams, transmissionWindowRef, updateVideoElementsImmediately, setParticipantList, sessionId, transferStreamToTransmission]);
};
