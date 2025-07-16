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

    // Initialize broadcast channel
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

  // CRITICAL: Create shared stream reference for transmission window
  useEffect(() => {
    if (!sessionId || !transmissionWindowRef.current) return;

    // Create a global shared reference for streams
    if (!window.sharedParticipantStreams) {
      window.sharedParticipantStreams = {};
    }

    const forwardStreams = () => {
      const selectedParticipants = participantList.filter(p => p.selected && p.hasVideo);
      
      console.log(`🎥 STREAM FORWARDING: Processing ${selectedParticipants.length} selected participants`);
      console.log(`🎥 STREAM FORWARDING: Available streams:`, Object.keys(participantStreams));

      // Clear old streams but preserve active ones
      const previousStreams = { ...window.sharedParticipantStreams };
      window.sharedParticipantStreams = {};

      selectedParticipants.forEach(participant => {
        const stream = participantStreams[participant.id];
        
        if (stream && stream.getTracks().length > 0) {
          // Validate stream tracks are still active
          const activeTracks = stream.getTracks().filter(track => track.readyState === 'live');
          
          if (activeTracks.length > 0) {
            console.log(`✅ STREAM FORWARDING: Sharing stream for ${participant.id} with ${activeTracks.length} active tracks`);
            
            // Share stream reference globally
            window.sharedParticipantStreams[participant.id] = stream;
            
            // Send notification to transmission window with enhanced data
            if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
              transmissionWindowRef.current.postMessage({
                type: 'participant-stream-ready',
                participantId: participant.id,
                hasStream: true,
                trackCount: activeTracks.length,
                streamId: stream.id,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
                streamActive: activeTracks.length > 0,
                timestamp: Date.now()
              }, '*');
            }
          } else {
            console.log(`⚠️ STREAM FORWARDING: Stream for ${participant.id} has no active tracks`);
          }
        } else {
          console.log(`⚠️ STREAM FORWARDING: No stream available for ${participant.id}`);
        }
      });

      // Log shared streams status
      const sharedCount = Object.keys(window.sharedParticipantStreams).length;
      console.log(`📊 STREAM FORWARDING: Shared ${sharedCount} streams globally`);

      // Send participants update via BroadcastChannel
      broadcastChannelRef.current?.postMessage({
        type: 'update-participants',
        participants: participantList.map(p => ({
          id: p.id,
          name: p.name,
          selected: p.selected,
          hasVideo: p.hasVideo,
          active: p.active
        })),
        selectedWithVideo: selectedParticipants.length,
        sharedStreams: sharedCount,
        timestamp: Date.now()
      });

      // Also send via postMessage with enhanced data
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: participantList.map(p => ({
            id: p.id,
            name: p.name,
            selected: p.selected,
            hasVideo: p.hasVideo,
            active: p.active
          })),
          selectedWithVideo: selectedParticipants.length,
          sharedStreams: sharedCount,
          timestamp: Date.now()
        }, '*');
      }
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
    
    // Update shared streams
    if (!window.sharedParticipantStreams) {
      window.sharedParticipantStreams = {};
    }
    
    selectedParticipants.forEach(participant => {
      const stream = participantStreams[participant.id];
      
      if (stream && stream.getTracks().length > 0) {
        console.log(`🔄 STREAM FORWARDING: Force updating stream for ${participant.id}`);
        
        // Update shared reference
        window.sharedParticipantStreams[participant.id] = stream;
        
        // Send notification
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          transmissionWindowRef.current.postMessage({
            type: 'force-stream-update',
            participantId: participant.id,
            hasStream: true,
            trackCount: stream.getTracks().length,
            streamId: stream.id,
            timestamp: Date.now()
          }, '*');
        }
      }
    });
  };

  return {
    forceStreamUpdate
  };
};