import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';

const hostPeerConnections = new Map<string, RTCPeerConnection>();
const pendingCandidates = new Map<string, RTCIceCandidate[]>();

function logIceType(prefix: string, cand?: string) {
  if (!cand) return;
  const typ = /typ (\w+)/.exec(cand)?.[1];
  console.log(`${prefix} ICE typ: ${typ} | ${cand}`);
}

function getOrCreatePC(participantId: string) {
  let pc = hostPeerConnections.get(participantId);
  if (pc) {
    console.log('📡 [HOST] Reutilizando PC existente para:', participantId, 'state:', pc.signalingState);
    return pc;
  }

  const base = getActiveWebRTCConfig();
  const config = { ...base };

  pc = new RTCPeerConnection(config);
  hostPeerConnections.set(participantId, pc);

  // CRÍTICO: HOST só recebe mídia - transceivers ANTES de qualquer descrição
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    console.log('📡 [HOST] Transceivers recvonly adicionados ANTES das descrições');
  } catch (err) {
    console.warn('⚠️ [HOST] Erro ao adicionar transceivers:', err);
  }

  // Inicializar buffer de candidates
  pendingCandidates.set(participantId, []);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      logIceType('🧊 [HOST→PART]', event.candidate.candidate);
      const candidateType = /typ (\w+)/.exec(event.candidate.candidate)?.[1] || 'unknown';
      console.log(`[HOST-ICE] candidateType=${candidateType} iceConnectionState=${pc.iceConnectionState}`);
      unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
    } else {
      console.log('🧊 [HOST] ICE gathering completo para:', participantId);
      console.log(`[HOST-ICE] gathering=complete iceConnectionState=${pc.iceConnectionState}`);
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    const videoTracks = stream?.getVideoTracks().length || 0;
    const audioTracks = stream?.getAudioTracks().length || 0;
    
    console.log(`HOST-ONTRACK {participantId=${participantId}, streamId=${stream?.id}}`);

    if (stream) {
      try {
        // FAILSAFE: Sempre salvar stream em __mlStreams__
        if (typeof window !== 'undefined') {
          if (!window.__mlStreams__) {
            window.__mlStreams__ = new Map();
          }
          window.__mlStreams__.set(participantId, stream);
          console.log(`[HOST-ONTRACK] stream saved to __mlStreams__ participantId=${participantId} mapSize=${window.__mlStreams__.size}`);
        }

        // FAILSAFE: Sempre invocar callback se existir
        if (typeof window !== 'undefined' && window.hostStreamCallback) {
          window.hostStreamCallback(participantId, stream);
          console.log(`HOST-CALLBACK-READY {participantId=${participantId}, streamId=${stream.id}}`);
        }

        // FAILSAFE: Sempre fazer postMessage para popup
        if (typeof window !== 'undefined') {
          window.postMessage({
            type: 'participant-stream-ready',
            participantId: participantId
          }, '*');
          console.log(`[HOST-ONTRACK] postMessage sent participantId=${participantId}`);
        }

      } catch (error) {
        console.error(`[HOST-ONTRACK] error participantId=${participantId}:`, error);
      }
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`🔌 [HOST] PC(${participantId}) state:`, pc.connectionState);
    console.log(`[HOST-ICE] connection=${pc.connectionState}`);
  };
  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 [HOST] ICE state(${participantId}):`, pc.iceConnectionState);
    console.log(`[HOST-ICE] iceConnectionState=${pc.iceConnectionState}`);
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

  console.log(`HOST-OFFER-RECEIVED {sdpLen=${offer.sdp?.length || 0}}`);
  console.log(`[HOST-RECV] webrtc-offer from=${participantId} sdpLen=${offer.sdp?.length || 0} signalingState=checking...`);
  console.log('📩 [HOST] Offer PADRONIZADO recebido de', participantId, {
    roomId: data.roomId,
    offerType: offer.type,
    timestamp: data.timestamp,
    signalingState: 'checking...'
  });

  const pc = getOrCreatePC(participantId);

  // CRÍTICO: Verificar estado antes de aplicar offer
  if (pc.signalingState !== 'stable') {
    console.warn('⚠️ [HOST] signalingState != stable:', pc.signalingState, '- Forçando reset');
    try {
      pc.close();
      hostPeerConnections.delete(participantId);
      const newPc = getOrCreatePC(participantId);
      console.log('✅ [HOST] PC resetado, novo state:', newPc.signalingState);
    } catch (resetErr) {
      console.error('❌ [HOST] Erro no reset do PC:', resetErr);
      return;
    }
  }

  const finalPc = hostPeerConnections.get(participantId)!;

  try {
    console.log('🔄 [HOST] Aplicando setRemoteDescription, state atual:', finalPc.signalingState);
    await finalPc.setRemoteDescription(offer);
    console.log(`[HOST-APPLY] setRemoteDescription ok signalingState=${finalPc.signalingState}`);
    console.log('✅ [HOST] Remote description aplicada, novo state:', finalPc.signalingState);

    console.log('🔄 [HOST] Criando answer...');
    const answer = await finalPc.createAnswer();
    console.log(`HOST-ANSWER-CREATED {sdpLen=${answer.sdp?.length || 0}}`);
    
    await finalPc.setLocalDescription(answer);
    console.log('✅ [HOST] Local description definida, state final:', finalPc.signalingState);

    // Aplicar candidates em buffer
    const buffered = pendingCandidates.get(participantId) || [];
    if (buffered.length > 0) {
      console.log(`🧊 [HOST] Aplicando ${buffered.length} candidates em buffer`);
      for (const candidate of buffered) {
        try {
          await finalPc.addIceCandidate(candidate);
        } catch (err) {
          console.warn('⚠️ [HOST] Erro aplicando candidate em buffer:', err);
        }
      }
      pendingCandidates.set(participantId, []);
    }

    unifiedWebSocketService.sendWebRTCAnswer(participantId, answer.sdp!, answer.type);
    console.log('HOST-ANSWER-SENT');
    console.log(`[HOST-ANSWER] sent to=${participantId} sdpLen=${answer.sdp?.length || 0}`);
    console.log('✅ [HOST] Answer PADRONIZADA enviada para', participantId);
  } catch (err) {
    console.error('❌ [HOST] Erro processando offer de', participantId, err);
    // Log específico para erro de m-lines
    if (err instanceof Error && err.message.includes('m-lines')) {
      console.error('🚨 [HOST] ERRO M-LINES DETECTADO - Problema na ordem dos transceivers');
    }
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

  // BUFFER ICE: Aplicar apenas após setRemoteDescription
  if (pc.remoteDescription) {
    try {
      logIceType('🧊 [PART→HOST]', candidate.candidate);
      await pc.addIceCandidate(candidate);
      console.log('✅ [HOST] ICE candidate PADRONIZADO adicionado de', participantId);
    } catch (err) {
      console.error('❌ [HOST] addIceCandidate falhou para', participantId, err);
    }
  } else {
    // Buffer para aplicar depois do setRemoteDescription
    const buffer = pendingCandidates.get(participantId) || [];
    buffer.push(candidate);
    pendingCandidates.set(participantId, buffer);
    logIceType('🧊 [PART→HOST] BUFFERED', candidate.candidate);
    console.log(`📦 [HOST] Candidate bufferizado para ${participantId} (total: ${buffer.length})`);
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

/** ETAPA 2: REMOVIDO DEFINITIVAMENTE - Host nunca cria offers */
// export async function startHostHandshakeFor() - FUNÇÃO REMOVIDA PERMANENTEMENTE

// Tipagem global
declare global {
  interface Window {
    hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
    __hostHandlersSetup?: boolean;
  }
}
