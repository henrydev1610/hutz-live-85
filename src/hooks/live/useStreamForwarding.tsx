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

      // CRITICAL: Store streams in multiple locations for reliability
      if (!window.sharedParticipantStreams) {
        window.sharedParticipantStreams = {};
      }

      // NEVER clear active streams - only add/update them
      // Create backup in multiple locations
      if (!window.streamBackup) {
        window.streamBackup = {};
      }

      selectedParticipants.forEach(participant => {
        const stream = participantStreams[participant.id];
        
        if (stream && stream.getTracks().length > 0) {
          // Validate stream tracks are still active
          const activeTracks = stream.getTracks().filter(track => track.readyState === 'live');
          
          if (activeTracks.length > 0) {
            console.log(`✅ STREAM FORWARDING: Sharing stream for ${participant.id} with ${activeTracks.length} active tracks`);
            
            // CRITICAL: Store in multiple locations for reliability
            window.sharedParticipantStreams[participant.id] = stream;
            window.streamBackup[participant.id] = stream;
            
            // CRITICAL: Ensure transmission window can access the stream
            if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
              // Direct assignment to transmission window's global scope
              try {
                if (!transmissionWindowRef.current.sharedParticipantStreams) {
                  transmissionWindowRef.current.sharedParticipantStreams = {};
                }
                transmissionWindowRef.current.sharedParticipantStreams[participant.id] = stream;
                console.log(`📡 STREAM FORWARDING: Assigned stream directly to transmission window for ${participant.id}`);
              } catch (error) {
                console.warn(`⚠️ STREAM FORWARDING: Could not assign stream directly:`, error);
              }
              
              // Send stream notification via postMessage
              transmissionWindowRef.current.postMessage({
                type: 'participant-stream-ready',
                participantId: participant.id,
                hasStream: true,
                trackCount: activeTracks.length,
                streamId: stream.id,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
                streamActive: true,
                timestamp: Date.now()
              }, '*');
              
              console.log(`📡 STREAM FORWARDING: Sent stream notification for ${participant.id}`);
            }
          } else {
            console.log(`⚠️ STREAM FORWARDING: Stream for ${participant.id} has no active tracks`);
          }
        } else {
          console.log(`⚠️ STREAM FORWARDING: No stream available for ${participant.id}`);
        }
      });

      // Debug: Log shared streams status
      const sharedCount = Object.keys(window.sharedParticipantStreams).length;
      console.log(`📊 STREAM FORWARDING: Shared ${sharedCount} streams globally`);
      console.log(`📊 STREAM FORWARDING: Shared stream IDs:`, Object.keys(window.sharedParticipantStreams));

      // Send consolidated update to transmission window
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'bulk-stream-update',
          participants: selectedParticipants.map(p => ({
            id: p.id,
            name: p.name,
            hasStream: !!participantStreams[p.id],
            streamActive: participantStreams[p.id]?.getTracks().filter(t => t.readyState === 'live').length > 0
          })),
          sharedStreams: sharedCount,
          timestamp: Date.now()
        }, '*');
      }

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
    };

    // Forward streams immediately and then every 2 seconds
    forwardStreams();
    
    streamForwardingTimerRef.current = setInterval(forwardStreams, 2000);

    // CRITICAL: Add message handler for stream requests from transmission window
    const handleStreamRequest = (event: MessageEvent) => {
      if (event.source === transmissionWindowRef.current && event.data.type === 'request-participant-stream') {
        const { participantId } = event.data;
        console.log(`📡 STREAM FORWARDING: Received stream request for ${participantId}`);
        
        const stream = participantStreams[participantId];
        if (stream && stream.getTracks().length > 0) {
          // Ensure it's available in shared location
          window.sharedParticipantStreams[participantId] = stream;
          
          // Try direct assignment
          try {
            if (!transmissionWindowRef.current.sharedParticipantStreams) {
              transmissionWindowRef.current.sharedParticipantStreams = {};
            }
            transmissionWindowRef.current.sharedParticipantStreams[participantId] = stream;
          } catch (error) {
            console.warn(`⚠️ STREAM FORWARDING: Could not assign stream directly:`, error);
          }
          
          // Respond with stream notification
          transmissionWindowRef.current.postMessage({
            type: 'participant-stream-ready',
            participantId: participantId,
            hasStream: true,
            trackCount: stream.getTracks().length,
            streamId: stream.id,
            timestamp: Date.now()
          }, '*');
          
          console.log(`✅ STREAM FORWARDING: Responded to stream request for ${participantId}`);
        } else {
          console.log(`⚠️ STREAM FORWARDING: No stream available for requested ${participantId}`);
        }
      }
    };

    window.addEventListener('message', handleStreamRequest);

    return () => {
      if (streamForwardingTimerRef.current) {
        clearInterval(streamForwardingTimerRef.current);
        streamForwardingTimerRef.current = null;
      }
      window.removeEventListener('message', handleStreamRequest);
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