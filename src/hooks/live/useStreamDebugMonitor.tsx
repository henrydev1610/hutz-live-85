import { useEffect, useRef } from 'react';

interface UseStreamDebugMonitorProps {
  participantStreams: { [id: string]: MediaStream };
  participantList: any[];
  transmissionOpen: boolean;
}

export const useStreamDebugMonitor = ({
  participantStreams,
  participantList,
  transmissionOpen
}: UseStreamDebugMonitorProps) => {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start heartbeat monitoring
    heartbeatIntervalRef.current = setInterval(() => {
      const activeVideos = participantList.filter(p => p.active).length;
      const activeStreams = Object.keys(participantStreams).length;
      const sharedStreams = transmissionOpen ? activeStreams : 0;
      const selectedWithVideo = participantList.filter(p => p.selected && participantStreams[p.id]).length;
      const availableStreams = Object.keys(participantStreams);

      console.log(`📊 HEARTBEAT - Active videos: ${activeVideos} Active streams: ${activeStreams}`);
      console.log(`📊 sharedStreams: ${sharedStreams}`);
      console.log(`📊 Selected participants with video: ${selectedWithVideo}`);
      console.log(`📊 Available streams: [${availableStreams.join(', ')}]`);

      // CRITICAL: Check for connection issues
      if (activeVideos > 0 && activeStreams === 0) {
        console.warn('⚠️ Participants connected but no streams received');
      }

      if (transmissionOpen && sharedStreams === 0 && activeVideos > 0) {
        console.warn('⚠️ Transmission open but no streams being shared');
      }

      // Log stream quality
      Object.entries(participantStreams).forEach(([id, stream]) => {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const track = videoTracks[0];
          console.log(`📹 Stream ${id}:`, {
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted,
            settings: track.getSettings()
          });
        }
      });

    }, 5000); // Every 5 seconds

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [participantStreams, participantList, transmissionOpen]);

  // Log immediate changes
  useEffect(() => {
    console.log('🔄 STREAM CHANGE:', {
      streamCount: Object.keys(participantStreams).length,
      participantCount: participantList.length,
      transmissionOpen
    });
  }, [participantStreams, participantList, transmissionOpen]);

  return {};
};