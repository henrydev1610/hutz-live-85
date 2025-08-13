import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';

const hostPeerConnections = new Map<string, RTCPeerConnection>();

function logIceType(prefix: string, cand?: string) {
  if (!cand) return;
  const typ = /typ (\w+)/.exec(cand)?.[1];
  console.log(`${prefix} ICE typ: ${typ} | ${cand}`);
}

function getOrCreatePC(participantId: string) {
  let pc = hostPeerConnections.get(participantId);
  if (pc) return pc;

  const base = getActiveWebRTCConfig();

  // Se quiser forçar TURN (enquanto valida): descomente a linha abaixo
  // const config = { ...base, iceTransportPolicy: 'relay' as RTCIceTransportPolicy };
  const config = { ...base };

  pc = new RTCPeerConnection(config);
  hostPeerConnections.set(participantId, pc);

  // HOST só recebe mídia
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    console.log('📡 [HOST] Transceivers recvonly adicionados');
  } catch (err) {
    console.warn('⚠️ [HOST] Erro ao adicionar transceivers:', err);
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      logIceType('🧊 [HOST→PART]', event.candidate.candidate);
      unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
    } else {
      console.log('🧊 [HOST] ICE gathering completo para:', participantId);
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    console.log('🎥 [HOST] ontrack de', participantId, 'streamId:', stream?.id, {
      tracks: stream?.getTracks().length,
    });

    if (stream && typeof window !== 'undefined' && window.hostStreamCallback) {
      // Entrega o stream para o hook do host (atualiza estado + envia para popup)
      window.hostStreamCallback(participantId, stream);
    }

    // Evento opcional para outros listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('host-stream-received', { detail: { participantId, stream } })
      );
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`🔌 [HOST] PC(${participantId}) state:`, pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 [HOST] ICE state(${participantId}):`, pc.iceConnectionState);
  };

  return pc;
}

/**
 * FASE B: Host recebe OFFER do participante e responde com ANSWER
 * Protocolo padronizado: { roomId, fromUserId, targetUserId, offer, timestamp }
 */
export async function handleOfferFromParticipant(data: any) {
  const participantId = data?.fromUserId;
  const offer = data?.offer;

  if (!participantId || !offer?.sdp || !offer?.type) {
    console.warn('⚠️ [HOST] Offer inválido - formato esperado: {fromUserId, offer:{sdp,type}}:', data);
    return;
  }

  console.log('📩 [HOST] Offer PADRONIZADO recebido de', participantId, {
    roomId: data.roomId,
    offerType: offer.type,
    timestamp: data.timestamp
  });

  const pc = getOrCreatePC(participantId);

  if (pc.signalingState !== 'stable') {
    console.warn('⚠️ [HOST] signalingState != stable:', pc.signalingState);
  }

  try {
    await pc.setRemoteDescription(offer);
    console.log('✅ [HOST] Remote description aplicada');

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('✅ [HOST] Local description definida');

    unifiedWebSocketService.sendWebRTCAnswer(participantId, answer.sdp!, answer.type);
    console.log('✅ [HOST] Answer PADRONIZADA enviada para', participantId);
  } catch (err) {
    console.error('❌ [HOST] Erro processando offer de', participantId, err);
  }
}

/**
 * FASE B: Host recebe CANDIDATE do participante
 * Protocolo padronizado: { roomId, fromUserId, targetUserId, candidate, timestamp }
 */
export async function handleRemoteCandidate(data: any) {
  const participantId = data?.fromUserId;
  const candidate = data?.candidate;

  if (!participantId || !candidate) {
    console.warn('⚠️ [HOST] Candidate inválido - formato esperado: {fromUserId, candidate}:', data);
    return;
  }

  const pc = hostPeerConnections.get(participantId);
  if (!pc) {
    console.warn('⚠️ [HOST] Candidate recebido sem PC para', participantId);
    return;
  }

  try {
    logIceType('🧊 [PART→HOST]', candidate.candidate);
    await pc.addIceCandidate(candidate);
    console.log('✅ [HOST] ICE candidate PADRONIZADO adicionado de', participantId);
  } catch (err) {
    console.error('❌ [HOST] addIceCandidate falhou para', participantId, err);
  }
}

/** FASE D: Registra listeners de sinalização no socket (uma vez) */
function setupHostHandlers() {
  if (!unifiedWebSocketService) {
    console.error('❌ [HOST] unifiedWebSocketService não inicializado');
    return;
  }

  // Participante → HOST: offer
  unifiedWebSocketService.on('webrtc-offer', (payload: any) => {
    console.log('📥 [HOST] Recebendo webrtc-offer:', payload);
    handleOfferFromParticipant(payload);
  });

  // Participante → HOST: candidate
  unifiedWebSocketService.on('webrtc-candidate', (payload: any) => {
    console.log('📥 [HOST] Recebendo webrtc-candidate:', payload);
    handleRemoteCandidate(payload);
  });

  console.log('📡 [HOST] Handlers de sinalização PADRONIZADOS registrados');
}

/** FASE F: Solicitar offer de um participante específico */
export function requestOfferFromParticipant(participantId: string) {
  if (!unifiedWebSocketService) {
    console.error('❌ [HOST] unifiedWebSocketService não disponível');
    return;
  }

  console.log('🚀 [HOST] Solicitando offer do participante:', participantId);
  unifiedWebSocketService.requestOfferFromParticipant(participantId);
}

// Inicializa handlers uma vez
if (typeof window !== 'undefined' && !(window as any).__hostHandlersSetup) {
  setupHostHandlers();
  (window as any).__hostHandlersSetup = true;
}

/** Cleanup por participante */
export function cleanupHostHandshake(participantId: string) {
  const pc = hostPeerConnections.get(participantId);
  if (pc) {
    try {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    } catch {}
    hostPeerConnections.delete(participantId);
    console.log('🧹 [HOST] Cleanup PC de', participantId);
  }
}

/** Mantido para compatibilidade: não deve mais ser usado (host não inicia offer) */
export async function startHostHandshakeFor(_participantId: string) {
  console.warn('⚠️ [HOST] startHostHandshakeFor() está obsoleto. O host agora só responde a offers.');
}

// Tipagem global
declare global {
  interface Window {
    hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
    __hostHandlersSetup?: boolean;
  }
}
