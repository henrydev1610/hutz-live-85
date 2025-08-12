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
 * Host recebe OFFER do participante, responde com ANSWER.
 * Aceita payloads nos formatos:
 *  - { from: string, sdp: string, type: string }
 *  - { fromUserId: string, offer: { sdp, type } }
 *  - { from: string, offer: { sdp, type } }
 */
export async function handleOfferFromParticipant(data: any) {
  const participantId = data?.fromUserId || data?.from;
  const offer: RTCSessionDescriptionInit =
    data?.offer || (data?.sdp && data?.type ? { sdp: data.sdp, type: data.type } : null);

  if (!participantId || !offer?.sdp || !offer?.type) {
    console.warn('⚠️ [HOST] Offer inválido:', data);
    return;
  }

  console.log('📩 [HOST] Offer recebido de', participantId, offer.type);

  const pc = getOrCreatePC(participantId);

  if (pc.signalingState !== 'stable') {
    console.warn('⚠️ [HOST] signalingState != stable:', pc.signalingState);
  }

  try {
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    unifiedWebSocketService.sendWebRTCAnswer(participantId, answer.sdp!, answer.type);
    console.log('✅ [HOST] Answer enviada para', participantId);
  } catch (err) {
    console.error('❌ [HOST] Erro processando offer de', participantId, err);
  }
}

/**
 * Host recebe CANDIDATE do participante.
 * Aceita payloads nos formatos:
 *  - { from: string, candidate: RTCIceCandidateInit }
 *  - { fromUserId: string, candidate: RTCIceCandidateInit }
 *  - { from: string, iceCandidate: RTCIceCandidateInit }
 */
export async function handleRemoteCandidate(data: any) {
  const participantId = data?.fromUserId || data?.from;
  const candidate: RTCIceCandidateInit = data?.candidate || data?.iceCandidate;

  if (!participantId || !candidate) {
    console.warn('⚠️ [HOST] Candidate inválido:', data);
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
  } catch (err) {
    console.error('❌ [HOST] addIceCandidate falhou para', participantId, err);
  }
}

/** Registra listeners de sinalização no socket (uma vez) */
function setupHostHandlers() {
  // CORREÇÃO CRÍTICA: Verificar se service está inicializado antes de adicionar listeners
  if (!unifiedWebSocketService || !unifiedWebSocketService.isConnected()) {
    console.error('❌ CRITICAL: unifiedWebSocketService not initialized in setupHostHandlers');
    return;
  }
  
  console.log('📡 [HOST] Setting up handlers after WebSocket connection confirmed');
  
  // Participante → HOST: offer
  unifiedWebSocketService.on('webrtc-offer', (payload: any) => {
    handleOfferFromParticipant(payload);
  });

  // Participante → HOST: candidate
  unifiedWebSocketService.on('webrtc-candidate', (payload: any) => {
    handleRemoteCandidate(payload);
  });

  console.log('📡 [HOST] Handlers de sinalização registrados (offer, candidate).');
}

// CORREÇÃO CRÍTICA: NÃO inicializar automaticamente
// Handlers devem ser configurados apenas quando WebSocket estiver conectado
// if (typeof window !== 'undefined' && !(window as any).__hostHandlersSetup) {
//   setupHostHandlers();
//   (window as any).__hostHandlersSetup = true;
// }

// Export função para configurar handlers quando necessário
export { setupHostHandlers };

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
