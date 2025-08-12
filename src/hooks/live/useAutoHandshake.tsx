import { useEffect, useRef } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface UseAutoHandshakeProps {
  isHost: boolean;
  sessionId: string | null;
  /** Chamado ainda se você quiser fazer algo extra ao solicitar handshake (opcional) */
  onHandshakeRequest?: (participantId: string) => void;
}


export const useAutoHandshake = ({
  isHost,
  sessionId,
  onHandshakeRequest,
}: UseAutoHandshakeProps) => {
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Map<string, number | ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!isHost || !sessionId) return;

    const MAX_ATTEMPTS = 3;
    const RETRY_MS = 3000;

    const clearRetry = (participantId: string) => {
      const t = timersRef.current.get(participantId);
      if (t) {
        clearTimeout(t as number);
        timersRef.current.delete(participantId);
      }
      attemptsRef.current.delete(participantId);
    };

    const requestOffer = (participantId: string, reason: string) => {
      const current = attemptsRef.current.get(participantId) ?? 0;
      if (current >= MAX_ATTEMPTS) {
        console.warn(`❌ AUTO-HANDSHAKE: Máx. tentativas atingido para ${participantId}`);
        return;
      }

      attemptsRef.current.set(participantId, current + 1);

      // Envia a solicitação para o participante criar/enviar um OFFER
      const roomId =
        (unifiedWebSocketService as any)?.getCurrentRoomId?.() ||
        sessionId ||
        undefined;

      const payload = {
        roomId,
        targetUserId: participantId,
        fromUserId: 'host',
        reason,
        timestamp: Date.now(),
      };

      console.log('📨 AUTO-HANDSHAKE: Solicitando OFFER ao participante', payload);
      // Utilize a API genérica do serviço caso não exista um helper dedicado
      (unifiedWebSocketService as any)?.sendMessage?.('webrtc-request-offer', payload);

      // Callback opcional do chamador (para side-effects locais)
      onHandshakeRequest?.(participantId);

      // Programa retry se necessário
      const timer = setTimeout(() => {
        console.log(
          `⏳ AUTO-HANDSHAKE: Retry #${current + 1} para ${participantId} (aguardando offer/stream)`
        );
        requestOffer(participantId, 'retry-timeout');
      }, RETRY_MS);

      timersRef.current.set(participantId, timer);
    };

    // 1) Listener do seu evento interno para iniciar o ciclo
    const handleAutoHandshake = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail || {};
      const participantId: string | undefined = detail.participantId;

      if (!participantId) {
        console.warn('⚠️ AUTO-HANDSHAKE: Evento sem participantId:', detail);
        return;
      }

      // Evitar múltiplos ciclos simultâneos para o mesmo participante
      if (attemptsRef.current.has(participantId)) {
        console.log('ℹ️ AUTO-HANDSHAKE: Ciclo já em andamento para', participantId);
        return;
      }

      console.log('🤝 AUTO-HANDSHAKE: Iniciando para', participantId);
      requestOffer(participantId, 'initial');
    };

    window.addEventListener('auto-handshake-request', handleAutoHandshake as EventListener);

    // 2) Se o host recebeu stream (ontrack), paramos retries
    const handleHostStreamReceived = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail || {};
      const participantId: string | undefined = detail.participantId;
      if (!participantId) return;

      console.log('✅ AUTO-HANDSHAKE: Stream recebido; cancelando retries para', participantId);
      clearRetry(participantId);
    };
    window.addEventListener('host-stream-received', handleHostStreamReceived as EventListener);

    // 3) Se chegou um OFFER no socket, paramos retries (o HostHandshake responderá com ANSWER)
    const offerHandler = (payload: any) => {
      const from = payload?.fromUserId || payload?.from;
      if (!from) return;
      console.log('📥 AUTO-HANDSHAKE: webrtc-offer recebido de', from, '→ parar retries');
      clearRetry(from);
    };

    // Dependendo do seu EventEmitter, pode ser .on/.off
    (unifiedWebSocketService as any)?.on?.('webrtc-offer', offerHandler);

    console.log('🎯 AUTO-HANDSHAKE: Listeners registrados (host)');

    return () => {
      window.removeEventListener('auto-handshake-request', handleAutoHandshake as EventListener);
      window.removeEventListener('host-stream-received', handleHostStreamReceived as EventListener);

      (unifiedWebSocketService as any)?.off?.('webrtc-offer', offerHandler);

      // Limpa timers pendentes
      timersRef.current.forEach((t) => clearTimeout(t as number));
      timersRef.current.clear();
      attemptsRef.current.clear();

      console.log('🧹 AUTO-HANDSHAKE: Listeners removidos e retries limpos');
    };
  }, [isHost, sessionId, onHandshakeRequest]);
};
