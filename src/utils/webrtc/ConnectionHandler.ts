import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { setupOnTrackWithTimeout, setupICEGatheringTimeout, validateTransceiversPostNegotiation } from './ConnectionHandlerMethods';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';
import { detectRestrictiveNetwork, getAdaptiveTimeout, prioritizeIceServers } from './ConnectionHandlerMethods';

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

    // FASE 5: Cache de detecção de rede
    private networkTypeCache: { type: string, timestamp: number } | null = null;
    private readonly NETWORK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

    constructor(
        peerConnections: Map<string, RTCPeerConnection>,
        getLocalStream: () => MediaStream | null
    ) {
        this.peerConnections = peerConnections;
        this.getLocalStream = getLocalStream;
    }

    setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
        this.streamCallback = callback;
        const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
        if (DEBUG) console.log('📞 [WRTC] Stream callback set');
    }

    setParticipantJoinCallback(callback: (participantId: string) => void) {
        this.participantJoinCallback = callback;
        const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
        if (DEBUG) console.log('👤 [WRTC] Participant callback set');
    }

    // FASE 2: Novo método para iniciar handshake automático
    async initiateHandshake(participantId: string): Promise<void> {
        console.log(`🤝 [WRTC] Initiating handshake: ${participantId}`);

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
        console.log(`🔗 [WRTC] Creating peer connection: ${participantId}`);
        const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
        if (DEBUG) {
            console.log('🔗 [WRTC] Debug info:', {
                participant: participantId,
                existingConnections: this.peerConnections.size,
                hasStreamCallback: !!this.streamCallback
            });
        }

        // FASE 1: Detectar se é host e forçar modo receive-only
        const isHost = participantId === 'host' || this.currentParticipantId === 'host';
        const hasLocalTracksForConnection = this.getLocalStream() && this.getLocalStream()!.getTracks().length > 0;

        console.log(`🎯 FASE 1: Detectando tipo de conexão:`, {
            participantId,
            isHost,
            hasLocalTracks: hasLocalTracksForConnection,
            forceRecvOnly: isHost || !hasLocalTracksForConnection
        });

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
        const baseId = `relay-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${performance.now()}`;

        // Guard global para evitar duplicatas
        if (!(window as any).__relayIds) (window as any).__relayIds = new Set();
        let uniqueId = baseId;
        if ((window as any).__relayIds.has(uniqueId)) {
            uniqueId += `-fallback-${Math.random().toString(36).substr(2, 5)}`;
        }
        (window as any).__relayIds.add(uniqueId);

        // FASE 1: Usar configuração otimizada de STUN/TURN
        const config = getActiveWebRTCConfig();

        // FASE 5: Detectar redes restritivas e aplicar relay obrigatório
        const isRestrictiveNetwork = detectRestrictiveNetwork();
        if (isRestrictiveNetwork) {
            config.iceTransportPolicy = 'relay';
            console.log('🚫 [WRTC] Rede restritiva detectada - forçando TURN relay');
        }

        // FASE 5: Priorizar servidores ICE para melhor conectividade
        if (config.iceServers) {
            config.iceServers = prioritizeIceServers(config.iceServers);
        }

        console.log(`🔧 [WRTC] Configuração WebRTC para ${uniqueId}:`, {
            iceServers: (config.iceServers || []).map(s => ({
                urls: (s as any).urls,
                hasCred: !!(s as any).credential,
                type: (s as any).urls.includes('turn') ? 'TURN' : 'STUN'
            })),
            icePolicy: config.iceTransportPolicy,
            bundlePolicy: config.bundlePolicy,
            candidatePoolSize: config.iceCandidatePoolSize
        });

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

        // FASE 2: CORREÇÃO DO ONTRACK CRÍTICA
        console.log(`🔧 FASE 2: Configurando ontrack CORRIGIDO para ${participantId}`);

        let onTrackReceived = false;
        let onTrackFallbackExecuted = false;

        // FASE 6: Timeout reduzido para 8s com fallback mais agressivo
        const onTrackTimeout = setTimeout(() => {
            if (!onTrackReceived && !onTrackFallbackExecuted) {
                onTrackFallbackExecuted = true;
                console.error(`❌ FASE 6: CRÍTICO - ontrack NUNCA disparou para ${participantId} em 8s`);

                // FASE 6: DIAGNÓSTICO - verificar transceivers
                const transceivers = peerConnection.getTransceivers();
                console.log(`🔍 FASE 6: Transceivers disponíveis: ${transceivers.length}`);
                transceivers.forEach((t, i) => {
                    console.log(`📡 Transceiver ${i}:`, {
                        direction: t.direction,
                        currentDirection: t.currentDirection,
                        receiver: t.receiver?.track?.kind,
                        receiverReadyState: t.receiver?.track?.readyState
                    });
                });

                // FASE 6: Verificar se answer foi aplicada corretamente
                console.log(`🔍 FASE 6: Estado da PeerConnection:`, {
                    signalingState: peerConnection.signalingState,
                    connectionState: peerConnection.connectionState,
                    iceConnectionState: peerConnection.iceConnectionState,
                    localDescription: !!peerConnection.localDescription,
                    remoteDescription: !!peerConnection.remoteDescription
                });

                // FASE 6: FALLBACK MELHORADO - tentar extrair stream dos transceivers
                const videoTransceiver = transceivers.find(t => t.receiver?.track?.kind === 'video');
                if (videoTransceiver && videoTransceiver.receiver?.track) {
                    console.log(`🔄 FASE 6: FALLBACK - Tentando criar stream dos transceivers`);

                    const tracks = transceivers
                        .map(t => t.receiver?.track)
                        .filter(track => track && track.readyState === 'live');

                    if (tracks.length > 0) {
                        const syntheticStream = new MediaStream(tracks as MediaStreamTrack[]);
                        console.log(`🎉 FASE 6: STREAM SINTÉTICO criado:`, {
                            streamId: syntheticStream.id,
                            tracks: syntheticStream.getTracks().length
                        });

                        this.handleTrackReceived(participantId, syntheticStream);
                    } else {
                        console.error(`❌ FASE 6: Nenhuma track utilizável encontrada`);
                        this.forceConnectionRestart(participantId);
                    }
                } else {
                    console.error(`❌ FASE 6: Nenhum transceiver de vídeo encontrado`);
                    this.forceConnectionRestart(participantId);
                }
            }
        }, 8000);

        // FASE 2: ONTRACK CORRIGIDO com múltiplas pontes
        peerConnection.ontrack = (event) => {
            onTrackReceived = true;
            const [stream] = event.streams;
            clearTimeout(onTrackTimeout);

            console.log(`🎥 [HOST] ontrack received stream:`, stream);
            console.log('🎉 FASE 2: ===== ONTRACK DISPARADO COM SUCESSO =====');
            console.log('🎉 FASE 2: Participante:', participantId);
            console.log('🎉 FASE 2: Event details:', {
                streamsCount: event.streams?.length || 0,
                trackKind: event.track?.kind,
                trackId: event.track?.id,
                trackReadyState: event.track?.readyState,
                trackEnabled: event.track?.enabled,
                receiverTransport: event.receiver?.transport?.state
            });

            if (event.streams && event.streams.length > 0) {
                const stream = event.streams[0];
                console.log('🎉 FASE 2: Stream CONFIRMADO recebido:', {
                    streamId: stream.id,
                    trackCount: stream.getTracks().length,
                    participantId,
                    active: stream.active,
                    videoTracks: stream.getVideoTracks().length,
                    audioTracks: stream.getAudioTracks().length,
                    trackDetails: stream.getTracks().map(track => ({
                        kind: track.kind,
                        id: track.id,
                        enabled: track.enabled,
                        readyState: track.readyState
                    }))
                });

                // FASE 1+3: CRÍTICO - Eventos compatíveis com Lovable
                console.log(`🎯 EVENTO DIRETO LOVABLE: Disparando stream-received-${participantId}`);

                // Detectar ambiente e ajustar eventos
                const isLovable = window.location.hostname.includes('lovable') ||
                    !!document.querySelector('script[src*="gptengineer"]');

                if (isLovable) {
                    console.log(`🌉 LOVABLE DETECTED: Usando eventos aprimorados para ${participantId}`);
                }

                window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
                    detail: {
                        participantId,
                        stream,
                        timestamp: Date.now(),
                        isP1: true,
                        isLovableEnvironment: isLovable,
                        streamMetadata: {
                            id: stream.id,
                            active: stream.active,
                            tracks: stream.getTracks().length,
                            videoTracks: stream.getVideoTracks().length,
                            audioTracks: stream.getAudioTracks().length
                        }
                    }
                }));

                // FASE 1+3: CRÍTICO - Evento global aprimorado
                console.log(`🌍 EVENTO GLOBAL LOVABLE: Disparando participant-stream-connected`);
                window.dispatchEvent(new CustomEvent('participant-stream-connected', {
                    detail: {
                        participantId,
                        stream,
                        timestamp: Date.now(),
                        environment: isLovable ? 'lovable' : 'standard',
                        requiresFallback: isLovable
                    }
                }));

                // FASE 2: CALLBACK GLOBAL CRÍTICO
                console.log(`🔥 FASE 2: CALLBACK DIRETO - chamando this.streamCallback para ${participantId}`);
                this.streamCallback?.(participantId, stream); // Callback global

                console.log('🎉 FASE 2: ONTRACK processado com sucesso - video deve aparecer agora!');
            } else {
                console.warn('⚠️ FASE 2: ontrack sem streams - tentando construir do evento');

                // FASE 2: Fallback - tentar construir stream do track individual
                if (event.track && event.track.readyState === 'live') {
                    console.log('🔄 FASE 2: Construindo stream do track individual');
                    const syntheticStream = new MediaStream([event.track]);
                    this.handleTrackReceived(participantId, syntheticStream);
                } else {
                    console.error('❌ FASE 2: Track inválido ou não live');
                }
            }
        // CRÍTICO: Usar transceivers pré-alocados - NUNCA mais addTrack
        console.log(`📹 [CONNECTION] Using pre-allocated transceivers for ${participantId} - NO MORE addTrack`);
        
        // Validate that transceivers were pre-allocated
        const transceivers = peerConnection.getTransceivers();
        if (transceivers.length !== 2) {
            throw new Error(`Expected 2 pre-allocated transceivers for ${participantId}, found ${transceivers.length}`);
        }
        
        console.log(`✅ [CONNECTION] Pre-allocated transceivers validated for ${participantId}:`, {
            videoDirection: transceivers[0].direction,
            audioDirection: transceivers[1].direction
        });

        // Setup event handlers
        const setupStartTime = performance.now();

        // REMOVIDO: onnegotiationneeded management moved to handshake modules
        console.log(`✅ [CONNECTION] Skipping onnegotiationneeded setup - handled by handshake modules`);
        
        return peerConnection;
    }

    // FASE 2: Novo método centralizado para lidar com tracks recebidos
    private handleTrackReceived(participantId: string, stream: MediaStream): void {
        console.log('🎉 FASE 2: ===== PROCESSANDO TRACK RECEBIDO =====');
        console.log('🎉 FASE 2: Stream:', {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().length
        });

        // PONTE 1: Callback React direto (PRIORIDADE MÁXIMA)
        if (this.streamCallback) {
            console.log('📞 FASE 2: Executando callback React IMEDIATO');
            try {
                this.streamCallback(participantId, stream);
                console.log('✅ FASE 2: Callback React executado com SUCESSO');
            } catch (error) {
                console.error('❌ FASE 2: Erro no callback React:', error);
            }
        } else {
            console.error('❌ FASE 2: CRÍTICO - Callback React não definido!');
        }

        // PONTE 2: Eventos customizados múltiplos (BACKUP)
        setTimeout(() => {
            console.log('📡 FASE 2: Disparando eventos de backup...');

            // Event 1: Para containers de vídeo
            window.dispatchEvent(new CustomEvent('stream-received', {
                detail: { participantId, stream }
            }));

            // Event 2: Para grid de participantes
            window.dispatchEvent(new CustomEvent('participant-stream-connected', {
                detail: { participantId, stream }
            }));

            // Event 3: Para forçar atualização geral
            window.dispatchEvent(new CustomEvent('force-stream-state-update', {
                detail: {
                    participantId,
                    stream,
                    streamId: stream.id,
                    timestamp: Date.now()
                }
            }));

            console.log('✅ FASE 2: Eventos de backup disparados');
        }, 100);

        // PONTE 3: BroadcastChannel para comunicação cross-tab
        try {
            const bc = new BroadcastChannel('webrtc-stream-bridge');
            bc.postMessage({
                action: 'stream-received',
                participantId,
                streamId: stream.id,
                timestamp: Date.now()
            });
            bc.close();
            console.log('📻 FASE 2: BroadcastChannel enviado');
        } catch (e) {
            console.warn('⚠️ FASE 2: BroadcastChannel failed:', e);
        }
    }

    async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`📥 WEBRTC DIAGNÓSTICO: Received offer from ${participantId}`);

        const peerConnection = this.peerConnections.get(participantId) || this.createPeerConnection(participantId);

        try {
            await peerConnection.setRemoteDescription(offer);
            console.log(`✅ WEBRTC DIAGNÓSTICO: Set remote description for ${participantId}`);
            const buffered = (window as any).__bufferedIce?.[participantId];
            if (buffered && buffered.length > 0) {
                console.log(`🔄 Reaplicando ${buffered.length} ICE candidates bufferizados para ${participantId}`);
                for (const cand of buffered) {
                    try {
                        await peerConnection.addIceCandidate(cand);
                        console.log("✅ Candidate reaplicado do buffer:", cand);
                    } catch (err) {
                        console.error("❌ Falha ao aplicar candidate do buffer:", err);
                    }
                }
                (window as any).__bufferedIce[participantId] = [];
            }
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log(`📤 WEBRTC DIAGNÓSTICO: Sending answer to ${participantId}`);
            unifiedWebSocketService.sendAnswer(participantId, answer);

        } catch (error) {
            console.error(`❌ WEBRTC DIAGNÓSTICO: Error handling offer from ${participantId}:`, error);
            throw error;
        }
    }

    async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`📥 WEBRTC DIAGNÓSTICO: Received answer from ${participantId}`);

        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            console.error(`❌ WEBRTC DIAGNÓSTICO: No peer connection found for ${participantId}`);
            return;
        }

        try {
            await peerConnection.setRemoteDescription(answer);

            console.log(`✅ WEBRTC DIAGNÓSTICO: Set remote description (answer) for ${participantId}`);
            const buffered = (window as any).__bufferedIce?.[participantId];
            if (buffered && buffered.length > 0) {
                console.log(`🔄 Reaplicando ${buffered.length} ICE candidates bufferizados para ${participantId}`);
                for (const cand of buffered) {
                    try {
                        await peerConnection.addIceCandidate(cand);
                        console.log("✅ Candidate reaplicado do buffer:", cand);
                    } catch (err) {
                        console.error("❌ Falha ao aplicar candidate do buffer:", err);
                    }
                }
                (window as any).__bufferedIce[participantId] = [];
            }
        } catch (error) {
            console.error(`❌ WEBRTC DIAGNÓSTICO: Error handling answer from ${participantId}:`, error);
            throw error;
        }
    }

    async handleIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
        console.log(`🧊 WEBRTC DIAGNÓSTICO: Received ICE candidate from ${participantId}`);

        const peerConnection = this.peerConnections.get(participantId);

        if (!peerConnection || !peerConnection.remoteDescription) {
            console.warn("⚠️ Bufferizando ICE candidate recebido (peerConnection não pronto)", candidate);

            (window as any).__bufferedIce = (window as any).__bufferedIce || {};
            (window as any).__bufferedIce[participantId] = (window as any).__bufferedIce[participantId] || [];
            (window as any).__bufferedIce[participantId].push(candidate);
            return;
        }

        try {
            await peerConnection.addIceCandidate(candidate);
            console.log(`✅ WEBRTC DIAGNÓSTICO: Candidate aplicado imediatamente para ${participantId}`);
        } catch (error) {
            console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao aplicar ICE candidate para ${participantId}:`, error);
        }
    }


    closePeerConnection(participantId: string): void {
        console.log(`🔌 WEBRTC DIAGNÓSTICO: Closing peer connection for ${participantId}`);

        const peerConnection = this.peerConnections.get(participantId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(participantId);

            // Limpar timeouts e contadores
            this.clearOfferTimeout(participantId);
            this.clearIceGatheringTimeout(participantId);
            this.iceCandidatesSent.delete(participantId);
            this.iceCandidatesReceived.delete(participantId);

            console.log(`✅ WEBRTC DIAGNÓSTICO: Peer connection closed for ${participantId}`);
        }
    }

    cleanup(): void {
        console.log('🧹 WEBRTC DIAGNÓSTICO: Cleaning up all connections');

        this.peerConnections.forEach((pc, participantId) => {
            this.closePeerConnection(participantId);
        });

        this.peerConnections.clear();
        this.retryAttempts.clear();
        this.heartbeatIntervals.clear();
        this.offerTimeouts.clear();
        this.iceCandidatesSent.clear();
        this.iceCandidatesReceived.clear();
        this.iceGatheringTimeouts.clear();
        this.circuitBreaker.clear();
    }

    private forceConnectionRestart(participantId: string): void {
        console.log(`🔄 FASE 2: FORÇANDO RESTART da conexão para ${participantId}`);

        const peerConnection = this.peerConnections.get(participantId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(participantId);
        }

        // Disparar evento para restart no nível superior
        window.dispatchEvent(new CustomEvent('force-connection-restart', {
            detail: { participantId, reason: 'ontrack-timeout' }
        }));
    }

    // FASE 4: Circuit Breaker methods
    private isCircuitBreakerOpen(participantId: string): boolean {
        const breaker = this.circuitBreaker.get(participantId);
        if (!breaker) return false;

        const now = Date.now();
        if (breaker.isOpen && (now - breaker.lastFailure) > this.CIRCUIT_BREAKER_TIMEOUT) {
            // Reset circuit breaker after timeout
            breaker.isOpen = false;
            breaker.failures = 0;
        }

        return breaker.isOpen;
    }

    private recordCircuitBreakerFailure(participantId: string): void {
        const breaker = this.circuitBreaker.get(participantId) || { failures: 0, lastFailure: 0, isOpen: false };
        breaker.failures++;
        breaker.lastFailure = Date.now();

        if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
            breaker.isOpen = true;
            console.log(`🚫 CIRCUIT BREAKER: Opened for ${participantId} after ${breaker.failures} failures`);
        }

        this.circuitBreaker.set(participantId, breaker);
    }

    private resetCircuitBreaker(participantId: string): void {
        const breaker = this.circuitBreaker.get(participantId);
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
        }
    }

    private clearOfferTimeout(participantId: string): void {
        const timeout = this.offerTimeouts.get(participantId);
        if (timeout) {
            clearTimeout(timeout);
            this.offerTimeouts.delete(participantId);
        }
    }

    private clearIceGatheringTimeout(participantId: string): void {
        const timeout = this.iceGatheringTimeouts.get(participantId);
        if (timeout) {
            clearTimeout(timeout);
            this.iceGatheringTimeouts.delete(participantId);
        }
    }

    private handleConnectionFailure(participantId: string): void {
        console.log(`❌ WEBRTC: Handling connection failure for ${participantId}`);
        // Implement connection failure handling logic
    }

    private async initiateCall(participantId: string): Promise<void> {
        const peerConnection = this.peerConnections.get(participantId);
        if (!peerConnection) {
            throw new Error(`❌ No RTCPeerConnection found for ${participantId}`);
        }

        try {
            console.log(`📞 WEBRTC: Generating offer for ${participantId}`);
            const offer = await peerConnection.createOffer();

            await peerConnection.setLocalDescription(offer);
            console.log(`📤 WEBRTC: Sending offer to ${participantId}`);
            unifiedWebSocketService.sendOffer(participantId, offer);
        } catch (error) {
            console.error(`❌ WEBRTC: Failed to initiate call with ${participantId}`, error);
            throw error;
        }
    }

    initiateCallWithRetry(participantId: string, retries: number = 3): Promise<boolean> {
        console.log(`📞 WEBRTC: Initiating call with retry to ${participantId}`);
        return this.initiateCall(participantId).then(() => true).catch(() => false);
    }
}
