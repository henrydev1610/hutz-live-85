import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';
import { ConnectionHandler } from '@/utils/webrtc/ConnectionHandler';

const hostPeerConnections = new Map<string, RTCPeerConnection>();

export async function startHostHandshakeFor(participantId: string) {
  console.log('🎯 [HOST] Iniciando handshake para:', participantId);
  
  // Limpar conexão anterior se existir
  const existingPC = hostPeerConnections.get(participantId);
  if (existingPC) {
    existingPC.close();
    hostPeerConnections.delete(participantId);
  }

  const config = getActiveWebRTCConfig();
  
  // FORÇAR TURN para validação (temporário)
  const testConfig = {
    ...config,
    iceTransportPolicy: 'relay' as RTCIceTransportPolicy
  };
  
  console.log('🧊 [HOST] Configuração ICE para teste TURN:', {
    iceServers: testConfig.iceServers?.length,
    iceTransportPolicy: testConfig.iceTransportPolicy
  });

  const pc = new RTCPeerConnection(testConfig);
  hostPeerConnections.set(participantId, pc);

  // Host só recebe mídia - adicionar transceivers recvonly
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    console.log('📡 [HOST] Transceivers recvonly adicionados');
  } catch (err) {
    console.warn('⚠️ [HOST] Erro ao adicionar transceivers:', err);
  }

  // ICE candidates com logs de tipo
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateType = /typ (\w+)/.exec(event.candidate.candidate)?.[1];
      console.log(`🧊 [HOST] ICE candidate tipo: ${candidateType}`, event.candidate.candidate);
      
      unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
    } else {
      console.log('🧊 [HOST] ICE gathering completo para:', participantId);
    }
  };

  // Receber stream do participante
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    console.log('🎥 [HOST] ONTRACK recebido de:', participantId, 'streamId:', stream?.id);
    console.log('🎥 [HOST] Stream tracks:', stream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
    
    // Notificar sistema de gerenciamento de streams
    if (stream && window.hostStreamCallback) {
      window.hostStreamCallback(participantId, stream);
    }
    
    // Trigger evento customizado
    window.dispatchEvent(new CustomEvent('host-stream-received', {
      detail: { participantId, stream }
    }));
  };

  // Estados da conexão
  pc.onconnectionstatechange = () => {
    console.log(`🔄 [HOST] Connection state (${participantId}):`, pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 [HOST] ICE connection state (${participantId}):`, pc.iceConnectionState);
  };

  // Criar e enviar offer
  try {
    const offer = await pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    });
    
    await pc.setLocalDescription(offer);
    console.log('📤 [HOST] Local description definida, enviando offer para:', participantId);

    unifiedWebSocketService.sendWebRTCOffer(participantId, offer.sdp!, offer.type);
    
    console.log('✅ [HOST] Offer enviado para:', participantId);
  } catch (err) {
    console.error('❌ [HOST] Erro ao criar/enviar offer:', err);
  }
}

// Handlers para resposta do participante
function setupHostHandlers() {
  // Receber answer do participante
  unifiedWebSocketService.on('webrtc-answer', async (data: { from: string; sdp: string; type: string }) => {
    const { from, sdp, type } = data;
    console.log('📥 [HOST] Answer recebido de:', from);
    
    const pc = hostPeerConnections.get(from);
    if (!pc) {
      console.warn('⚠️ [HOST] PeerConnection não encontrada para:', from);
      return;
    }

    try {
      await pc.setRemoteDescription({ sdp, type } as RTCSessionDescriptionInit);
      console.log('✅ [HOST] Answer aplicado de:', from);
    } catch (err) {
      console.error('❌ [HOST] Erro ao aplicar answer de:', from, err);
    }
  });

  // Receber ICE candidates do participante
  unifiedWebSocketService.on('webrtc-candidate', async (data: { from: string; candidate: RTCIceCandidate }) => {
    const { from, candidate } = data;
    const pc = hostPeerConnections.get(from);
    
    if (!pc || !candidate) {
      console.warn('⚠️ [HOST] PC ou candidate inválido de:', from);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
      const candidateType = /typ (\w+)/.exec(candidate.candidate)?.[1];
      console.log(`🧊 [HOST] ICE candidate adicionado de ${from}, tipo: ${candidateType}`);
    } catch (err) {
      console.warn('⚠️ [HOST] Erro ao adicionar candidate de:', from, err);
    }
  });
}

// Inicializar handlers apenas uma vez
if (!(window as any).__hostHandlersSetup) {
  setupHostHandlers();
  (window as any).__hostHandlersSetup = true;
}

// Helper para cleanup
export function cleanupHostHandshake(participantId: string) {
  const pc = hostPeerConnections.get(participantId);
  if (pc) {
    pc.close();
    hostPeerConnections.delete(participantId);
    console.log('🧹 [HOST] Handshake cleanup para:', participantId);
  }
}

// Global types para callback
declare global {
  interface Window {
    hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
  }
}