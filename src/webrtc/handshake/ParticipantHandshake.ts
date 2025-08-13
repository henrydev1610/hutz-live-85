import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';

let participantPC: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let isMakingOffer = false;
let pendingCandidates: RTCIceCandidate[] = [];

async function ensureLocalStream(): Promise<MediaStream> {
  if (!localStream || !localStream.active) {
    console.log('📹 [PARTICIPANT] Obtendo stream local...');
    console.log('[P-MEDIA] request getUserMedia');
    
    try {
      // Tentar câmera traseira primeiro
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      console.log(`[P-MEDIA] success tracks={video:${videoTracks.length}, audio:${audioTracks.length}} streamId=${localStream.id}`);
      console.log('📹 [PARTICIPANT] Stream traseira obtida');
      
      // Persistir na window para diagnóstico
      (window as any).__participantLocalStream = localStream;
      
    } catch (err) {
      const error = err as Error;
      console.log(`[P-MEDIA] error name=${error.name} message=${error.message}`);
      console.warn('⚠️ [PARTICIPANT] Câmera traseira falhou, tentando frontal:', err);
      
      // Fallback para câmera frontal
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true
        });
        
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        console.log(`[P-MEDIA] success tracks={video:${videoTracks.length}, audio:${audioTracks.length}} streamId=${localStream.id}`);
        console.log('📹 [PARTICIPANT] Stream frontal obtida');
        
        // Persistir na window para diagnóstico
        (window as any).__participantLocalStream = localStream;
        
      } catch (fallbackErr) {
        const fallbackError = fallbackErr as Error;
        console.log(`[P-MEDIA] error name=${fallbackError.name} message=${fallbackError.message}`);
        throw fallbackError;
      }
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

  // FASE F: Receber solicitação de offer do host com GUARD
  unifiedWebSocketService.on('request-offer', async (data: any) => {
    const hostId = data?.fromUserId;
    console.log('PART-REQUEST-OFFER-RECEIVED');
    
    if (!hostId) {
      console.warn('⚠️ [PARTICIPANT] Solicitação de offer inválida:', data);
      return;
    }

    // GUARD: Evitar ofertas concorrentes
    if (isMakingOffer) {
      console.warn('⚠️ [PARTICIPANT] Já fazendo offer, ignorando nova solicitação de:', hostId);
      return;
    }

    if (participantPC && participantPC.signalingState !== 'stable') {
      console.warn('⚠️ [PARTICIPANT] PC não stable:', participantPC.signalingState, '- ignorando solicitação');
      return;
    }

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
      console.log('🔄 [PARTICIPANT] Aplicando setRemoteDescription, state atual:', participantPC.signalingState);
      await participantPC.setRemoteDescription(answer);
      console.log('✅ [PARTICIPANT] Answer aplicado, novo state:', participantPC.signalingState);

      // Aplicar candidates em buffer
      if (pendingCandidates.length > 0) {
        console.log(`🧊 [PARTICIPANT] Aplicando ${pendingCandidates.length} candidates em buffer`);
        for (const candidate of pendingCandidates) {
          try {
            await participantPC.addIceCandidate(candidate);
          } catch (err) {
            console.warn('⚠️ [PARTICIPANT] Erro aplicando candidate em buffer:', err);
          }
        }
        pendingCandidates = [];
      }
      
      console.log('✅ [PARTICIPANT] Conexão estabelecida com sucesso');
    } catch (err) {
      console.error('❌ [PARTICIPANT] Erro aplicando answer:', err);
    }
  });

  // Receber ICE candidates do host com BUFFER
  unifiedWebSocketService.on('webrtc-candidate', async (data: any) => {
    const hostId = data?.fromUserId;
    const candidate = data?.candidate;
    
    if (!candidate) {
      console.warn('⚠️ [PARTICIPANT] Candidate inválido de:', hostId);
      return;
    }

    if (!participantPC) {
      console.warn('⚠️ [PARTICIPANT] PC não existe, bufferizando candidate de:', hostId);
      pendingCandidates.push(candidate);
      return;
    }

    // BUFFER ICE: Aplicar apenas após setRemoteDescription
    if (participantPC.remoteDescription) {
      try {
        await participantPC.addIceCandidate(candidate);
        const candidateType = /typ (\w+)/.exec(candidate.candidate)?.[1];
        console.log(`🧊 [PARTICIPANT] ICE candidate PADRONIZADO adicionado de ${hostId}, tipo: ${candidateType}`);
      } catch (err) {
        console.warn('⚠️ [PARTICIPANT] Erro ao adicionar candidate de:', hostId, err);
      }
    } else {
      console.log(`📦 [PARTICIPANT] Bufferizando candidate de ${hostId} (total: ${pendingCandidates.length + 1})`);
      pendingCandidates.push(candidate);
    }
  });
}

// FASE B: Criar offer e enviar para o host
async function createAndSendOffer(hostId: string): Promise<void> {
  if (isMakingOffer) {
    console.warn('⚠️ [PARTICIPANT] Já fazendo offer, abortando');
    return;
  }

  isMakingOffer = true;
  
  try {
    console.log('[P-OFFER] creating offer');
    
    // Fechar conexão anterior se existir
    if (participantPC) {
      participantPC.close();
    }

    const config = getActiveWebRTCConfig();
    participantPC = new RTCPeerConnection(config);

    // CRÍTICO: Adicionar transceivers sendonly ANTES de adicionar tracks
    try {
      participantPC.addTransceiver('video', { direction: 'sendonly' });
      participantPC.addTransceiver('audio', { direction: 'sendonly' });
      console.log('📡 [PARTICIPANT] Transceivers sendonly adicionados ANTES dos tracks');
    } catch (err) {
      console.warn('⚠️ [PARTICIPANT] Erro ao adicionar transceivers:', err);
    }

    // Obter stream local
    const stream = await ensureLocalStream();
    const videoTracks = stream.getVideoTracks().length;
    const audioTracks = stream.getAudioTracks().length;
    console.log(`PART-GUM-OK {v=${videoTracks}, a=${audioTracks}}`);
    
    // Adicionar tracks aos transceivers existentes
    const transceivers = participantPC.getTransceivers();
    stream.getTracks().forEach(track => {
      console.log(`📡 [PARTICIPANT] Configurando track ${track.kind} no transceiver`);
      const transceiver = transceivers.find(t => t.receiver.track?.kind === track.kind);
      if (transceiver && transceiver.sender) {
        transceiver.sender.replaceTrack(track);
      } else {
        // Fallback se transceivers não funcionaram
        participantPC!.addTrack(track, stream);
      }
    });

    // ICE candidates
    participantPC.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateType = /typ (\w+)/.exec(event.candidate.candidate)?.[1];
        console.log(`🧊 [PARTICIPANT] ICE candidate tipo: ${candidateType}`);
        
        unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
      } else {
        console.log('🧊 [PARTICIPANT] ICE gathering completo');
        console.log('[P-ICE] gathering=complete');
      }
    };

    // Estados da conexão
    participantPC.onconnectionstatechange = () => {
      console.log('🔄 [PARTICIPANT] Connection state:', participantPC?.connectionState);
      console.log(`[P-ICE] connection=${participantPC?.connectionState}`);
    };

    participantPC.oniceconnectionstatechange = () => {
      console.log('🧊 [PARTICIPANT] ICE connection state:', participantPC?.iceConnectionState);
    };

    participantPC.onicegatheringstatechange = () => {
      console.log(`[P-ICE] gathering=${participantPC?.iceGatheringState}`);
    };

    // Criar e enviar offer
    console.log('🔄 [PARTICIPANT] Criando offer, state atual:', participantPC.signalingState);
    const offer = await participantPC.createOffer();
    await participantPC.setLocalDescription(offer);
    
    console.log(`PART-OFFER-CREATED {sdpLen=${offer.sdp?.length || 0}}`);
    console.log('✅ [PARTICIPANT] Local description definida, novo state:', participantPC.signalingState);
    
    console.log('📤 [PARTICIPANT] Offer PADRONIZADA criada, enviando para host:', hostId);
    // Usar propriedades privadas diretamente através do serviço
    const roomId = (unifiedWebSocketService as any).currentRoomId;
    const participantId = (unifiedWebSocketService as any).currentUserId;
    console.log(`[WS-SEND] webrtc-offer roomId=${roomId} from=${participantId} to=${hostId} sdpLen=${offer.sdp?.length || 0}`);
    unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);
    console.log('PART-OFFER-SENT');

  } catch (err) {
    console.error('❌ [PARTICIPANT] Erro criando offer:', err);
    // Log específico para erro de m-lines
    if (err instanceof Error && err.message.includes('m-lines')) {
      console.error('🚨 [PARTICIPANT] ERRO M-LINES DETECTADO - Problema na ordem dos transceivers');
    }
  } finally {
    isMakingOffer = false;
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