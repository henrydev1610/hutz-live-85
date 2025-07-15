import { useEffect, useRef } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { toast } from 'sonner';

interface UseVideoDisplayStabilizationProps {
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useVideoDisplayStabilization = ({
  participantList,
  participantStreams,
  transmissionWindowRef
}: UseVideoDisplayStabilizationProps) => {
  const lastStreamCheckRef = useRef<number>(0);
  const streamMappingRef = useRef<Map<string, boolean>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // CRITICAL: Monitor and force video display for mobile participants
  useEffect(() => {
    const stabilizationInterval = setInterval(() => {
      console.log('🔍 VIDEO STABILIZATION: Checking video display status...');
      
      participantList.forEach(participant => {
        const stream = participantStreams[participant.id];
        
        if (stream && participant.selected) {
          const hasVideo = stream.getVideoTracks().length > 0;
          const isVideoActive = stream.getVideoTracks().some(track => 
            track.readyState === 'live' && track.enabled
          );
          
          console.log(`🎥 VIDEO CHECK for ${participant.id}:`, {
            hasStream: !!stream,
            hasVideo,
            isVideoActive,
            trackCount: stream.getTracks().length,
            videoTrackStates: stream.getVideoTracks().map(t => ({
              readyState: t.readyState,
              enabled: t.enabled,
              muted: t.muted
            }))
          });

          // If participant has video but it's not displaying, force update
          if (hasVideo && isVideoActive && !streamMappingRef.current.get(participant.id)) {
            console.log(`🔧 VIDEO STABILIZATION: Forcing video display for ${participant.id}`);
            forceVideoDisplay(participant.id, stream);
            streamMappingRef.current.set(participant.id, true);
            
            // Show visual feedback
            toast.success(`📱 Vídeo mobile de ${participant.name} conectado!`, {
              description: 'Stream recebido e sendo exibido'
            });
          }

          // Check for stuck video streams
          const retryCount = retryCountRef.current.get(participant.id) || 0;
          if (hasVideo && !isVideoActive && retryCount < 3) {
            console.log(`🔄 VIDEO RECOVERY: Attempting to recover video for ${participant.id} (attempt ${retryCount + 1})`);
            attemptVideoRecovery(participant.id, stream);
            retryCountRef.current.set(participant.id, retryCount + 1);
          }
        }
      });

      lastStreamCheckRef.current = Date.now();
    }, 3000); // Check every 3 seconds

    return () => {
      clearInterval(stabilizationInterval);
    };
  }, [participantList, participantStreams]);

  // CRITICAL: Force video display in transmission window
  const forceVideoDisplay = (participantId: string, stream: MediaStream) => {
    console.log(`🎬 FORCE VIDEO DISPLAY: Setting up video for ${participantId}`);
    
    try {
      // Update transmission window immediately
      if (transmissionWindowRef.current) {
        console.log(`📺 TRANSMISSION: Sending video stream for ${participantId}`);
        
        transmissionWindowRef.current.postMessage({
          type: 'FORCE_VIDEO_DISPLAY',
          participantId,
          streamAvailable: true,
          videoActive: true,
          timestamp: Date.now(),
          trackInfo: {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            totalTracks: stream.getTracks().length
          }
        }, '*');

        // Also send the stream attachment message
        transmissionWindowRef.current.postMessage({
          type: 'ATTACH_STREAM',
          participantId,
          streamId: stream.id,
          timestamp: Date.now()
        }, '*');
      }

      // Find all video elements for this participant and force refresh
      const videoElements = document.querySelectorAll(`video[data-participant-id="${participantId}"]`);
      videoElements.forEach((videoEl: any) => {
        if (videoEl.srcObject !== stream) {
          console.log(`🔧 VIDEO ELEMENT: Attaching stream to video element for ${participantId}`);
          videoEl.srcObject = stream;
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          videoEl.muted = false; // Don't mute participant video
          
          // Force play
          videoEl.play().catch((error: any) => {
            console.warn(`⚠️ VIDEO PLAY: Failed to play video for ${participantId}:`, error);
          });
        }
      });

    } catch (error) {
      console.error(`❌ FORCE VIDEO DISPLAY: Error for ${participantId}:`, error);
    }
  };

  // CRITICAL: Attempt to recover stuck video streams
  const attemptVideoRecovery = (participantId: string, stream: MediaStream) => {
    console.log(`🚑 VIDEO RECOVERY: Attempting recovery for ${participantId}`);
    
    try {
      // Get video tracks
      const videoTracks = stream.getVideoTracks();
      
      videoTracks.forEach((track, index) => {
        console.log(`🔧 TRACK RECOVERY: Processing track ${index} for ${participantId}:`, {
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        });

        // Try to restart the track
        if (track.readyState === 'ended') {
          console.log(`⚠️ TRACK RECOVERY: Track ended, cannot recover`);
          return;
        }

        // Enable and unmute if needed
        if (!track.enabled) {
          track.enabled = true;
          console.log(`✅ TRACK RECOVERY: Enabled track for ${participantId}`);
        }

        if (track.muted) {
          // Can't unmute programmatically, but log for debugging
          console.log(`⚠️ TRACK RECOVERY: Track is muted (user/system controlled)`);
        }
      });

      // Force re-display
      forceVideoDisplay(participantId, stream);

    } catch (error) {
      console.error(`❌ VIDEO RECOVERY: Failed for ${participantId}:`, error);
    }
  };

  // CRITICAL: Manual trigger for video display (for debugging)
  const manualVideoTrigger = (participantId?: string) => {
    console.log('🎯 MANUAL VIDEO TRIGGER: Forcing all video displays...');
    
    if (participantId) {
      const stream = participantStreams[participantId];
      if (stream) {
        forceVideoDisplay(participantId, stream);
        toast.info(`🔧 Forçando exibição do vídeo: ${participantId}`);
      }
    } else {
      // Trigger for all participants with streams
      Object.entries(participantStreams).forEach(([id, stream]) => {
        const participant = participantList.find(p => p.id === id);
        if (participant && participant.selected) {
          forceVideoDisplay(id, stream);
        }
      });
      toast.info('🔧 Forçando exibição de todos os vídeos');
    }
  };

  // CRITICAL: Get diagnostic info
  const getVideoDiagnostics = () => {
    const diagnostics = {
      totalParticipants: participantList.length,
      participantsWithStreams: Object.keys(participantStreams).length,
      selectedParticipants: participantList.filter(p => p.selected).length,
      activeVideoStreams: 0,
      streamDetails: {} as any
    };

    Object.entries(participantStreams).forEach(([id, stream]) => {
      const videoTracks = stream.getVideoTracks();
      const activeVideoTracks = videoTracks.filter(t => 
        t.readyState === 'live' && t.enabled
      );
      
      if (activeVideoTracks.length > 0) {
        diagnostics.activeVideoStreams++;
      }

      diagnostics.streamDetails[id] = {
        totalTracks: stream.getTracks().length,
        videoTracks: videoTracks.length,
        activeVideoTracks: activeVideoTracks.length,
        audioTracks: stream.getAudioTracks().length,
        trackStates: videoTracks.map(t => ({
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
          label: t.label
        }))
      };
    });

    console.log('📊 VIDEO DIAGNOSTICS:', diagnostics);
    return diagnostics;
  };

  return {
    forceVideoDisplay,
    manualVideoTrigger,
    getVideoDiagnostics,
    attemptVideoRecovery
  };
};