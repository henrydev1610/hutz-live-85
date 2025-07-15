import { useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

export const useMobileStreamProcessor = () => {
  const { toast } = useToast();

  const processMobileStream = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    updateVideoElementsImmediately: (participantId: string, stream: MediaStream) => void
  ): Promise<boolean> => {
    console.log('📱 MOBILE-PROCESSOR: Processing mobile stream for:', participantId);
    
    try {
      // CRITICAL: Enhanced mobile stream validation
      if (!stream || stream.getTracks().length === 0) {
        console.error('❌ MOBILE-PROCESSOR: Invalid stream');
        return false;
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log('📱 MOBILE-PROCESSOR: Stream details:', {
        streamId: stream.id,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        streamActive: stream.active,
        videoTrackSettings: videoTracks[0]?.getSettings(),
        videoTrackState: videoTracks[0]?.readyState
      });

      // MOBILE-CRITICAL: Immediate video element creation with multiple retries
      let retryCount = 0;
      const maxRetries = 5;
      
      const attemptVideoCreation = async (): Promise<boolean> => {
        try {
          retryCount++;
          console.log(`📱 MOBILE-PROCESSOR: Video creation attempt ${retryCount}/${maxRetries}`);
          
          await updateVideoElementsImmediately(participantId, stream);
          
          // Verify video was created
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const container = document.getElementById(`participant-video-${participantId}`);
          const video = container?.querySelector('video');
          
          if (video && video.srcObject === stream) {
            console.log('✅ MOBILE-PROCESSOR: Video element created successfully');
            return true;
          } else if (retryCount < maxRetries) {
            console.log('🔄 MOBILE-PROCESSOR: Video not found, retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return attemptVideoCreation();
          } else {
            console.error('❌ MOBILE-PROCESSOR: Max retries reached for video creation');
            return false;
          }
          
        } catch (error) {
          console.error(`❌ MOBILE-PROCESSOR: Video creation attempt ${retryCount} failed:`, error);
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return attemptVideoCreation();
          }
          return false;
        }
      };

      const videoCreated = await attemptVideoCreation();
      
      if (videoCreated) {
        toast({
          title: "📱 Mobile camera conectada!",
          description: `Participante ${participantId.substring(0, 8)} está transmitindo`,
        });
      } else {
        toast({
          title: "⚠️ Erro no vídeo mobile",
          description: `Falha ao exibir câmera de ${participantId.substring(0, 8)}`,
          variant: "destructive"
        });
      }
      
      return videoCreated;
      
    } catch (error) {
      console.error('❌ MOBILE-PROCESSOR: Processing failed:', error);
      
      toast({
        title: "❌ Erro ao processar stream mobile",
        description: `Falha no processamento de ${participantId.substring(0, 8)}`,
        variant: "destructive"
      });
      
      return false;
    }
  }, [toast]);

  const validateMobileStream = useCallback((stream: MediaStream): boolean => {
    if (!stream) return false;
    
    const tracks = stream.getTracks();
    if (tracks.length === 0) return false;
    
    // For mobile, accept streams even if not "active" due to browser differences
    const hasValidTracks = tracks.some(track => track.readyState === 'live');
    
    console.log('📱 MOBILE-PROCESSOR: Stream validation:', {
      hasStream: !!stream,
      trackCount: tracks.length,
      hasValidTracks,
      streamActive: stream.active
    });
    
    return hasValidTracks;
  }, []);

  return {
    processMobileStream,
    validateMobileStream
  };
};