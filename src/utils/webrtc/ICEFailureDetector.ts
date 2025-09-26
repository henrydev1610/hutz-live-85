// FASE 4: Detector avançado de falhas ICE com fallback automático para relay

export interface ICEFailureMetrics {
  participantId: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  candidatesGathered: number;
  candidatesSent: number;
  candidatesReceived: number;
  timeInState: number;
  lastStateChange: number;
}

export class ICEFailureDetector {
  private connectionMetrics: Map<string, ICEFailureMetrics> = new Map();
  private stateChangeTimers: Map<string, NodeJS.Timeout> = new Map();
  private failureCallbacks: Map<string, () => void> = new Map();
  
  // FASE 4: Timeouts otimizados para diferentes cenários
  private readonly TIMEOUTS = {
    ICE_CHECKING: 20000,      // 20s para sair de "checking"
    ICE_CONNECTING: 15000,    // 15s para estabelecer conexão
    ICE_GATHERING: 10000,     // 10s para coletar candidates
    RELAY_FALLBACK: 25000     // 25s antes de forçar relay
  };

  // FASE 4: Registrar conexão para monitoramento
  registerConnection(
    participantId: string, 
    peerConnection: RTCPeerConnection,
    onFailure: () => void
  ): void {
    console.log(`🔍 ICE-DETECTOR: Registering ${participantId} for monitoring`);
    
    // Inicializar métricas
    const metrics: ICEFailureMetrics = {
      participantId,
      connectionState: peerConnection.connectionState,
      iceConnectionState: peerConnection.iceConnectionState,
      iceGatheringState: peerConnection.iceGatheringState,
      candidatesGathered: 0,
      candidatesSent: 0,
      candidatesReceived: 0,
      timeInState: 0,
      lastStateChange: Date.now()
    };
    
    this.connectionMetrics.set(participantId, metrics);
    this.failureCallbacks.set(participantId, onFailure);
    
    // Configurar monitoramento de eventos
    this.setupConnectionMonitoring(participantId, peerConnection);
    this.startFailureTimer(participantId, 'initial');
  }

  private setupConnectionMonitoring(participantId: string, pc: RTCPeerConnection): void {
    // Monitorar mudanças de estado ICE
    pc.oniceconnectionstatechange = () => {
      this.updateMetrics(participantId, {
        iceConnectionState: pc.iceConnectionState,
        lastStateChange: Date.now(),
        timeInState: 0
      });
      
      console.log(`🧊 ICE-DETECTOR: ${participantId} ICE state: ${pc.iceConnectionState}`);
      this.handleICEStateChange(participantId, pc.iceConnectionState);
    };

    // Monitorar estado da conexão
    pc.onconnectionstatechange = () => {
      this.updateMetrics(participantId, {
        connectionState: pc.connectionState,
        lastStateChange: Date.now()
      });
      
      console.log(`🔗 ICE-DETECTOR: ${participantId} connection state: ${pc.connectionState}`);
      this.handleConnectionStateChange(participantId, pc.connectionState);
    };

    // Monitorar gathering ICE
    pc.onicegatheringstatechange = () => {
      this.updateMetrics(participantId, {
        iceGatheringState: pc.iceGatheringState,
        lastStateChange: Date.now()
      });
      
      console.log(`📡 ICE-DETECTOR: ${participantId} ICE gathering: ${pc.iceGatheringState}`);
      this.handleGatheringStateChange(participantId, pc.iceGatheringState);
    };

    // Contar candidates
    const originalOnIceCandidate = pc.onicecandidate;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const metrics = this.connectionMetrics.get(participantId);
        if (metrics) {
          metrics.candidatesGathered++;
          metrics.candidatesSent++;
        }
        console.log(`🧊 ICE-DETECTOR: ${participantId} candidate gathered (total: ${metrics?.candidatesGathered})`);
      }
      
      if (originalOnIceCandidate) {
        originalOnIceCandidate.call(pc, event);
      }
    };
  }

  private handleICEStateChange(participantId: string, state: RTCIceConnectionState): void {
    this.clearTimer(participantId);
    
    switch (state) {
      case 'checking':
        console.log(`⏱️ ICE-DETECTOR: ${participantId} starting ICE checking timer`);
        this.startFailureTimer(participantId, 'checking');
        break;
        
      case 'connected':
      case 'completed':
        console.log(`✅ ICE-DETECTOR: ${participantId} ICE connection successful`);
        this.clearTimer(participantId);
        break;
        
      case 'failed':
        console.error(`❌ ICE-DETECTOR: ${participantId} ICE connection failed`);
        this.triggerFailure(participantId, 'ICE connection failed');
        break;
        
      case 'disconnected':
        console.warn(`⚠️ ICE-DETECTOR: ${participantId} ICE disconnected`);
        // Dar tempo para reconexão antes de considerar falha
        this.startFailureTimer(participantId, 'disconnected');
        break;
    }
  }

  private handleConnectionStateChange(participantId: string, state: RTCPeerConnectionState): void {
    switch (state) {
      case 'connecting':
        this.startFailureTimer(participantId, 'connecting');
        break;
        
      case 'connected':
        console.log(`✅ ICE-DETECTOR: ${participantId} peer connection established`);
        this.clearTimer(participantId);
        break;
        
      case 'failed':
        console.error(`❌ ICE-DETECTOR: ${participantId} peer connection failed`);
        this.triggerFailure(participantId, 'Peer connection failed');
        break;
    }
  }

  private handleGatheringStateChange(participantId: string, state: RTCIceGatheringState): void {
    if (state === 'gathering') {
      this.startFailureTimer(participantId, 'gathering');
    } else if (state === 'complete') {
      const metrics = this.connectionMetrics.get(participantId);
      if (metrics && metrics.candidatesGathered === 0) {
        console.warn(`⚠️ ICE-DETECTOR: ${participantId} gathering complete but no candidates collected`);
        this.triggerFailure(participantId, 'No ICE candidates gathered');
      }
    }
  }

  private startFailureTimer(participantId: string, context: string): void {
    this.clearTimer(participantId);
    
    let timeout: number;
    switch (context) {
      case 'checking':
        timeout = this.TIMEOUTS.ICE_CHECKING;
        break;
      case 'connecting':
        timeout = this.TIMEOUTS.ICE_CONNECTING;
        break;
      case 'gathering':
        timeout = this.TIMEOUTS.ICE_GATHERING;
        break;
      case 'disconnected':
        timeout = this.TIMEOUTS.RELAY_FALLBACK;
        break;
      default:
        timeout = this.TIMEOUTS.RELAY_FALLBACK;
    }
    
    console.log(`⏰ ICE-DETECTOR: ${participantId} starting ${context} timer (${timeout}ms)`);
    
    const timer = setTimeout(() => {
      console.error(`⏰ ICE-DETECTOR: ${participantId} timeout in ${context} state`);
      this.triggerFailure(participantId, `Timeout in ${context} state`);
    }, timeout);
    
    this.stateChangeTimers.set(participantId, timer);
  }

  private clearTimer(participantId: string): void {
    const timer = this.stateChangeTimers.get(participantId);
    if (timer) {
      clearTimeout(timer);
      this.stateChangeTimers.delete(participantId);
    }
  }

  private triggerFailure(participantId: string, reason: string): void {
    console.error(`🚨 ICE-DETECTOR: FAILURE detected for ${participantId}: ${reason}`);
    
    const metrics = this.connectionMetrics.get(participantId);
    if (metrics) {
      console.error(`📊 ICE-DETECTOR: Failure metrics:`, {
        participantId,
        reason,
        connectionState: metrics.connectionState,
        iceConnectionState: metrics.iceConnectionState,
        candidatesGathered: metrics.candidatesGathered,
        timeInCurrentState: Date.now() - metrics.lastStateChange
      });
    }
    
    const callback = this.failureCallbacks.get(participantId);
    if (callback) {
      callback();
    }
    
    // Emitir evento global para monitoramento
    window.dispatchEvent(new CustomEvent('webrtc-ice-failure', {
      detail: { participantId, reason, metrics, timestamp: Date.now() }
    }));
  }

  // Atualizar métricas
  private updateMetrics(participantId: string, updates: Partial<ICEFailureMetrics>): void {
    const current = this.connectionMetrics.get(participantId);
    if (current) {
      Object.assign(current, updates);
      this.connectionMetrics.set(participantId, current);
    }
  }

  // Registrar candidate recebido
  recordCandidateReceived(participantId: string): void {
    const metrics = this.connectionMetrics.get(participantId);
    if (metrics) {
      metrics.candidatesReceived++;
    }
  }

  // Obter métricas
  getMetrics(participantId: string): ICEFailureMetrics | null {
    return this.connectionMetrics.get(participantId) || null;
  }

  getAllMetrics(): Map<string, ICEFailureMetrics> {
    return new Map(this.connectionMetrics);
  }

  // FASE 4: Detectar se rede pode estar restritiva
  isNetworkRestrictive(participantId: string): boolean {
    const metrics = this.connectionMetrics.get(participantId);
    if (!metrics) return false;
    
    // Indícios de rede restritiva:
    // 1. Poucos candidates coletados
    // 2. Tempo excessivo em "checking"
    // 3. Nenhum candidate do tipo "host"
    
    const timeInChecking = metrics.iceConnectionState === 'checking' ? 
      Date.now() - metrics.lastStateChange : 0;
    
    return metrics.candidatesGathered < 2 || timeInChecking > 10000;
  }

  // Limpeza
  unregisterConnection(participantId: string): void {
    console.log(`🧹 ICE-DETECTOR: Unregistering ${participantId}`);
    
    this.clearTimer(participantId);
    this.connectionMetrics.delete(participantId);
    this.failureCallbacks.delete(participantId);
  }

  cleanup(): void {
    console.log(`🧹 ICE-DETECTOR: Full cleanup`);
    
    for (const participantId of this.connectionMetrics.keys()) {
      this.unregisterConnection(participantId);
    }
  }
}

// Singleton global
export const iceFailureDetector = new ICEFailureDetector();