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

// Handlers para eventos do host
function setupParticipantHandlers() {
  // CORREÇÃO CRÍTICA: Verificar se service está inicializado antes de adicionar listeners
  if (!unifiedWebSocketService || !unifiedWebSocketService.isConnected()) {
    console.error('❌ CRITICAL: unifiedWebSocketService not initialized in setupParticipantHandlers');
    return;
  }
  
  console.log('📡 [PARTICIPANT] Setting up handlers after WebSocket connection confirmed');
  
  // Receber offer do host
  unifiedWebSocketService.on('webrtc-offer', async (data: { from: string; sdp: string; type: string }) => {
    const { from, sdp, type } = data;
    console.log('📥 [PARTICIPANT] Offer recebido de:', from);

    try {
      // Fechar conexão anterior se existir
      if (participantPC) {
        participantPC.close();
      }

      const config = getActiveWebRTCConfig();
      
      // FORÇAR TURN para validação (temporário)
      const testConfig = {
        ...config,
        iceTransportPolicy: 'relay' as RTCIceTransportPolicy
      };
      
      console.log('🧊 [PARTICIPANT] Configuração ICE para teste TURN:', {
        iceServers: testConfig.iceServers?.length,
        iceTransportPolicy: testConfig.iceTransportPolicy
      });

      participantPC = new RTCPeerConnection(testConfig);

      // Obter stream local
      const stream = await ensureLocalStream();
      
      // Adicionar tracks à conexão
      stream.getTracks().forEach(track => {
        console.log(`📡 [PARTICIPANT] Adicionando track ${track.kind} ao PC`);
        participantPC!.addTrack(track, stream);
      });

      // ICE candidates com logs de tipo
      participantPC.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateType = /typ (\w+)/.exec(event.candidate.candidate)?.[1];
          console.log(`🧊 [PARTICIPANT] ICE candidate tipo: ${candidateType}`, event.candidate.candidate);
          
          unifiedWebSocketService.sendWebRTCCandidate(from, event.candidate);
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

      // Aplicar offer e criar answer
      await participantPC.setRemoteDescription({ sdp, type } as RTCSessionDescriptionInit);
      console.log('✅ [PARTICIPANT] Offer aplicado');

      const answer = await participantPC.createAnswer();
      await participantPC.setLocalDescription(answer);
      console.log('📤 [PARTICIPANT] Local description definida, enviando answer');

      unifiedWebSocketService.sendWebRTCAnswer(from, answer.sdp!, answer.type);
      
      console.log('✅ [PARTICIPANT] Answer enviado para:', from);

    } catch (err) {
      console.error('❌ [PARTICIPANT] Erro no handshake:', err);
    }
  });

  // Receber ICE candidates do host
  unifiedWebSocketService.on('webrtc-candidate', async (data: { from: string; candidate: RTCIceCandidate }) => {
    const { from, candidate } = data;
    
    if (!participantPC || !candidate) {
      console.warn('⚠️ [PARTICIPANT] PC ou candidate inválido de:', from);
      return;
    }

    try {
      await participantPC.addIceCandidate(candidate);
      const candidateType = /typ (\w+)/.exec(candidate.candidate)?.[1];
      console.log(`🧊 [PARTICIPANT] ICE candidate adicionado de ${from}, tipo: ${candidateType}`);
    } catch (err) {
      console.warn('⚠️ [PARTICIPANT] Erro ao adicionar candidate de:', from, err);
    }
  });
  
  console.log('✅ [PARTICIPANT] Handlers registrados com sucesso');
}

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

// CORREÇÃO CRÍTICA: Export função para inicializar quando necessário
// NÃO inicializar automaticamente aqui - deve ser chamado quando WebSocket estiver pronto
export { setupParticipantHandlers, ensureLocalStream };