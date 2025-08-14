import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';

let participantPC: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let isMakingOffer = false;
let pendingCandidates: RTCIceCandidate[] = [];

async function ensureLocalStream(): Promise<MediaStream> {
  if (!localStream || !localStream.active) {
    console.log('PART-GUM-START');
    console.log('📹 [PARTICIPANT] Obtendo stream local...');
    
    try {
      // Tentar câmera traseira primeiro
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      console.log(`PART-GUM-OK {v=${videoTracks.length},a=${audioTracks.length}}`);
      console.log('📹 [PARTICIPANT] Stream traseira obtida');
      
      // Persistir na window para diagnóstico
      (window as any).__participantLocalStream = localStream;
      
    } catch (err) {
      const error = err as Error;
      console.warn('⚠️ [PARTICIPANT] Câmera traseira falhou, tentando frontal:', err);
      
      // Fallback para câmera frontal
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true
        });
        
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        console.log(`PART-GUM-OK {v=${videoTracks.length},a=${audioTracks.length}}`);
        console.log('📹 [PARTICIPANT] Stream frontal obtida');
        
        // Persistir na window para diagnóstico
        (window as any).__participantLocalStream = localStream;
        
      } catch (fallbackErr) {
        const fallbackError = fallbackErr as Error;
        console.log(`PART-GUM-ERROR {name=${fallbackError.name}, message=${fallbackError.message}}`);
        throw fallbackError;
      }
    }
    
    // Configurar monitoramento de saúde do stream
    setupStreamHealthMonitoring(localStream);
    
    console.log('📹 [PARTICIPANT] Stream local configurada:', {
      id: localStream.id,
      tracks: localStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
    });
  }
  
  return localStream;
}

// Adicionar monitoramento de saúde do stream
function setupStreamHealthMonitoring(stream: MediaStream) {
  const videoTrack = stream.getVideoTracks()[0];
  
  if (videoTrack) {
    // Monitorar track ended
    videoTrack.addEventListener('ended', () => {
      console.log('PART-TRACK-ENDED {reason=video-track-ended}');
    });
    
    // Monitorar mudanças de estado
    videoTrack.addEventListener('mute', () => {
      console.log('PART-TRACK-MUTED {track=video}');
    });
    
    videoTrack.addEventListener('unmute', () => {
      console.log('PART-TRACK-UNMUTED {track=video}');
    });
  }
  
  // Health check periódico
  const healthInterval = setInterval(() => {
    const vt = stream.getVideoTracks()[0];
    if (vt) {
      console.log(`PART-STREAM-HEALTH {videoReady=${vt.readyState}, trackState=${vt.readyState}, muted=${vt.muted}, enabled=${vt.enabled}}`);
    } else {
      console.log('PART-STREAM-HEALTH {videoReady=no-track, trackState=no-track}');
      clearInterval(healthInterval);
    }
  }, 5000);
  
  // Limpar interval quando stream for removido
  stream.addEventListener('removetrack', () => {
    clearInterval(healthInterval);
  });
}

// FASE B: Participante como OFFERER - aguarda solicitação do host
function setupParticipantHandlers() {
  if (!unifiedWebSocketService) {
    console.error('❌ [PARTICIPANT] unifiedWebSocketService não inicializado');
    return;
  }

  // NEW: Listen for direct WebRTC request-offer
  unifiedWebSocketService.on('webrtc-request-offer', async (data: any) => {
    const hostId = data?.fromUserId;
    console.log('PART-REQUEST-OFFER-RECEIVED {hostId=' + hostId + '}');
    
    if (!hostId) {
      console.warn('⚠️ [PARTICIPANT] Solicitação de offer inválida:', data);
      return;
    }

    // Verificar se host está pronto
    const hostReadiness = await checkHostReadiness(hostId);
    if (!hostReadiness.ready) {
      console.log(`PART-HOST-NOT-READY {hostId=${hostId}, reason=${hostReadiness.reason}}`);
      // Implementar retry automático
      setTimeout(() => {
        console.log(`PART-RETRY-OFFER {hostId=${hostId}}`);
        createAndSendOffer(hostId);
      }, 2000);
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

    console.log('📥 [PARTICIPANT] Answer SEQUENCIAL recebido do host:', hostId);

    if (!participantPC) {
      console.warn('⚠️ [PARTICIPANT] Answer recebido sem PC ativo');
      return;
    }

    try {
      console.log('🔄 [PARTICIPANT] Aplicando setRemoteDescription, state atual:', participantPC.signalingState);
      await participantPC.setRemoteDescription(answer);
      console.log('✅ [PARTICIPANT] Answer aplicado, novo state:', participantPC.signalingState);

      // CORRIGIR ICE BUFFER: Drenar TODOS os candidates pendentes imediatamente
      if (pendingCandidates.length > 0) {
        console.log(`PART-ICE-DRAIN-START {count=${pendingCandidates.length}}`);
        console.log(`🧊 [PARTICIPANT] Drenando ${pendingCandidates.length} candidates em buffer`);
        
        const candidatesToDrain = [...pendingCandidates];
        pendingCandidates = []; // Limpar buffer imediatamente
        
        for (const candidate of candidatesToDrain) {
          try {
            await participantPC.addIceCandidate(candidate);
            console.log('PART-ICE-DRAINED {ok=true}');
          } catch (err) {
            console.warn('⚠️ [PARTICIPANT] Erro drenando candidate:', err);
          }
        }
        console.log('PART-ICE-DRAIN-COMPLETE');
      }
      
      console.log('✅ [PARTICIPANT] Conexão estabelecida com sucesso');
    } catch (err) {
      console.error('❌ [PARTICIPANT] Erro aplicando answer:', err);
    }
  });

  // Receber ICE candidates do host com BUFFER CONSISTENTE
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

    // CORRIGIR ICE BUFFER: Aplicar imediatamente OU bufferizar consistentemente
    if (participantPC.remoteDescription && participantPC.remoteDescription.type) {
      try {
        await participantPC.addIceCandidate(candidate);
        const candidateType = /typ (\w+)/.exec(candidate.candidate)?.[1];
        console.log(`PART-ICE-IMMEDIATE {type=${candidateType}, from=${hostId}}`);
        console.log(`🧊 [PARTICIPANT] ICE candidate IMEDIATO adicionado de ${hostId}, tipo: ${candidateType}`);
      } catch (err) {
        console.warn('⚠️ [PARTICIPANT] Erro ao adicionar candidate de:', hostId, err);
      }
    } else {
      pendingCandidates.push(candidate);
      console.log(`PART-ICE-BUFFERED {from=${hostId}, bufferSize=${pendingCandidates.length}}`);
      console.log(`📦 [PARTICIPANT] Bufferizando candidate de ${hostId} (total: ${pendingCandidates.length})`);
    }
  });
}

// FASE B: Criar offer e enviar para o host
// CORRIGIR HANDSHAKE ORDER: Garantir mídia ANTES de criar offer
async function createAndSendOffer(hostId: string): Promise<void> {
  if (isMakingOffer) {
    console.warn('⚠️ [PARTICIPANT] Já fazendo offer, abortando');
    return;
  }

  isMakingOffer = true;
  
  try {
    console.log('[P-OFFER] creating offer WITH MEDIA');
    
    // RESET PC: Fechar conexão anterior e criar nova
    if (participantPC) {
      participantPC.close();
      participantPC = null;
    }

    // STEP 1: GARANTIR stream de mídia PRIMEIRO
    const stream = await ensureLocalStream();
    console.log('PART-MEDIA-FIRST {getUserMedia=ok}');
    
    // Validar stream ativo antes de criar PC
    if (!validateActiveStream(stream)) {
      throw new Error('Stream não está ativo para transmissão');
    }
    
    // STEP 2: Criar PC com configuração limpa
    const config = getActiveWebRTCConfig();
    participantPC = new RTCPeerConnection(config);
    
    // STEP 3: Adicionar tracks ANTES de qualquer descrição
    let tracksAdded = 0;
    stream.getTracks().forEach(track => {
      console.log(`PART-TRACK-ADD-FIRST {kind=${track.kind}, readyState=${track.readyState}}`);
      participantPC!.addTrack(track, stream);
      tracksAdded++;
    });
    
    console.log(`PART-MEDIA-ATTACHED {tracksAdded=${tracksAdded}}`);
    console.log(`📡 [PARTICIPANT] Mídia anexada ANTES do offer: ${tracksAdded} tracks`);

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

    // CORRIGIR STATUS MONITOR: Evitar loops de "connecting"
    participantPC.onconnectionstatechange = () => {
      const state = participantPC?.connectionState;
      console.log('🔄 [PARTICIPANT] Connection state:', state);
      console.log(`[P-CONN] state=${state}`);
      
      if (state === 'failed') {
        console.log('PART-CONNECTION-FAILED {reason=connection-state-failed}');
        // RESET CRITERIA: Limpar PC em failure
        if (participantPC) {
          participantPC.close();
          participantPC = null;
        }
        handleConnectionFailure(hostId);
      } else if (state === 'connected') {
        console.log('PART-CONNECTION-SUCCESS {time=' + Date.now() + '}');
        // STOP MONITORING LOOPS aqui se necessário
      }
    };

    participantPC.oniceconnectionstatechange = () => {
      const iceState = participantPC?.iceConnectionState;
      console.log('🧊 [PARTICIPANT] ICE connection state:', iceState);
      
      if (iceState === 'failed') {
        console.log('PART-ICE-FAILED {reason=ice-connection-failed}');
        // RESET CRITERIA: Limpar PC em ICE failure
        if (participantPC) {
          participantPC.close();
          participantPC = null;
        }
        handleConnectionFailure(hostId);
      }
    };

    participantPC.onicegatheringstatechange = () => {
      console.log(`[P-ICE] gathering=${participantPC?.iceGatheringState}`);
    };

    // STEP 4: Criar offer APÓS anexar mídia
    console.log('🔄 [PARTICIPANT] Criando offer COM MÍDIA, state atual:', participantPC.signalingState);
    const offer = await participantPC.createOffer();
    
    console.log(`PART-OFFER-WITH-MEDIA {sdpLen=${offer.sdp?.length || 0}}`);
    
    await participantPC.setLocalDescription(offer);
    console.log('PART-LOCAL-SET');
    console.log('✅ [PARTICIPANT] Local description definida, novo state:', participantPC.signalingState);
    
    console.log('📤 [PARTICIPANT] Offer COM MÍDIA criada, enviando para host:', hostId);
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
    // RESET CRITERIA: Limpar estado em erro
    if (participantPC) {
      participantPC.close();
      participantPC = null;
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

// Funções auxiliares para validação e recuperação
function validateActiveStream(stream: MediaStream): boolean {
  if (!stream || !stream.active) {
    console.log('PART-STREAM-INVALID {reason=inactive-stream}');
    return false;
  }
  
  const videoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live');
  const audioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');
  
  if (videoTracks.length === 0) {
    console.log('PART-STREAM-INVALID {reason=no-live-video-tracks}');
    return false;
  }
  
  console.log(`PART-STREAM-VALID {videoTracks=${videoTracks.length}, audioTracks=${audioTracks.length}}`);
  return true;
}

async function checkHostReadiness(hostId: string): Promise<{ready: boolean, reason?: string}> {
  try {
    // Simular verificação de estado do host
    // Na implementação real, seria uma consulta via WebSocket
    console.log(`PART-HOST-CHECK {hostId=${hostId}}`);
    
    // Por enquanto, assumir que host está sempre pronto após 1s
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return { ready: true };
  } catch (error) {
    console.log(`PART-HOST-CHECK-FAILED {hostId=${hostId}, error=${error}}`);
    return { ready: false, reason: 'check-failed' };
  }
}

// CORRIGIR RE-OFFERS: Adicionar timeout/reset criteria
async function handleConnectionFailure(hostId: string) {
  console.log(`PART-RECOVERY-START {hostId=${hostId}}`);
  
  // TIMEOUT/RESET CRITERIA: Limpar completamente estado anterior
  if (participantPC) {
    participantPC.close();
    participantPC = null;
  }
  
  // Limpar candidates pendentes
  pendingCandidates = [];
  
  // PREVENT LOOPING: Só tentar recriar SE não estiver fazendo offer
  if (!isMakingOffer) {
    // Tentar recriar conexão após delay com backoff
    setTimeout(async () => {
      try {
        console.log(`PART-RECOVERY-RETRY {hostId=${hostId}}`);
        await createAndSendOffer(hostId);
      } catch (error) {
        console.log(`PART-RECOVERY-FAILED {hostId=${hostId}, error=${error}}`);
        // STOP LOOPING: Não tentar novamente por um tempo maior
        setTimeout(() => {
          console.log(`PART-RECOVERY-FINAL-ATTEMPT {hostId=${hostId}}`);
        }, 10000);
      }
    }, 5000); // Aumentar delay para evitar loops
  } else {
    console.log(`PART-RECOVERY-SKIPPED {hostId=${hostId}, reason=already-making-offer}`);
  }
}

// Export para uso em outros módulos
export { ensureLocalStream };