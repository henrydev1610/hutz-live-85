import { useEffect, useRef } from 'react';

interface StreamTransmissionHandlerProps {
  sessionId: string;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  participantList: any[];
  participantStreams: { [id: string]: MediaStream };
}

export const useStreamTransmissionHandler = ({
  sessionId,
  transmissionWindowRef,
  participantList,
  participantStreams
}: StreamTransmissionHandlerProps) => {
  const sentStreamsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Initialize broadcast channel
    channelRef.current = new BroadcastChannel(`live-session-${sessionId}`);
    
    return () => {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [sessionId]);

  // Handle stream transmission to transmission window
  const sendStreamToTransmission = (participantId: string, stream: MediaStream, isMobile: boolean = false) => {
    const participant = participantList.find(p => p.id === participantId);
    if (!participant) {
      console.warn(`⚠️ STREAM TRANSMISSION: Participant ${participantId} not found in list`);
      return;
    }

    const streamKey = `${participantId}-${stream.id}`;
    if (sentStreamsRef.current.has(streamKey)) {
      console.log(`🔄 STREAM TRANSMISSION: Stream ${streamKey} already sent, skipping`);
      return;
    }

    console.log(`🎯 STREAM TRANSMISSION: Sending ${isMobile ? 'MOBILE' : 'DESKTOP'} stream for ${participantId}`);

    // Send via broadcast channel
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'video-stream',
        participantId,
        hasStream: true,
        isMobile,
        priorityMobile: isMobile,
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        hasVideo: stream.getVideoTracks().length > 0,
        hasAudio: stream.getAudioTracks().length > 0,
        timestamp: Date.now()
      });
    }

    // Send via window postMessage if transmission window is open
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'webrtc-stream',
        participantId,
        stream,
        isMobile,
        priorityMobile: isMobile,
        timestamp: Date.now()
      }, '*');
    }

    sentStreamsRef.current.add(streamKey);
    console.log(`✅ STREAM TRANSMISSION: Stream sent for ${participantId} (${isMobile ? 'MOBILE' : 'DESKTOP'})`);
  };

  // Monitor participantStreams for new streams
  useEffect(() => {
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant && stream) {
        const isMobile = participant.isMobile || false;
        sendStreamToTransmission(participantId, stream, isMobile);
      }
    });
  }, [participantStreams, participantList]);

  // Update transmission window with participant list
  const updateTransmissionParticipants = () => {
    if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) {
      console.log('⚠️ STREAM TRANSMISSION: Transmission window not available for participant update');
      return;
    }

    const participantsWithStreams = participantList.map(participant => ({
      ...participant,
      hasVideo: !!participantStreams[participant.id],
      selected: participant.selected || !!participantStreams[participant.id], // Auto-select participants with streams
      streamId: participantStreams[participant.id]?.id || null
    }));

    // Prioritize mobile participants
    const mobileParticipants = participantsWithStreams.filter(p => p.isMobile && p.hasVideo);
    const desktopParticipants = participantsWithStreams.filter(p => !p.isMobile && p.hasVideo);
    const prioritizedParticipants = [...mobileParticipants, ...desktopParticipants];

    console.log(`📋 STREAM TRANSMISSION: Updating transmission with ${prioritizedParticipants.length} participants (${mobileParticipants.length} mobile, ${desktopParticipants.length} desktop)`);

    transmissionWindowRef.current.postMessage({
      type: 'update-participants',
      participants: prioritizedParticipants,
      timestamp: Date.now()
    }, '*');
  };

  // Force stream re-transmission (for troubleshooting)
  const forceRetransmitStreams = () => {
    console.log('🔄 STREAM TRANSMISSION: Force retransmitting all streams');
    sentStreamsRef.current.clear();
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant && stream) {
        const isMobile = participant.isMobile || false;
        sendStreamToTransmission(participantId, stream, isMobile);
      }
    });
  };

  return {
    sendStreamToTransmission,
    updateTransmissionParticipants,
    forceRetransmitStreams
  };
};