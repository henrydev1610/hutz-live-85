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
      // FASE C: Garantir ponte Host → Popup
      if (typeof window !== 'undefined') {
        if (!window.__mlStreams__) window.__mlStreams__ = new Map();
        window.__mlStreams__.set(participantId, stream);
        console.log(`[HOST-BRIDGE] window.__mlStreams__.set participantId=${participantId} streamId=${stream.id} tracks=${stream.getTracks().length}`);

        // FASE C: Implementar window.getParticipantStream() de forma robusta
        if (typeof window.getParticipantStream !== 'function') {
          window.getParticipantStream = (id: string) => {
            const stream = window.__mlStreams__?.get(id) ?? null;
            console.log('🔍 PONTE HOST→POPUP: getParticipantStream solicitado para:', id, {
              found: !!stream,
              streamActive: stream?.active,
              videoTracks: stream?.getVideoTracks().length || 0,
              audioTracks: stream?.getAudioTracks().length || 0,
              mapSize: window.__mlStreams__?.size || 0,
              availableIds: Array.from(window.__mlStreams__?.keys() || [])
            });
            console.log(`[HOST-BRIDGE] window.getParticipantStream registered participantId=${id} found=${!!stream}`);
            return stream;
          };
          console.log('✅ PONTE HOST→POPUP: window.getParticipantStream registrado globalmente');
        }

        // FASE C: Garantir que hostStreamCallback é ativo
        if (typeof window.hostStreamCallback !== 'function') {
          console.warn('⚠️ PONTE HOST→POPUP: window.hostStreamCallback não definido ainda');
        }
      }

      console.log('📡 CRITICAL SUCCESS: Stream registrado no host para:', participantId, {
        tracks: stream.getTracks().length,
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length,
        streamId: stream.id,
        active: stream.active
      });

      // FASE 3: Critical validation logging
      ProtocolValidationLogger.logStreamRegistration(participantId, stream);

      // 2) NOTIFICA A POPUP (apenas metadados / sinalização)
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        console.log(`[POPUP-BRIDGE] sending postMessage type=participant-stream-ready participantId=${participantId}`);
        transmissionWindowRef.current.postMessage({
          type: 'participant-stream-ready',
          participantId,
          // só metadados; a popup vai chamar window.opener.getParticipantStream(id)
          streamInfo: {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            hasVideo: stream.getVideoTracks().length > 0
          },
          timestamp: Date.now()
        }, '*');
        console.log('✅ Notificação enviada à transmission window (postMessage)');
      } else {
        console.log('ℹ️ Transmission window não disponível (ok em preview/fechada)');
      }

      // 3) BroadcastChannel (opcional / redundância)
      if (typeof window !== 'undefined') {
        const sessionId = window.sessionStorage?.getItem('currentSessionId');
        if (sessionId) {
          const channel = new BroadcastChannel(`live-session-${sessionId}`);
          channel.postMessage({
            type: 'video-stream',
            participantId,
            hasStream: true,
            streamActive: stream.active,
            trackCount: stream.getTracks().length,
            videoTrackCount: stream.getVideoTracks().length,
            timestamp: Date.now()
          });
          console.log('✅ Notificação enviada via BroadcastChannel');
          setTimeout(() => channel.close(), 1000);
        }
      }

      // 4) LIMPEZA AUTOMÁTICA QUANDO O TRACK ACABAR
      const handleEnded = () => {
        if (window.__mlStreams__) {
          window.__mlStreams__.delete(participantId);
        }
      };
      stream.getTracks().forEach(t => t.addEventListener('ended', handleEnded));

    } catch (error) {
      console.error('❌ Failed to send stream to transmission:', error);
    }
  }, []);

  return { sendStreamToTransmission };
};
