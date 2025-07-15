import { useEffect, useState } from 'react';

interface DebugInfo {
  totalParticipants: number;
  activeParticipants: number;
  participantsWithStreams: number;
  streamsCount: number;
  mobileParticipants: number;
  timestamp: string;
}

export const useStreamDebugger = (
  participantList: any[],
  participantStreams: { [id: string]: MediaStream }
) => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    totalParticipants: 0,
    activeParticipants: 0,
    participantsWithStreams: 0,
    streamsCount: 0,
    mobileParticipants: 0,
    timestamp: ''
  });

  useEffect(() => {
    const updateDebugInfo = () => {
      const streamIds = Object.keys(participantStreams);
      const activeParticipants = participantList.filter(p => p.active);
      const mobileParticipants = participantList.filter(p => p.isMobile);
      const participantsWithStreams = participantList.filter(p => 
        participantStreams[p.id] && !p.id.includes('placeholder')
      );

      const info: DebugInfo = {
        totalParticipants: participantList.length,
        activeParticipants: activeParticipants.length,
        participantsWithStreams: participantsWithStreams.length,
        streamsCount: streamIds.length,
        mobileParticipants: mobileParticipants.length,
        timestamp: new Date().toLocaleTimeString()
      };

      setDebugInfo(info);

      // Log detailed information
      console.log('🔍 STREAM-DEBUG: Current state:', info);
      console.log('🔍 PARTICIPANTS:', participantList.map(p => ({
        id: p.id.substring(0, 8),
        active: p.active,
        hasVideo: p.hasVideo,
        isMobile: p.isMobile,
        hasStream: !!participantStreams[p.id]
      })));
      console.log('🔍 STREAMS:', streamIds.map(id => ({
        id: id.substring(0, 8),
        videoTracks: participantStreams[id]?.getVideoTracks().length || 0,
        audioTracks: participantStreams[id]?.getAudioTracks().length || 0,
        active: participantStreams[id]?.active || false
      })));
    };

    // Update immediately
    updateDebugInfo();

    // Update every 2 seconds
    const interval = setInterval(updateDebugInfo, 2000);

    return () => clearInterval(interval);
  }, [participantList, participantStreams]);

  return debugInfo;
};