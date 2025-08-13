import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';

let participantPC: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

async function ensureLocalStream(): Promise<MediaStream> {
  if (!localStream || !localStream.active) {
    console.log('📹 [PARTICIPANT] Obtendo stream local...');
    
    try {
      // Tentar câmera traseira primeiro
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      console.log('📹 [PARTICIPANT] Stream traseira obtida');
    } catch (err) {
      console.warn('⚠️ [PARTICIPANT] Câmera traseira falhou, tentando frontal:', err);
      
      // Fallback para câmera frontal
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      console.log('📹 [PARTICIPANT] Stream frontal obtida');
    }
    
    console.log('📹 [PARTICIPANT] Stream local configurada:', {
      id: localStream.id,
      tracks: localStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
    });
  }
  
  return localStream;
}

// FASE B: Participante como OFFERER - aguarda solicitação do host
function setupParticipantHandlers() {
  if (!unifiedWebSocketService) {
    console.error('❌ [PARTICIPANT] unifiedWebSocketService não inicializado');
    return;
  }

  // FASE F: Receber solicitação de offer do host
  unifiedWebSocketService.on('request-offer', async (data: any) => {
    const hostId = data?.fromUserId;
    if (!hostId) {
      console.warn('⚠️ [PARTICIPANT] Solicitação de offer inválida:', data);
      return;
    }

    console.log('🚀 [PARTICIPANT] Solicitação de offer recebida do host:', hostId);
    await createAndSendOffer(hostId);
  });

  // Receber answer do host
  unifiedWebSocketService.on('webrtc-answer', async (data: any) => {
    const hostId = data?.fromUserId;
    const answer = data?.answer;

    if (!hostId || !answer?.sdp || !answer?.type) {
      console.warn('⚠️ [PARTICIPANT] Answer inválido - formato esperado: {fromUserId, answer:{sdp,type}}:', data);
      return;
    }

    console.log('📥 [PARTICIPANT] Answer PADRONIZADO recebido do host:', hostId);

    if (!participantPC) {
      console.warn('⚠️ [PARTICIPANT] Answer recebido sem PC ativo');
      return;
    }

    try {
      await participantPC.setRemoteDescription(answer);
      console.log('✅ [PARTICIPANT] Answer aplicado, conexão estabelecida');
    } catch (err) {
      console.error('❌ [PARTICIPANT] Erro aplicando answer:', err);
    }
  });

  // Receber ICE candidates do host
  unifiedWebSocketService.on('webrtc-candidate', async (data: any) => {
    const hostId = data?.fromUserId;
    const candidate = data?.candidate;
    
    if (!participantPC || !candidate) {
      console.warn('⚠️ [PARTICIPANT] PC ou candidate inválido de:', hostId);
      return;
    }

    try {
      await participantPC.addIceCandidate(candidate);
      const candidateType = /typ (\w+)/.exec(candidate.candidate)?.[1];
      console.log(`🧊 [PARTICIPANT] ICE candidate PADRONIZADO adicionado de ${hostId}, tipo: ${candidateType}`);
    } catch (err) {
      console.warn('⚠️ [PARTICIPANT] Erro ao adicionar candidate de:', hostId, err);
    }
  });
}

// FASE B: Criar offer e enviar para o host
async function createAndSendOffer(hostId: string): Promise<void> {
  try {
    // Fechar conexão anterior se existir
    if (participantPC) {
      participantPC.close();
    }

    const config = getActiveWebRTCConfig();
    participantPC = new RTCPeerConnection(config);

    // Obter stream local
    const stream = await ensureLocalStream();
    
    // Adicionar tracks à conexão
    stream.getTracks().forEach(track => {
      console.log(`📡 [PARTICIPANT] Adicionando track ${track.kind} ao PC`);
      participantPC!.addTrack(track, stream);
    });

    // ICE candidates
    participantPC.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateType = /typ (\w+)/.exec(event.candidate.candidate)?.[1];
        console.log(`🧊 [PARTICIPANT] ICE candidate tipo: ${candidateType}`);
        
        unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
      } else {
        console.log('🧊 [PARTICIPANT] ICE gathering completo');
      }
    };

    // Estados da conexão
    participantPC.onconnectionstatechange = () => {
      console.log('🔄 [PARTICIPANT] Connection state:', participantPC?.connectionState);
    };

    participantPC.oniceconnectionstatechange = () => {
      console.log('🧊 [PARTICIPANT] ICE connection state:', participantPC?.iceConnectionState);
    };

    // Criar e enviar offer
    const offer = await participantPC.createOffer();
    await participantPC.setLocalDescription(offer);
    
    console.log('📤 [PARTICIPANT] Offer PADRONIZADA criada, enviando para host:', hostId);
    unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);

  } catch (err) {
    console.error('❌ [PARTICIPANT] Erro criando offer:', err);
  }
}

// FASE D: Inicializar handlers apenas uma vez
if (typeof window !== 'undefined' && !(window as any).__participantHandlersSetup) {
  setupParticipantHandlers();
  (window as any).__participantHandlersSetup = true;
  console.log('✅ [PARTICIPANT] Handlers PADRONIZADOS inicializados');
}

// FASE F: Export para uso manual
export { setupParticipantHandlers };

// Helper para cleanup
export function cleanupParticipantHandshake() {
  if (participantPC) {
    participantPC.close();
    participantPC = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  console.log('🧹 [PARTICIPANT] Handshake cleanup completo');
}

// Export para uso em outros módulos
export { ensureLocalStream };