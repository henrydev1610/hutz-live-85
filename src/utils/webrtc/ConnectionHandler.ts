import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { setupOnTrackWithTimeout, setupICEGatheringTimeout, validateTransceiversPostNegotiation } from './ConnectionHandlerMethods';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private offerTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private currentParticipantId: string | null = null;
  
  // FASE 2: Contadores para diagnóstico
  private iceCandidatesSent: Map<string, number> = new Map();
  private iceCandidatesReceived: Map<string, number> = new Map();
  private iceGatheringTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // FASE 4: Circuit breaker para retry loops
  private circuitBreaker: Map<string, { failures: number, lastFailure: number, isOpen: boolean }> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 segundos

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
    console.log('📞 WEBRTC DEBUG: Stream callback registrado com sucesso');
    console.log('📞 WEBRTC DEBUG: Callback é válido:', typeof callback === 'function');
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
    console.log('👤 WEBRTC DEBUG: Participant join callback registrado com sucesso');
    console.log('👤 WEBRTC DEBUG: Callback é válido:', typeof callback === 'function');
  }

  // FASE 2: Novo método para iniciar handshake automático
  async initiateHandshake(participantId: string): Promise<void> {
    console.log(`🤝 FASE 2: Auto-initiating handshake with ${participantId}`);
    
    // FASE 4: Verificar circuit breaker
    if (this.isCircuitBreakerOpen(participantId)) {
      console.log(`🚫 WEBRTC DIAGNÓSTICO: Circuit breaker ABERTO para ${participantId} - ignorando handshake`);
      return;
    }
    
    try {
      const peerConnection = this.createPeerConnection(participantId);
      await this.initiateCall(participantId);
      console.log(`✅ FASE 2: Handshake initiated successfully with ${participantId}`);
      
      // FASE 4: Reset circuit breaker em caso de sucesso
      this.resetCircuitBreaker(participantId);
      
    } catch (error) {
      console.error(`❌ FASE 2: Failed to initiate handshake with ${participantId}:`, error);
      
      // FASE 4: Incrementar falhas no circuit breaker
      this.recordCircuitBreakerFailure(participantId);
      
      throw error;
    }
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 WEBRTC DIAGNÓSTICO: ===== CRIANDO PEER CONNECTION =====`);
    console.log(`🔗 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`🔗 WEBRTC DIAGNÓSTICO: Timestamp: ${new Date().toISOString()}`);
    console.log(`🔗 WEBRTC DIAGNÓSTICO: Conexões existentes: ${this.peerConnections.size}`);
    console.log(`🔗 WEBRTC DIAGNÓSTICO: Stream callback disponível: ${!!this.streamCallback}`);
    console.log(`🔗 WEBRTC DIAGNÓSTICO: Join callback disponível: ${!!this.participantJoinCallback}`);
    
    // FASE 5: Importar diagnóstico de conectividade
    import('@/utils/webrtc/ConnectivityDiagnostics').then(({ connectivityDiagnostics }) => {
      const networkType = connectivityDiagnostics.detectNetworkType();
      console.log(`📶 NETWORK TYPE detected: ${networkType}`);
    });

    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      const existingPC = this.peerConnections.get(participantId)!;
      console.log(`🔗 WEBRTC DIAGNÓSTICO: Conexão existente encontrada para ${participantId}`);
      console.log(`🔗 WEBRTC DIAGNÓSTICO: Estado da conexão existente:`, {
        connectionState: existingPC.connectionState,
        signalingState: existingPC.signalingState,
        iceConnectionState: existingPC.iceConnectionState,
        iceGatheringState: existingPC.iceGatheringState
      });
      
      // FASE 2: Verificar se a conexão existente está em bom estado
      if (existingPC.connectionState === 'connected' || 
          existingPC.connectionState === 'connecting') {
        console.log(`♻️ WEBRTC DIAGNÓSTICO: Reutilizando conexão existente para: ${participantId} (estado: ${existingPC.connectionState})`);
        return existingPC;
      } else {
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Substituindo conexão inválida para: ${participantId} (estado: ${existingPC.connectionState})`);
        existingPC.close();
        this.peerConnections.delete(participantId);
      }
    }

    // Criar nome único para o relay baseado na sessão e timestamp
    const uniqueId = `relay-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // FASE 1: Usar configuração robusta de STUN/TURN
    import('@/utils/webrtc/WebRTCConfig').then(({ WEBRTC_CONFIG }) => {
      console.log('📡 WEBRTC CONFIG: Using enhanced STUN/TURN configuration');
      console.log('📡 ICE SERVERS:', WEBRTC_CONFIG.iceServers.length, 'servers configured');
    });
    
    const { WEBRTC_CONFIG } = require('@/utils/webrtc/WebRTCConfig');
    const config = WEBRTC_CONFIG;

    console.log(`🔧 WEBRTC DIAGNÓSTICO: Criando WebRTC connection com unique ID: ${uniqueId}`);
    console.log(`🔧 WEBRTC DIAGNÓSTICO: ICE servers configurados:`, config.iceServers);
    
    const peerConnection = new RTCPeerConnection(config);
    
    // Adicionar propriedade única para debug
    (peerConnection as any).__uniqueId = uniqueId;
    
    this.peerConnections.set(participantId, peerConnection);

    // FASE 2: ICE CANDIDATE com diagnóstico avançado
    peerConnection.onicecandidate = (event) => {
      console.log(`🧊 WEBRTC DIAGNÓSTICO: ===== ICE CANDIDATE EVENT =====`);
      console.log(`🧊 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
      console.log(`🧊 WEBRTC DIAGNÓSTICO: Timestamp: ${new Date().toISOString()}`);
      console.log(`🧊 WEBRTC DIAGNÓSTICO: Candidate exists: ${!!event.candidate}`);
      console.log(`🧊 WEBRTC DIAGNÓSTICO: ICE gathering state: ${peerConnection.iceGatheringState}`);
      
      if (event.candidate) {
        // FASE 2: DIAGNÓSTICO DETALHADO DE ICE CANDIDATES
        const candidateInfo = {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          foundation: event.candidate.foundation,
          priority: event.candidate.priority,
          component: event.candidate.component,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment
        };
        
        console.log(`🧊 WEBRTC DIAGNÓSTICO: ICE Candidate detalhado para ${participantId}:`, candidateInfo);
        
        // FASE 2: Verificar tipo de candidato
        if (event.candidate.type === 'host') {
          console.log(`🏠 WEBRTC DIAGNÓSTICO: Candidato HOST encontrado - conexão local possível`);
        } else if (event.candidate.type === 'srflx') {
          console.log(`🌐 WEBRTC DIAGNÓSTICO: Candidato SRFLX encontrado - NAT traversal via STUN`);
        } else if (event.candidate.type === 'relay') {
          console.log(`🔄 WEBRTC DIAGNÓSTICO: Candidato RELAY encontrado - usando TURN server`);
        }
        
        try {
          const sendStartTime = performance.now();
          unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
          const sendEndTime = performance.now();
          
          console.log(`✅ WEBRTC DIAGNÓSTICO: ICE candidate enviado via WebSocket em ${(sendEndTime - sendStartTime).toFixed(2)}ms`);
          
          // FASE 2: Incrementar contador de ICE candidates enviados
          const currentCount = this.iceCandidatesSent.get(participantId) || 0;
          this.iceCandidatesSent.set(participantId, currentCount + 1);
          
        } catch (iceError) {
          console.error(`❌ WEBRTC DIAGNÓSTICO: FALHA ao enviar ICE candidate:`, iceError);
        }
        
      } else {
        // FASE 2: ICE GATHERING COMPLETADO
        console.log(`🏁 WEBRTC DIAGNÓSTICO: ICE gathering COMPLETADO para: ${participantId}`);
        console.log(`🏁 WEBRTC DIAGNÓSTICO: Total de candidates enviados: ${this.iceCandidatesSent?.get(participantId) || 0}`);
        console.log(`🏁 WEBRTC DIAGNÓSTICO: Estado final ICE: ${peerConnection.iceGatheringState}`);
        
        // FASE 2: Verificar se algum candidato foi enviado
        const totalSent = this.iceCandidatesSent?.get(participantId) || 0;
        if (totalSent === 0) {
          console.warn(`⚠️ WEBRTC DIAGNÓSTICO: ATENÇÃO - Nenhum ICE candidate foi enviado para ${participantId}`);
          console.warn(`⚠️ WEBRTC DIAGNÓSTICO: Possível problema de rede ou configuração STUN`);
        }
        
        // FASE 2: Limpar timeout de ICE gathering
        this.clearIceGatheringTimeout(participantId);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 WEBRTC DIAGNÓSTICO: ${participantId} mudou para: ${peerConnection.connectionState}`);
      console.log(`🔗 WEBRTC DIAGNÓSTICO: Estados completos:`, {
        connectionState: peerConnection.connectionState,
        signalingState: peerConnection.signalingState,
        iceConnectionState: peerConnection.iceConnectionState,
        iceGatheringState: peerConnection.iceGatheringState
      });

      // VISUAL LOG: Toast para mudanças de estado
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('webrtc-state-change', {
          detail: { 
            participantId, 
            state: peerConnection.connectionState,
            timestamp: Date.now(),
            fullState: {
              connectionState: peerConnection.connectionState,
              signalingState: peerConnection.signalingState,
              iceConnectionState: peerConnection.iceConnectionState,
              iceGatheringState: peerConnection.iceGatheringState
            }
          }
        }));
      }

      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ WEBRTC DIAGNÓSTICO: Conexão estabelecida com: ${participantId}`);
        this.clearOfferTimeout(participantId);
        this.resetCircuitBreaker(participantId);
        
        // CORREÇÃO: Usar callback direto ao invés de dependência circular
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Atualizando estado WebRTC para conectado via callback`);
        
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ WEBRTC DIAGNÓSTICO: Falha na conexão com: ${participantId}`);
        this.recordCircuitBreakerFailure(participantId);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.connectionState === 'connecting') {
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Conectando com: ${participantId}`);
      } else if (peerConnection.connectionState === 'new') {
        console.log(`🆕 WEBRTC DIAGNÓSTICO: Nova conexão criada para: ${participantId}`);
      }
    };

    // FASE 3: Adicionar evento específico de ICE
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 WEBRTC DIAGNÓSTICO: ICE connection state para ${participantId}: ${peerConnection.iceConnectionState}`);
      
      // Monitorar estados de ICE que podem indicar problemas
      if (peerConnection.iceConnectionState === 'failed') {
        console.error(`❌ WEBRTC DIAGNÓSTICO: ICE CONNECTION FAILED para ${participantId}`);
        console.error(`❌ WEBRTC DIAGNÓSTICO: ICE candidates enviados: ${this.iceCandidatesSent.get(participantId) || 0}`);
        console.error(`❌ WEBRTC DIAGNÓSTICO: ICE candidates recebidos: ${this.iceCandidatesReceived.get(participantId) || 0}`);
        this.handleConnectionFailure(participantId);
      } else if (peerConnection.iceConnectionState === 'disconnected') {
        console.warn(`⚠️ WEBRTC DIAGNÓSTICO: ICE CONNECTION DISCONNECTED para ${participantId}`);
      } else if (peerConnection.iceConnectionState === 'connected') {
        console.log(`✅ WEBRTC DIAGNÓSTICO: ICE CONNECTION CONNECTED para ${participantId}`);
      } else if (peerConnection.iceConnectionState === 'completed') {
        console.log(`🏁 WEBRTC DIAGNÓSTICO: ICE CONNECTION COMPLETED para ${participantId}`);
      }
    };

    // FASE 4: ONTRACK com timeout e fallback robusto
    let onTrackReceived = false;
    const onTrackTimeout = setTimeout(() => {
      if (!onTrackReceived) {
        console.warn(`⏰ WEBRTC DIAGNÓSTICO: TIMEOUT - ontrack não disparou em 10s para ${participantId}`);
        console.warn(`⏰ WEBRTC DIAGNÓSTICO: Forçando restart da peer connection...`);
        
        // FASE 4: FALLBACK - Restart completo da peer connection
        this.forceConnectionRestart(participantId);
      }
    }, 10000);

    peerConnection.ontrack = (event) => {
      onTrackReceived = true;
      clearTimeout(onTrackTimeout);
      
      console.log('🎵 WEBRTC DIAGNÓSTICO: ===== ONTRACK DISPARADO =====');
      console.log('🎵 WEBRTC DIAGNÓSTICO: Participante:', participantId);
      console.log('🎵 WEBRTC DIAGNÓSTICO: Timestamp:', new Date().toISOString());
      console.log('🎵 WEBRTC DIAGNÓSTICO: Event details:', {
        streamsCount: event.streams?.length || 0,
        trackKind: event.track?.kind,
        trackId: event.track?.id,
        trackReadyState: event.track?.readyState
      });
      
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('📺 WEBRTC DIAGNÓSTICO: Stream válido recebido:', {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          participantId,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        // PONTE 1: Callback direto React
        if (this.streamCallback) {
          console.log('📞 WEBRTC DIAGNÓSTICO: Executando callback React IMEDIATO');
          try {
            this.streamCallback(participantId, stream);
            console.log('✅ WEBRTC DIAGNÓSTICO: Callback React executado com sucesso');
          } catch (error) {
            console.error('❌ WEBRTC DIAGNÓSTICO: Erro no callback React:', error);
          }
        } else {
          console.error('❌ WEBRTC DIAGNÓSTICO: Callback React não está definido!');
        }
        
        // PONTE 2: Evento personalizado para ParticipantPreviewGrid
        console.log('📡 WEBRTC DIAGNÓSTICO: Disparando evento participant-stream-connected');
        window.dispatchEvent(new CustomEvent('participant-stream-connected', {
          detail: { participantId, stream }
        }));
        
        // PONTE 3: Forçar atualização de estado via evento
        console.log('🔄 WEBRTC DIAGNÓSTICO: Disparando força atualização de streams');
        window.dispatchEvent(new CustomEvent('force-stream-state-update', {
          detail: { 
            participantId, 
            stream,
            streamId: stream.id,
            timestamp: Date.now()
          }
        }));
        
        // PONTE 4: Evento específico para containers de vídeo
        console.log('📹 WEBRTC DIAGNÓSTICO: Disparando evento stream-received para containers');
        window.dispatchEvent(new CustomEvent('stream-received', {
          detail: { participantId, stream }
        }));
        
        // PONTE 5: BroadcastChannel como último recurso
        try {
          const bc = new BroadcastChannel('webrtc-stream-bridge');
          bc.postMessage({ 
            action: 'stream-received',
            participantId, 
            streamId: stream.id,
            timestamp: Date.now()
          });
          bc.close();
          console.log('📻 WEBRTC DIAGNÓSTICO: BroadcastChannel enviado');
        } catch (e) {
          console.warn('⚠️ WEBRTC DIAGNÓSTICO: BroadcastChannel failed:', e);
        }
        
      } else {
        console.warn('⚠️ WEBRTC DIAGNÓSTICO: ontrack sem streams válidos');
      }
    };

    // Perfect Negotiation: Define polite/impolite roles based on participant IDs
    const isPolite = participantId < (this.currentParticipantId || '');
    console.log(`🤝 WEBRTC DIAGNÓSTICO: Perfect Negotiation role para ${participantId}: ${isPolite ? 'polite' : 'impolite'}`);

    // FASE 3: PERFECT NEGOTIATION com diagnóstico avançado
    peerConnection.onnegotiationneeded = async () => {
      console.log(`🔄 WEBRTC DIAGNÓSTICO: ===== NEGOTIATION NEEDED =====`);
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Role: ${isPolite ? 'polite' : 'impolite'}`);
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Signaling state: ${peerConnection.signalingState}`);
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Timestamp: ${new Date().toISOString()}`);
      
      try {
        // FASE 3: POLITE/IMPOLITE pattern com logging detalhado
        if (!isPolite && peerConnection.signalingState !== 'stable') {
          console.log(`⚠️ WEBRTC DIAGNÓSTICO: GLARE DETECTADO - Peer impolite ignorando renegociação`);
          console.log(`⚠️ WEBRTC DIAGNÓSTICO: Estado atual: ${peerConnection.signalingState}`);
          console.log(`⚠️ WEBRTC DIAGNÓSTICO: Aguardando peer polite resolver o conflito`);
          return;
        }
        
        console.log(`🚀 WEBRTC DIAGNÓSTICO: Iniciando renegociação para ${participantId}`);
        
        // FASE 3: Verificar estado antes da renegociação
        const preNegotiationState = {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState,
          transceivers: peerConnection.getTransceivers().length,
          senders: peerConnection.getSenders().length
        };
        
        console.log(`🔍 WEBRTC DIAGNÓSTICO: Estado pré-renegociação:`, preNegotiationState);
        
        await this.initiateCall(participantId);
        
        console.log(`✅ WEBRTC DIAGNÓSTICO: Renegociação iniciada com sucesso para ${participantId}`);
        
      } catch (error) {
        console.error(`❌ WEBRTC DIAGNÓSTICO: ERRO na renegociação para ${participantId}:`, error);
        console.error(`❌ WEBRTC DIAGNÓSTICO: Stack trace:`, error.stack);
        console.error(`❌ WEBRTC DIAGNÓSTICO: Estado da conexão:`, {
          signalingState: peerConnection.signalingState,
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState
        });
        
        // FASE 4: FALLBACK - Tentar restart da conexão se renegociação falhar
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Tentando restart da conexão após falha na renegociação...`);
        this.handleConnectionFailure(participantId);
      }
    };

    // ADICIONAR TRANSCEIVERS: Uso moderno com controle explícito
    const localStream = this.getLocalStream();
    console.log(`📤 WEBRTC DIAGNÓSTICO: ===== ADICIONANDO TRANSCEIVERS =====`);
    console.log(`📤 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`📤 WEBRTC DIAGNÓSTICO: LocalStream disponível: ${!!localStream}`);
    
    if (localStream) {
      console.log(`📤 WEBRTC DIAGNÓSTICO: Detalhes do LocalStream:`, {
        streamId: localStream.id,
        active: localStream.active,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length,
        totalTracks: localStream.getTracks().length
      });
      
      // Adicionar transceivers primeiro para controle completo do SDP
      localStream.getTracks().forEach((track, index) => {
        console.log(`📹 WEBRTC DIAGNÓSTICO: Processando track ${index}:`, {
          kind: track.kind,
          id: track.id,
          label: track.label,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        });

        try {
          // 1. Adicionar transceiver com direção explícita
          const transceiver = peerConnection.addTransceiver(track.kind, {
            direction: 'sendrecv'
          });
          
          console.log(`✅ WEBRTC DIAGNÓSTICO: Transceiver ${track.kind} criado:`, {
            direction: transceiver.direction,
            mid: transceiver.mid
          });

          // 2. Adicionar track ao transceiver
          peerConnection.addTrack(track, localStream);
          
          console.log(`✅ WEBRTC DIAGNÓSTICO: Track ${track.kind} adicionada ao transceiver`);
          
        } catch (error) {
          console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao adicionar transceiver/track ${track.kind}:`, error);
        }
      });
      
      // Log estado final dos transceivers
      const finalTransceivers = peerConnection.getTransceivers();
      console.log(`📊 WEBRTC DIAGNÓSTICO: Estado final - ${finalTransceivers.length} transceivers criados:`);
      finalTransceivers.forEach((transceiver, index) => {
        console.log(`🎯 WEBRTC DIAGNÓSTICO: Transceiver ${index}:`, {
          direction: transceiver.direction,
          kind: transceiver.receiver?.track?.kind || 'unknown',
          currentDirection: transceiver.currentDirection,
          mid: transceiver.mid
        });
      });
      
    } else {
      console.warn(`⚠️ WEBRTC DIAGNÓSTICO: LocalStream NÃO DISPONÍVEL para: ${participantId}`);
      console.warn(`⚠️ WEBRTC DIAGNÓSTICO: getLocalStream retornou:`, localStream);
    }

    return peerConnection;
  }

  async initiateCallWithRetry(participantId: string, maxRetries: number = 1): Promise<void> {
    const currentRetries = this.retryAttempts.get(participantId) || 0;

    // FASE 4: Verificar circuit breaker
    if (this.isCircuitBreakerOpen(participantId)) {
      console.error(`🚫 WEBRTC DIAGNÓSTICO: Circuit breaker ABERTO para ${participantId} - cancelando retry`);
      return;
    }

    if (currentRetries >= maxRetries) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Max retry attempts (${maxRetries}) reached for: ${participantId}`);
      this.recordCircuitBreakerFailure(participantId);
      return;
    }

    this.retryAttempts.set(participantId, currentRetries + 1);
    console.log(`🔄 WEBRTC DIAGNÓSTICO: Initiating call attempt ${currentRetries + 1}/${maxRetries} to: ${participantId}`);

    // FASE 2: Verificar se já existe um timeout pendente
    this.clearOfferTimeout(participantId);

    try {
      await this.initiateCall(participantId);
      
      // FASE 2: Timeout para verificar se a conexão foi estabelecida
      const timeout = setTimeout(() => {
        const pc = this.peerConnections.get(participantId);
        if (pc && (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting')) {
          console.warn(`⏱️ WEBRTC DIAGNÓSTICO: Offer timeout for ${participantId} - connection state: ${pc.connectionState}`);
          
          if (currentRetries + 1 < maxRetries) {
            console.log(`🔄 WEBRTC DIAGNÓSTICO: Auto-retrying call to ${participantId} after timeout`);
            this.initiateCallWithRetry(participantId, maxRetries);
          }
        }
      }, 10000); // 10 segundos para timeout da oferta
      
      this.offerTimeouts.set(participantId, timeout);
      
      // FASE 4: Reset circuit breaker em caso de sucesso
      this.resetCircuitBreaker(participantId);
      
    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Call initiation failed for ${participantId} (attempt ${currentRetries + 1}):`, error);
      
      // FASE 4: Registrar falha no circuit breaker
      this.recordCircuitBreakerFailure(participantId);

      if (currentRetries + 1 < maxRetries && !this.isCircuitBreakerOpen(participantId)) {
        const retryDelay = Math.min(2000 * Math.pow(2, currentRetries), 10000);
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Retrying call to ${participantId} in ${retryDelay/1000} seconds...`);
        
        setTimeout(() => {
          this.initiateCallWithRetry(participantId, maxRetries);
        }, retryDelay);
      } else {
        console.error(`❌ WEBRTC DIAGNÓSTICO: Failed to establish WebRTC connection with ${participantId} after ${maxRetries} attempts`);
      }
    }
  }

  private clearOfferTimeout(participantId: string): void {
    const existingTimeout = this.offerTimeouts.get(participantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.offerTimeouts.delete(participantId);
      console.log(`🧹 WEBRTC DIAGNÓSTICO: Cleared offer timeout for: ${participantId}`);
    }
  }

  async initiateCall(participantId: string): Promise<void> {
    console.log(`📞 WEBRTC DIAGNÓSTICO: ===== INICIANDO CALL =====`);
    console.log(`📞 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`📞 WEBRTC DIAGNÓSTICO: Timestamp: ${new Date().toISOString()}`);

    // FASE 1: LOGGING CRÍTICO DETALHADO - Estado inicial
    let peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      console.log(`🔧 WEBRTC DIAGNÓSTICO: Criando nova peer connection para ${participantId}`);
      peerConnection = this.createPeerConnection(participantId);
    }

    console.log(`🔍 WEBRTC DIAGNÓSTICO: Estado inicial da conexão:`, {
      signalingState: peerConnection.signalingState,
      iceConnectionState: peerConnection.iceConnectionState,
      iceGatheringState: peerConnection.iceGatheringState,
      connectionState: peerConnection.connectionState
    });

    // FASE 1: Validar transceivers
    const existingSenders = peerConnection.getSenders();
    const existingTransceivers = peerConnection.getTransceivers();
    const hasVideoTrack = existingSenders.some(s => s.track?.kind === 'video');
    const hasAudioTrack = existingSenders.some(s => s.track?.kind === 'audio');
    
    console.log(`🎯 WEBRTC DIAGNÓSTICO: Análise de transceivers:`, {
      totalSenders: existingSenders.length,
      totalTransceivers: existingTransceivers.length,
      hasVideo: hasVideoTrack,
      hasAudio: hasAudioTrack,
      senderDetails: existingSenders.map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        trackReadyState: s.track?.readyState,
        trackEnabled: s.track?.enabled
      }))
    });
    
    if (existingSenders.length === 0) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: CRÍTICO - Nenhuma track adicionada antes da oferta para: ${participantId}`);
      throw new Error(`CRÍTICO: Tracks não foram adicionadas antes da oferta para ${participantId}`);
    }

    // FASE 1: Delay para estabilização com logging
    console.log(`⏱️ WEBRTC DIAGNÓSTICO: Aguardando 1000ms para estabilização...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // FASE 1: LOGGING CRÍTICO - Antes de createOffer
    console.log(`🚀 WEBRTC DIAGNÓSTICO: ===== INICIANDO createOffer() =====`);
    console.log(`🚀 WEBRTC DIAGNÓSTICO: Estado antes createOffer:`, {
      signalingState: peerConnection.signalingState,
      canCreateOffer: peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-local-pranswer'
    });

    try {
      // FASE 1: CRIAR OFERTA com logging detalhado
      console.log(`📊 WEBRTC DIAGNÓSTICO: Executando createOffer()...`);
      
      const offerStartTime = performance.now();
      let offer;
      
      try {
        offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        const offerEndTime = performance.now();
        console.log(`✅ WEBRTC DIAGNÓSTICO: createOffer() SUCESSO em ${(offerEndTime - offerStartTime).toFixed(2)}ms`, {
          type: offer.type,
          sdpLength: offer.sdp?.length || 0,
          hasVideo: offer.sdp?.includes('m=video') || false,
          hasAudio: offer.sdp?.includes('m=audio') || false,
          hasICE: offer.sdp?.includes('a=candidate') || false
        });
        
        // FASE 2: Verificar SDP em detalhes
        if (offer.sdp) {
          const sdpLines = offer.sdp.split('\n');
          const videoLines = sdpLines.filter(line => line.includes('m=video'));
          const audioLines = sdpLines.filter(line => line.includes('m=audio'));
          const iceLines = sdpLines.filter(line => line.includes('a=candidate'));
          
          console.log(`🔍 WEBRTC DIAGNÓSTICO: Análise SDP da oferta:`, {
            totalLines: sdpLines.length,
            videoLines: videoLines.length,
            audioLines: audioLines.length,
            iceCandidatesInSDP: iceLines.length,
            firstVideoLine: videoLines[0] || 'N/A',
            firstAudioLine: audioLines[0] || 'N/A'
          });
        }
        
      } catch (createOfferError) {
        console.error(`❌ WEBRTC DIAGNÓSTICO: FALHA CRÍTICA em createOffer():`, createOfferError);
        console.error(`❌ WEBRTC DIAGNÓSTICO: Stack trace:`, createOfferError.stack);
        throw new Error(`createOffer() falhou: ${createOfferError.message}`);
      }

      // FASE 1: SET LOCAL DESCRIPTION com logging detalhado
      console.log(`🔧 WEBRTC DIAGNÓSTICO: ===== INICIANDO setLocalDescription() =====`);
      console.log(`🔧 WEBRTC DIAGNÓSTICO: Estado antes setLocalDescription:`, {
        signalingState: peerConnection.signalingState,
        hasLocalDescription: !!peerConnection.localDescription
      });

      const setLocalStartTime = performance.now();
      
      try {
        await peerConnection.setLocalDescription(offer);
        
        const setLocalEndTime = performance.now();
        console.log(`✅ WEBRTC DIAGNÓSTICO: setLocalDescription() SUCESSO em ${(setLocalEndTime - setLocalStartTime).toFixed(2)}ms`);
        console.log(`✅ WEBRTC DIAGNÓSTICO: Estado após setLocalDescription:`, {
          signalingState: peerConnection.signalingState,
          localDescription: !!peerConnection.localDescription,
          iceGatheringState: peerConnection.iceGatheringState
        });
        
      } catch (setLocalError) {
        console.error(`❌ WEBRTC DIAGNÓSTICO: FALHA CRÍTICA em setLocalDescription():`, setLocalError);
        console.error(`❌ WEBRTC DIAGNÓSTICO: Stack trace:`, setLocalError.stack);
        throw new Error(`setLocalDescription() falhou: ${setLocalError.message}`);
      }

      // FASE 2: ENVIAR OFERTA via WebSocket com logging
      console.log(`📤 WEBRTC DIAGNÓSTICO: ===== ENVIANDO OFERTA VIA WEBSOCKET =====`);
      console.log(`📤 WEBRTC DIAGNÓSTICO: Participante destino: ${participantId}`);
      
      const sendStartTime = performance.now();
      
      try {
        unifiedWebSocketService.sendOffer(participantId, offer);
        
        const sendEndTime = performance.now();
        console.log(`✅ WEBRTC DIAGNÓSTICO: sendOffer() SUCESSO em ${(sendEndTime - sendStartTime).toFixed(2)}ms`);
        
        // FASE 2: Iniciar timeout para ICE gathering se necessário
        this.startIceGatheringTimeout(participantId, peerConnection);
        
      } catch (sendError) {
        console.error(`❌ WEBRTC DIAGNÓSTICO: FALHA CRÍTICA em sendOffer():`, sendError);
        throw new Error(`sendOffer() falhou: ${sendError.message}`);
      }

    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: ERRO GERAL no processo de oferta:`, error);
      console.error(`❌ WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
      console.error(`❌ WEBRTC DIAGNÓSTICO: Estado final da conexão:`, {
        signalingState: peerConnection.signalingState,
        iceConnectionState: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState
      });
      throw error;
    }
  }

  // FASE 2: Método para timeout de ICE gathering
  private startIceGatheringTimeout(participantId: string, peerConnection: RTCPeerConnection): void {
    const timeout = setTimeout(() => {
      const candidates = this.iceCandidatesSent.get(participantId) || 0;
      if (candidates === 0) {
        console.warn(`⏰ WEBRTC DIAGNÓSTICO: TIMEOUT ICE GATHERING - Nenhum candidate enviado para ${participantId}`);
        console.warn(`⏰ WEBRTC DIAGNÓSTICO: Estado ICE: ${peerConnection.iceGatheringState}`);
        
        // FASE 4: MANUAL ICE RESTART
        console.log(`🔄 WEBRTC DIAGNÓSTICO: Forçando ICE restart para ${participantId}...`);
        this.forceIceRestart(participantId);
      }
    }, 5000); // 5 segundos para ICE gathering
    
    this.iceGatheringTimeouts.set(participantId, timeout);
  }

  private clearIceGatheringTimeout(participantId: string): void {
    const timeout = this.iceGatheringTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceGatheringTimeouts.delete(participantId);
      console.log(`🧹 WEBRTC DIAGNÓSTICO: Cleared ICE gathering timeout for: ${participantId}`);
    }
  }

  // FASE 4: CIRCUIT BREAKER para evitar retry loops infinitos
  private isCircuitBreakerOpen(participantId: string): boolean {
    const state = this.circuitBreaker.get(participantId);
    if (!state) return false;
    
    const now = Date.now();
    if (state.isOpen && (now - state.lastFailure) > this.CIRCUIT_BREAKER_TIMEOUT) {
      // Reset do circuit breaker após timeout
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Circuit breaker RESET após timeout para ${participantId}`);
      this.resetCircuitBreaker(participantId);
      return false;
    }
    
    return state.isOpen;
  }

  private recordCircuitBreakerFailure(participantId: string): void {
    const state = this.circuitBreaker.get(participantId) || { failures: 0, lastFailure: 0, isOpen: false };
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      console.warn(`🚫 WEBRTC DIAGNÓSTICO: Circuit breaker ABERTO para ${participantId} após ${state.failures} falhas`);
    }
    
    this.circuitBreaker.set(participantId, state);
  }

  private resetCircuitBreaker(participantId: string): void {
    this.circuitBreaker.delete(participantId);
    console.log(`✅ WEBRTC DIAGNÓSTICO: Circuit breaker RESET para ${participantId}`);
  }

  // FASE 4: FORCE CONNECTION RESTART
  private forceConnectionRestart(participantId: string): void {
    console.log(`🔄 WEBRTC DIAGNÓSTICO: ===== FORCE CONNECTION RESTART =====`);
    console.log(`🔄 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    
    // Fechar conexão existente
    const existingPC = this.peerConnections.get(participantId);
    if (existingPC) {
      existingPC.close();
      this.peerConnections.delete(participantId);
    }
    
    // Limpar timeouts
    this.clearOfferTimeout(participantId);
    this.clearIceGatheringTimeout(participantId);
    
    // Reset contadores
    this.iceCandidatesSent.delete(participantId);
    this.iceCandidatesReceived.delete(participantId);
    this.retryAttempts.delete(participantId);
    
    // Criar nova conexão após delay
    setTimeout(() => {
      console.log(`🆕 WEBRTC DIAGNÓSTICO: Criando nova conexão após restart para ${participantId}`);
      this.initiateCallWithRetry(participantId, 1);
    }, 2000);
  }

  // FASE 4: FORCE ICE RESTART
  private forceIceRestart(participantId: string): void {
    const pc = this.peerConnections.get(participantId);
    if (!pc) return;
    
    console.log(`🧊 WEBRTC DIAGNÓSTICO: Forçando ICE restart para ${participantId}`);
    
    try {
      pc.restartIce();
      console.log(`✅ WEBRTC DIAGNÓSTICO: ICE restart executado para ${participantId}`);
    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Falha no ICE restart para ${participantId}:`, error);
      this.forceConnectionRestart(participantId);
    }
  }

  async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📨 WEBRTC DIAGNÓSTICO: ===== HANDLING OFFER =====`);
    console.log(`📨 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`📨 WEBRTC DIAGNÓSTICO: Offer type: ${offer.type}`);
    console.log(`📨 WEBRTC DIAGNÓSTICO: SDP length: ${offer.sdp?.length || 0}`);

    let peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(participantId);
    }

    try {
      console.log(`🔧 WEBRTC DIAGNÓSTICO: Aplicando remote description (offer)...`);
      await peerConnection.setRemoteDescription(offer);
      console.log(`✅ WEBRTC DIAGNÓSTICO: Remote description aplicada com sucesso`);

      console.log(`📊 WEBRTC DIAGNÓSTICO: Criando answer...`);
      const answer = await peerConnection.createAnswer();
      console.log(`✅ WEBRTC DIAGNÓSTICO: Answer criada com sucesso`);

      console.log(`🔧 WEBRTC DIAGNÓSTICO: Aplicando local description (answer)...`);
      await peerConnection.setLocalDescription(answer);
      console.log(`✅ WEBRTC DIAGNÓSTICO: Local description aplicada com sucesso`);

      console.log(`📤 WEBRTC DIAGNÓSTICO: Enviando answer via WebSocket...`);
      unifiedWebSocketService.sendAnswer(participantId, answer);
      console.log(`✅ WEBRTC DIAGNÓSTICO: Answer enviada com sucesso`);

    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao processar offer:`, error);
      throw error;
    }
  }

  async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📨 WEBRTC DIAGNÓSTICO: ===== HANDLING ANSWER =====`);
    console.log(`📨 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`📨 WEBRTC DIAGNÓSTICO: Answer type: ${answer.type}`);

    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Peer connection não encontrada para ${participantId}`);
      return;
    }

    try {
      console.log(`🔧 WEBRTC DIAGNÓSTICO: Aplicando remote description (answer)...`);
      await peerConnection.setRemoteDescription(answer);
      console.log(`✅ WEBRTC DIAGNÓSTICO: Remote description (answer) aplicada com sucesso`);
    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao processar answer:`, error);
      throw error;
    }
  }

  async handleIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    console.log(`🧊 WEBRTC DIAGNÓSTICO: ===== HANDLING ICE CANDIDATE =====`);
    console.log(`🧊 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`🧊 WEBRTC DIAGNÓSTICO: Candidate details:`, candidate);

    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Peer connection não encontrada para ${participantId}`);
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      
      // FASE 2: Incrementar contador de candidates recebidos
      const currentCount = this.iceCandidatesReceived.get(participantId) || 0;
      this.iceCandidatesReceived.set(participantId, currentCount + 1);
      
      console.log(`✅ WEBRTC DIAGNÓSTICO: ICE candidate adicionado para ${participantId} (total: ${currentCount + 1})`);
    } catch (error) {
      console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao adicionar ICE candidate:`, error);
    }
  }

  handleConnectionFailure(participantId: string): void {
    console.log(`❌ WEBRTC DIAGNÓSTICO: ===== CONNECTION FAILURE =====`);
    console.log(`❌ WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      console.log(`❌ WEBRTC DIAGNÓSTICO: Estado da conexão:`, {
        connectionState: pc.connectionState,
        signalingState: pc.signalingState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState
      });
      
      pc.close();
      this.peerConnections.delete(participantId);
    }

    this.clearOfferTimeout(participantId);
    this.clearIceGatheringTimeout(participantId);
    this.clearHeartbeat(participantId);

    // FASE 4: Verificar se deve tentar reconectar
    if (!this.isCircuitBreakerOpen(participantId)) {
      console.log(`🔄 WEBRTC DIAGNÓSTICO: Tentando reconectar ${participantId} após falha...`);
      setTimeout(() => {
        this.initiateCallWithRetry(participantId, 1);
      }, 5000);
    } else {
      console.log(`🚫 WEBRTC DIAGNÓSTICO: Circuit breaker aberto - não reconectando ${participantId}`);
    }
  }

  startHeartbeat(participantId: string): void {
    console.log(`💓 WEBRTC DIAGNÓSTICO: Iniciando heartbeat para ${participantId}`);
    const interval = setInterval(() => {
      const pc = this.peerConnections.get(participantId);
      if (!pc || pc.connectionState === 'closed') {
        this.clearHeartbeat(participantId);
        return;
      }
      console.log(`💓 WEBRTC DIAGNÓSTICO: Heartbeat ${participantId}: ${pc.connectionState}`);
    }, 5000);
    
    this.heartbeatIntervals.set(participantId, interval);
  }

  clearHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`🧹 WEBRTC DIAGNÓSTICO: Heartbeat cleared for: ${participantId}`);
    }
  }

  hasActiveStream(participantId: string): boolean {
    const pc = this.peerConnections.get(participantId);
    if (!pc) return false;
    
    const receivers = pc.getReceivers();
    return receivers.some(receiver => receiver.track && receiver.track.readyState === 'live');
  }

  cleanup(): void {
    console.log('🧹 WEBRTC DIAGNÓSTICO: ===== CLEANUP =====');
    
    // Fechar todas as conexões
    this.peerConnections.forEach((pc, participantId) => {
      console.log(`🧹 WEBRTC DIAGNÓSTICO: Fechando conexão para ${participantId}`);
      pc.close();
    });
    this.peerConnections.clear();

    // Limpar timeouts
    this.offerTimeouts.forEach(timeout => clearTimeout(timeout));
    this.offerTimeouts.clear();
    
    this.iceGatheringTimeouts.forEach(timeout => clearTimeout(timeout));
    this.iceGatheringTimeouts.clear();

    // Limpar heartbeats
    this.heartbeatIntervals.forEach(interval => clearInterval(interval));
    this.heartbeatIntervals.clear();

    // Limpar contadores
    this.iceCandidatesSent.clear();
    this.iceCandidatesReceived.clear();
    this.retryAttempts.clear();
    this.circuitBreaker.clear();

    console.log('✅ WEBRTC DIAGNÓSTICO: Cleanup completado');
  }
}
