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

  // CRITICAL: Handle stream transmission with MOBILE PRIORITY
  const sendStreamToTransmission = (participantId: string, stream: MediaStream, isMobile: boolean = false) => {
    const participant = participantList.find(p => p.id === participantId);
    if (!participant) {
      console.warn(`⚠️ STREAM TRANSMISSION: Participant ${participantId} not found in list`);
      return;
    }

    const streamKey = `${participantId}-${stream.id}`;
    
    // MOBILE STREAMS: Always re-send to ensure priority
    if (isMobile) {
      console.log(`📱 STREAM TRANSMISSION: FORCE sending MOBILE stream for ${participantId} (priority override)`);
    } else if (sentStreamsRef.current.has(streamKey)) {
      console.log(`🔄 STREAM TRANSMISSION: Non-mobile stream ${streamKey} already sent, skipping`);
      return;
    }

    console.log(`🎯 STREAM TRANSMISSION: Sending ${isMobile ? '📱 MOBILE' : '💻 DESKTOP'} stream for ${participantId}`);

    // Send via broadcast channel WITH PRIORITY FLAG
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

    // CRITICAL: Send via window postMessage with IMMEDIATE RETRY for mobile
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const message = {
        type: 'webrtc-stream',
        participantId,
        stream,
        isMobile,
        priorityMobile: isMobile,
        timestamp: Date.now()
      };
      
      transmissionWindowRef.current.postMessage(message, '*');
      
      // MOBILE RETRY: Ensure mobile streams are delivered
      if (isMobile) {
        setTimeout(() => {
          if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
            transmissionWindowRef.current.postMessage(message, '*');
            console.log(`🔄 STREAM TRANSMISSION: MOBILE stream retry sent for ${participantId}`);
          }
        }, 500);
      }
    }

    sentStreamsRef.current.add(streamKey);
    console.log(`✅ STREAM TRANSMISSION: ${isMobile ? '📱 MOBILE' : '💻 DESKTOP'} stream sent for ${participantId}`);
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