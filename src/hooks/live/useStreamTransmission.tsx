import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { ProtocolValidationLogger } from '@/utils/webrtc/ProtocolValidationLogger';

declare global {
  interface Window {
    /** Registro global dos streams ativos por participante */
    __mlStreams__?: Map<string, MediaStream>;
    /** Exposição para a popup buscar o stream pelo id */
    getParticipantStream?: (participantId: string) => MediaStream | null | undefined;
    /** Callback do host para receber streams via WebRTC */
    hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
  }
}

export const useStreamTransmission = () => {
  const sendStreamToTransmission = useCallback((
    participantId: string,
    stream: MediaStream,
    transmissionWindowRef: MutableRefObject<Window | null>
  ) => {
    try {
      console.log('📡 STREAM TRANSMISSION: Processing stream for:', participantId, {
        streamId: stream.id,
        streamActive: stream.active,
        tracksCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        windowAvailable: !!transmissionWindowRef.current
      });

      // Initialize global streams map if not exists
      if (!window.__mlStreams__) {
        window.__mlStreams__ = new Map<string, MediaStream>();
        console.log('🗺️ STREAM TRANSMISSION: Initialized global streams map');
      }

      // Register stream globally on the HOST window
      window.__mlStreams__.set(participantId, stream);
      console.log('🗺️ STREAM TRANSMISSION: Stream registered in global map:', participantId);

      // Ensure getParticipantStream function is available with enhanced logging
      if (typeof window.getParticipantStream !== 'function') {
        console.log('🔧 STREAM TRANSMISSION: Creating getParticipantStream function');
        window.getParticipantStream = (pid: string) => {
          const streamFromMap = window.__mlStreams__?.get(pid) || null;
          console.log(`🔍 STREAM TRANSMISSION: getParticipantStream called for ${pid}:`, {
            found: !!streamFromMap,
            streamId: streamFromMap?.id,
            streamActive: streamFromMap?.active,
            tracksCount: streamFromMap?.getTracks()?.length || 0,
            mapSize: window.__mlStreams__?.size || 0,
            availableIds: Array.from(window.__mlStreams__?.keys() || [])
          });
          return streamFromMap;
        };
        console.log('✅ STREAM TRANSMISSION: getParticipantStream function created');
      }

      // Critical validation logging
      ProtocolValidationLogger.logStreamRegistration(participantId, stream);

      // Send message to transmission window if available
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        const streamInfo = {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          hasVideo: stream.getVideoTracks().length > 0,
          timestamp: Date.now()
        };

        try {
          transmissionWindowRef.current.postMessage({
            type: 'participant-stream-ready',
            participantId,
            streamInfo
          }, '*');
          
          console.log('📡 STREAM TRANSMISSION: Message sent to transmission window:', {
            participantId,
            streamInfo
          });
        } catch (error) {
          console.error('❌ STREAM TRANSMISSION: Error sending message to window:', error);
        }
      } else {
        console.log('⚠️ STREAM TRANSMISSION: Transmission window not available yet, stream registered for later access');
      }

      // Enhanced BroadcastChannel with better error handling
      try {
        const sessionId = window.sessionStorage?.getItem('currentSessionId');
        const channel = new BroadcastChannel(sessionId ? `live-session-${sessionId}` : 'stream-updates');
        channel.postMessage({
          type: 'participant-stream-ready',
          participantId,
          streamId: stream.id,
          hasStream: true,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          videoTrackCount: stream.getVideoTracks().length,
          timestamp: Date.now()
        });
        console.log('📻 STREAM TRANSMISSION: Backup broadcast sent via BroadcastChannel');
        setTimeout(() => channel.close(), 1000);
      } catch (error) {
        console.warn('⚠️ STREAM TRANSMISSION: BroadcastChannel not available:', error);
      }

      // Add event listeners to clean up on stream end
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        const handleTrackEnd = () => {
          console.log(`🧹 STREAM TRANSMISSION: Track ended for ${participantId}, cleaning up`);
          if (window.__mlStreams__?.has(participantId)) {
            window.__mlStreams__.delete(participantId);
            console.log('🧹 STREAM TRANSMISSION: Removed from global map:', participantId);
          }
          track.removeEventListener('ended', handleTrackEnd);
        };
        track.addEventListener('ended', handleTrackEnd);
      });

      console.log('✅ STREAM TRANSMISSION: Stream processing completed for:', participantId);

    } catch (error) {
      console.error('❌ STREAM TRANSMISSION: Failed to send stream to transmission:', error);
    }
  }, []);

  return { sendStreamToTransmission };
};
