// FASE 1: Serviço de diagnóstico automático TURN
import { getWebRTCConfig, setDynamicIceServers } from '@/utils/webrtc/WebRTCConfig';
import { connectivityDiagnostics } from '@/utils/webrtc/ConnectivityDiagnostics';
import { toast } from 'sonner';

interface TurnServerStatus {
  url: string;
  username?: string;
  status: 'testing' | 'connected' | 'failed' | 'timeout';
  latency?: number;
  error?: string;
  lastTested: number;
}

interface TurnDiagnosticResult {
  allServersStatus: TurnServerStatus[];
  workingServers: TurnServerStatus[];
  bestServer?: TurnServerStatus;
  recommendFallback: boolean;
  overallHealth: 'healthy' | 'degraded' | 'failed';
}

class TurnConnectivityService {
  private static instance: TurnConnectivityService;
  private turnServers: RTCIceServer[] = [];
  private lastDiagnostic: TurnDiagnosticResult | null = null;
  private diagnosticCache: Map<string, TurnServerStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunningDiagnostic = false;

  // FASE 2: Timeouts otimizados para detecção rápida
  private readonly TURN_TEST_TIMEOUT = 5000; // 5s (reduzido de 15s)
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30s
  private readonly CACHE_DURATION = 60000; // 1min cache

  static getInstance(): TurnConnectivityService {
    if (!TurnConnectivityService.instance) {
      TurnConnectivityService.instance = new TurnConnectivityService();
    }
    return TurnConnectivityService.instance;
  }

  constructor() {
    this.loadTurnServers();
    this.startHealthMonitoring();
  }

  private loadTurnServers() {
    const config = getWebRTCConfig();
    this.turnServers = config.iceServers?.filter(server => 
      Array.isArray(server.urls) 
        ? server.urls.some(url => url.startsWith('turn:'))
        : typeof server.urls === 'string' && server.urls.startsWith('turn:')
    ) || [];
    
    console.log('🧊 [TURN] Loaded TURN servers:', this.turnServers.length);
  }

  // FASE 1: Teste automático de conectividade TURN
  async runDiagnostic(showToasts = false): Promise<TurnDiagnosticResult> {
    if (this.isRunningDiagnostic) {
      console.log('🧊 [TURN] Diagnostic already running, skipping...');
      return this.lastDiagnostic || this.getEmptyResult();
    }

    this.isRunningDiagnostic = true;
    console.log('🧊 [TURN] Starting TURN connectivity diagnostic...');
    
    if (showToasts) {
      toast.info('🧊 Testando servidores TURN...', { duration: 2000 });
    }

    const startTime = Date.now();
    const serverTests = this.turnServers.map(server => this.testTurnServer(server));
    
    try {
      const results = await Promise.allSettled(serverTests);
      const allServersStatus: TurnServerStatus[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          const server = this.turnServers[index];
          const url = Array.isArray(server.urls) ? server.urls[0] : server.urls;
          return {
            url,
            username: (server as any).username,
            status: 'failed' as const,
            error: result.reason?.message || 'Unknown error',
            lastTested: Date.now()
          };
        }
      });

      const workingServers = allServersStatus.filter(s => s.status === 'connected');
      const bestServer = workingServers.sort((a, b) => (a.latency || 999999) - (b.latency || 999999))[0];

      const result: TurnDiagnosticResult = {
        allServersStatus,
        workingServers,
        bestServer,
        recommendFallback: workingServers.length === 0,
        overallHealth: workingServers.length > 0 ? 'healthy' : 'failed'
      };

      this.lastDiagnostic = result;
      this.updateCache(allServersStatus);

      const duration = Date.now() - startTime;
      console.log(`🧊 [TURN] Diagnostic completed in ${duration}ms:`, {
        working: workingServers.length,
        total: allServersStatus.length,
        bestLatency: bestServer?.latency
      });

      if (showToasts) {
        if (workingServers.length > 0) {
          toast.success(`✅ ${workingServers.length}/${allServersStatus.length} servidores TURN funcionando`);
        } else {
          toast.error('❌ Nenhum servidor TURN funcionando - usando fallback STUN');
        }
      }

      // FASE 3: Aplicar configuração otimizada
      this.applyOptimalConfiguration(result);

      return result;
    } catch (error) {
      console.error('🧊 [TURN] Diagnostic failed:', error);
      return this.getEmptyResult();
    } finally {
      this.isRunningDiagnostic = false;
    }
  }

  private async testTurnServer(server: RTCIceServer): Promise<TurnServerStatus> {
    const url = Array.isArray(server.urls) ? server.urls[0] : server.urls;
    const username = (server as any).username;
    
    console.log(`🧊 [TURN] Testing server: ${url}`);
    const startTime = Date.now();

    try {
      // FASE 2: Usar timeout otimizado (5s)
      const isWorking = await Promise.race([
        connectivityDiagnostics.testTurnConnectivity(server),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.TURN_TEST_TIMEOUT)
        )
      ]);

      const latency = Date.now() - startTime;
      
      if (isWorking) {
        console.log(`✅ [TURN] Server working: ${url} (${latency}ms)`);
        return {
          url,
          username,
          status: 'connected',
          latency,
          lastTested: Date.now()
        };
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`❌ [TURN] Server failed: ${url} (${latency}ms):`, error);
      
      return {
        url,
        username,
        status: latency >= this.TURN_TEST_TIMEOUT ? 'timeout' : 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastTested: Date.now()
      };
    }
  }

  // FASE 3: Aplicar configuração otimizada baseada nos testes
  private applyOptimalConfiguration(result: TurnDiagnosticResult) {
    if (result.workingServers.length > 0) {
      // Usar apenas servidores funcionais, priorizando o melhor
      const optimalServers = result.workingServers
        .sort((a, b) => (a.latency || 999999) - (b.latency || 999999))
        .slice(0, 3) // Usar apenas os 3 melhores
        .map(status => {
          const originalServer = this.turnServers.find(s => {
            const url = Array.isArray(s.urls) ? s.urls[0] : s.urls;
            return url === status.url;
          });
          return originalServer;
        })
        .filter(Boolean) as RTCIceServer[];

      console.log('🧊 [TURN] Applying optimal configuration with', optimalServers.length, 'servers');
      setDynamicIceServers(optimalServers, { relayOnly: false });
    } else {
      // FASE 1: Fallback para STUN apenas
      console.warn('🧊 [TURN] No working TURN servers, falling back to STUN only');
      const stunOnlyServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ];
      setDynamicIceServers(stunOnlyServers, { relayOnly: false });
    }
  }

  private updateCache(statuses: TurnServerStatus[]) {
    statuses.forEach(status => {
      this.diagnosticCache.set(status.url, status);
    });
  }

  private getEmptyResult(): TurnDiagnosticResult {
    return {
      allServersStatus: [],
      workingServers: [],
      recommendFallback: true,
      overallHealth: 'failed'
    };
  }

  // FASE 4: Monitoramento contínuo
  private startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.runDiagnostic(false); // Sem toasts para checks automáticos
      } catch (error) {
        console.error('🧊 [TURN] Health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);

    console.log('🧊 [TURN] Health monitoring started');
  }

  // API pública
  getLastDiagnostic(): TurnDiagnosticResult | null {
    return this.lastDiagnostic;
  }

  async forceRefresh(): Promise<TurnDiagnosticResult> {
    this.diagnosticCache.clear();
    return this.runDiagnostic(true);
  }

  isHealthy(): boolean {
    return this.lastDiagnostic?.overallHealth === 'healthy';
  }

  getWorkingServerCount(): number {
    return this.lastDiagnostic?.workingServers.length || 0;
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const turnConnectivityService = TurnConnectivityService.getInstance();