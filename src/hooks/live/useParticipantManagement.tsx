
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useParticipantStreams } from './useParticipantStreams';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { useParticipantStreamMonitoring } from './useParticipantStreamMonitoring';
import { useForceVideoDisplay } from './useForceVideoDisplay';
import { useVideoDisplayStabilization } from './useVideoDisplayStabilization';
import { toast } from 'sonner';

interface UseParticipantManagementProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantManagementProps) => {
  const { updateVideoElementsImmediately } = useVideoElementManagement();
  
  const { handleParticipantStream, handleParticipantTrack } = useParticipantStreams({
    setParticipantStreams,
    setParticipantList,
    updateVideoElementsImmediately,
    transmissionWindowRef
  });

  const { 
    handleParticipantJoin, 
    handleParticipantSelect, 
    handleParticipantRemove 
  } = useParticipantLifecycle({
    participantList,
    setParticipantList,
    setParticipantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  const { transferStreamToTransmission } = useParticipantAutoSelection({
    participantList,
    setParticipantList,
    participantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  useParticipantStreamMonitoring({
    participantList,
    setParticipantList,
    participantStreams,
    transmissionWindowRef,
    updateVideoElementsImmediately,
    transferStreamToTransmission,
    sessionId
  });

  // CRITICAL: Video display stabilization - ensures mobile video appears
  const { 
    forceVideoDisplay, 
    manualVideoTrigger, 
    getVideoDiagnostics 
  } = useVideoDisplayStabilization({
    participantList,
    participantStreams,
    transmissionWindowRef
  });

  // EMERGENCY: Force video display hook
  useForceVideoDisplay({
    participantList,
    participantStreams
  });

  // ENHANCED: WebRTC callbacks with better error handling
  useEffect(() => {
    console.log('🔧 UNIFIED: Setting up WebRTC callbacks with video stabilization');
    
    // Enhanced stream callback with automatic video forcing
    const enhancedStreamCallback = (participantId: string, stream: MediaStream) => {
      console.log(`🎥 ENHANCED STREAM: Received stream from ${participantId}`, {
        streamId: stream.id,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      // Call original handler
      handleParticipantStream(participantId, stream);
      
      // CRITICAL: Force video display immediately for mobile participants
      setTimeout(() => {
        const participant = participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          console.log(`🎬 AUTO FORCE: Forcing video display for selected participant ${participantId}`);
          forceVideoDisplay(participantId, stream);
          
          toast.success(`📱 Vídeo conectado: ${participant.name}`, {
            description: 'Stream recebido e exibindo'
          });
        }
      }, 1000);
    };

    // Enhanced participant join callback
    const enhancedParticipantJoinCallback = (participantId: string) => {
      console.log(`👤 ENHANCED JOIN: Participant ${participantId} joined`);
      handleParticipantJoin(participantId);
      
      toast.info(`👤 Participante conectado: ${participantId}`, {
        description: 'Aguardando stream de vídeo...'
      });
    };

    // Set enhanced callbacks
    setStreamCallback(enhancedStreamCallback);
    setParticipantJoinCallback(enhancedParticipantJoinCallback);
    
    return () => {
      console.log('🧹 UNIFIED: Cleanup handled by UnifiedWebRTCManager');
    };
  }, [sessionId, participantList]);

  // DIAGNOSTIC: Enhanced test connection with video forcing
  const testConnection = () => {
    console.log('🧪 ENHANCED: Testing WebRTC connection with video stabilization...');
    
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Participante Teste',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: true, // Auto-select test participant
      hasVideo: false
    };
    
    setParticipantList(prev => {
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    // HOST: Test connection without using local camera
    const testStream = new MediaStream();
    console.log('✅ Enhanced test connection initiated for:', testParticipant.id);
    
    handleParticipantStream(testParticipant.id, testStream);
    
    // Show diagnostics
    setTimeout(() => {
      const diagnostics = getVideoDiagnostics();
      console.log('📊 TEST DIAGNOSTICS:', diagnostics);
      toast.info('🧪 Teste de conexão iniciado', {
        description: `Participantes: ${diagnostics.totalParticipants}, Streams: ${diagnostics.activeVideoStreams}`
      });
    }, 2000);
        
    setTimeout(() => {
      testStream.getTracks().forEach(track => track.stop());
      setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
      setParticipantStreams(prev => {
        const updated = { ...prev };
        delete updated[testParticipant.id];
        return updated;
      });
    }, 10000);
  };

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream,
    testConnection,
    transferStreamToTransmission,
    // ENHANCED: New video stabilization functions
    forceVideoDisplay,
    manualVideoTrigger,
    getVideoDiagnostics
  };
};
