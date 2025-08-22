// FASE 5: Serviço de diagnóstico avançado de conectividade
export class ConnectivityDiagnostics {
  private static instance: ConnectivityDiagnostics;
  private iceCandidateTypes: Map<string, Set<string>> = new Map();
  private turnTestResults: Map<string, boolean> = new Map();
  private networkInfo: any = null;

  static getInstance(): ConnectivityDiagnostics {
    if (!ConnectivityDiagnostics.instance) {
      ConnectivityDiagnostics.instance = new ConnectivityDiagnostics();
    }
    return ConnectivityDiagnostics.instance;
  }

  // FASE 5: Detectar tipo de rede
  detectNetworkType(): string {
    try {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        this.networkInfo = {
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false
        };
        
        console.log('📶 NETWORK DETECTION:', this.networkInfo);
        return connection.effectiveType || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      console.warn('⚠️ Network API not available:', error);
      return 'unknown';
    }
  }

  // FASE 5: Testar conectividade TURN
  async testTurnConnectivity(turnServer: RTCIceServer): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // CRÍTICO: Mostrar credenciais sendo usadas no teste
        const serverInfo = {
          urls: turnServer.urls,
          username: turnServer.username || 'NO_USERNAME',
          hasCredential: !!turnServer.credential
        };
        console.log('🔍 CONNECTIVITY TEST: Testing TURN server with credentials:', serverInfo);
        
        // Usar server específico para teste TURN - MANTER OBJETO COMPLETO
        const pc = new RTCPeerConnection({
          iceServers: [turnServer], // Objeto completo com username/credential
          iceTransportPolicy: 'relay'
        });

        let timeout: NodeJS.Timeout;
        let resolved = false;
        let candidatesFound: string[] = [];

        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          pc.close();
        };

        const resolveOnce = (result: boolean) => {
          if (!resolved) {
            resolved = true;
            console.log(`🔍 TURN TEST RESULT: ${result ? 'SUCCESS' : 'FAILED'} - Candidates found:`, candidatesFound);
            cleanup();
            resolve(result);
          }
        };

        // CORREÇÃO: Timeout aumentado para dar tempo ao TURN allocation
        const isDesktop = !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);
        const testTimeout = isDesktop ? 30000 : 20000; // 30s desktop, 20s mobile
        
        timeout = setTimeout(() => {
          console.log(`❌ CONNECTIVITY TEST: TURN test timeout (${testTimeout/1000}s) [${isDesktop ? 'DESKTOP' : 'MOBILE'}]`);
          resolveOnce(false);
        }, testTimeout);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate || '';
            candidatesFound.push(`${event.candidate.type}:${candidate.substring(0, 50)}...`);
            
            // CORREÇÃO CRÍTICA: Detectar candidato relay pela string, não pelo type
            if (candidate.includes(' relay ')) {
              console.log('✅ CONNECTIVITY TEST: TURN relay candidate found:', candidate);
              this.turnTestResults.set(turnServer.urls as string, true);
              resolveOnce(true);
            } else {
              console.log('🔍 CONNECTIVITY TEST: ICE candidate (non-relay):', {
                type: event.candidate.type,
                protocol: event.candidate.protocol,
                address: event.candidate.address,
                port: event.candidate.port,
                candidate: candidate.substring(0, 100)
              });
            }
          }
        };

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            console.log('⚠️ CONNECTIVITY TEST: ICE gathering complete without relay');
            this.turnTestResults.set(turnServer.urls as string, false);
            resolveOnce(false);
          }
        };

        // Criar data channel para iniciar ICE gathering
        pc.createDataChannel('test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));

      } catch (error) {
        console.error('❌ CONNECTIVITY TEST: TURN test error:', error);
        resolve(false);
      }
    });
  }

  // FASE 4: Detectar NAT restritivo
  analyzeNATType(participantId: string): 'open' | 'moderate' | 'strict' | 'symmetric' {
    const candidateTypes = this.iceCandidateTypes.get(participantId);
    if (!candidateTypes) return 'open';

    const hasHost = candidateTypes.has('host');
    const hasServerReflexive = candidateTypes.has('srflx');
    const hasRelay = candidateTypes.has('relay');

    console.log(`🔍 NAT ANALYSIS for ${participantId}:`, {
      host: hasHost,
      srflx: hasServerReflexive,
      relay: hasRelay,
      types: Array.from(candidateTypes)
    });

    if (hasRelay && hasServerReflexive && hasHost) {
      return 'open';
    } else if (hasServerReflexive && hasHost) {
      return 'moderate';
    } else if (hasHost && !hasServerReflexive) {
      return 'strict';
    } else if (!hasHost && !hasServerReflexive) {
      return 'symmetric';
    }

    return 'moderate';
  }

  // FASE 2: Registrar tipos de candidatos ICE
  recordICECandidate(participantId: string, candidate: RTCIceCandidate): void {
    if (!this.iceCandidateTypes.has(participantId)) {
      this.iceCandidateTypes.set(participantId, new Set());
    }
    
    const types = this.iceCandidateTypes.get(participantId)!;
    types.add(candidate.type || 'unknown');
    
    console.log(`📊 ICE CANDIDATE ${participantId}:`, {
      type: candidate.type,
      protocol: candidate.protocol,
      address: candidate.address,
      port: candidate.port,
      foundation: candidate.foundation,
      priority: candidate.priority
    });
  }

  // FASE 3: Timeout para ICE gathering
  async waitForICEGathering(pc: RTCPeerConnection, timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        console.log('⏰ ICE GATHERING TIMEOUT: Forcing completion');
        resolve(false);
      }, timeoutMs);

      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  // FASE 5: Relatório completo de diagnóstico
  generateDiagnosticReport(participantId: string): any {
    const candidateTypes = this.iceCandidateTypes.get(participantId);
    const natType = this.analyzeNATType(participantId);
    const networkType = this.detectNetworkType();
    
    return {
      participantId,
      timestamp: Date.now(),
      networkInfo: this.networkInfo,
      networkType,
      natType,
      iceCandidateTypes: candidateTypes ? Array.from(candidateTypes) : [],
      turnTestResults: Object.fromEntries(this.turnTestResults),
      recommendations: this.generateRecommendations(natType, networkType)
    };
  }

  private generateRecommendations(natType: string, networkType: string): string[] {
    const recommendations: string[] = [];
    
    if (natType === 'strict' || natType === 'symmetric') {
      recommendations.push('Use TURN servers mandatory (iceTransportPolicy: relay)');
      recommendations.push('Consider TCP TURN fallback for UDP blocks');
    }
    
    if (networkType === 'slow' || networkType === '2g' || networkType === '3g') {
      recommendations.push('Increase connection timeouts');
      recommendations.push('Use lower quality media constraints');
      recommendations.push('Enable aggressive reconnection strategy');
    }
    
    if (this.networkInfo?.saveData) {
      recommendations.push('Data saver mode detected - optimize for bandwidth');
    }
    
    return recommendations;
  }

  // Cleanup para liberar recursos
  cleanup(participantId?: string): void {
    if (participantId) {
      this.iceCandidateTypes.delete(participantId);
    } else {
      this.iceCandidateTypes.clear();
      this.turnTestResults.clear();
      this.networkInfo = null;
    }
  }
}

export const connectivityDiagnostics = ConnectivityDiagnostics.getInstance();