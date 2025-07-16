import { useEffect, useRef } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseStreamForwardingProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useStreamForwarding = ({
  participantStreams,
  participantList,
  sessionId,
  transmissionWindowRef
}: UseStreamForwardingProps) => {
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const streamForwardingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Initialize broadcast channel for real stream forwarding
    const channelName = `live-session-${sessionId}`;
    broadcastChannelRef.current = new BroadcastChannel(channelName);
    
    console.log(`📡 STREAM FORWARDING: Initialized broadcast channel: ${channelName}`);

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
      
      if (streamForwardingTimerRef.current) {
        clearInterval(streamForwardingTimerRef.current);
        streamForwardingTimerRef.current = null;
      }
    };
  }, [sessionId]);

  // CRITICAL: Forward real MediaStream objects to transmission window
  useEffect(() => {
    if (!broadcastChannelRef.current || !sessionId) return;

    const forwardStreams = () => {
      const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo);
      
      console.log(`🎥 STREAM FORWARDING: Processing ${selectedParticipants.length} selected participants`);

      selectedParticipants.forEach(participant => {
        const stream = participantStreams[participant.id];
        
        if (stream && stream.getTracks().length > 0) {
          console.log(`✅ STREAM FORWARDING: Forwarding stream for ${participant.id} with ${stream.getTracks().length} tracks`);
          
          // Send to transmission window via BroadcastChannel
          broadcastChannelRef.current?.postMessage({
            type: 'participant-stream-data',
            participantId: participant.id,
            hasStream: true,
            trackCount: stream.getTracks().length,
            streamId: stream.id,
            timestamp: Date.now()
          });

          // Also send via postMessage if transmission window is open
          if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
            transmissionWindowRef.current.postMessage({
              type: 'participant-stream-ready',
              participantId: participant.id,
              stream: stream, // This won't transfer the actual stream, but indicates it's ready
              streamId: stream.id
            }, '*');
          }
        } else {
          console.log(`⚠️ STREAM FORWARDING: No stream available for ${participant.id}`);
        }
      });

      // Send participants update
      broadcastChannelRef.current?.postMessage({
        type: 'update-participants',
        participants: participantList.map(p => ({
          id: p.id,
          name: p.name,
          selected: p.selected,
          hasVideo: p.hasVideo,
          active: p.active
        })),
        timestamp: Date.now()
      });
    };

    // Forward streams immediately and then every 2 seconds
    forwardStreams();
    
    streamForwardingTimerRef.current = setInterval(forwardStreams, 2000);

    return () => {
      if (streamForwardingTimerRef.current) {
        clearInterval(streamForwardingTimerRef.current);
        streamForwardingTimerRef.current = null;
      }
    };
  }, [participantStreams, participantList, sessionId, transmissionWindowRef]);

  const forceStreamUpdate = () => {
    console.log('🔄 STREAM FORWARDING: Forcing stream update...');
    
    if (!broadcastChannelRef.current) return;

    const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo);
    
    selectedParticipants.forEach(participant => {
      const stream = participantStreams[participant.id];
      
      if (stream && stream.getTracks().length > 0) {
        broadcastChannelRef.current?.postMessage({
          type: 'force-stream-update',
          participantId: participant.id,
          hasStream: true,
          trackCount: stream.getTracks().length,
          streamId: stream.id,
          timestamp: Date.now()
        });
      }
    });
  };

  return {
    forceStreamUpdate
  };
};