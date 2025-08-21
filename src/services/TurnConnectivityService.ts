// FASE 1: Serviço de diagnóstico automático TURN
import { getWebRTCConfig, setDynamicIceServers } from '@/utils/webrtc/WebRTCConfig';
import { connectivityDiagnostics } from '@/utils/webrtc/ConnectivityDiagnostics';
import { twilioWebRTCService } from '@/services/TwilioWebRTCService';
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

  // PLANO: Timeouts diferenciados para desktop vs mobile
  private readonly DESKTOP_TURN_TIMEOUT = 15000; // 15s para desktop (corporativo)
  private readonly MOBILE_TURN_TIMEOUT = 8000;   // 8s para mobile
  private readonly HEALTH_CHECK_INTERVAL = 45000; // 45s entre checks
  private readonly CACHE_DURATION = 120000; // 2min cache para servidores funcionais
  private readonly isDesktop = !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);

  static getInstance(): TurnConnectivityService {
    if (!TurnConnectivityService.instance) {
      TurnConnectivityService.instance = new TurnConnectivityService();
    }
    return TurnConnectivityService.instance;
  }

  constructor() {
    this.initializeAsync();
  }

  private async initializeAsync() {
    await this.loadTurnServers();
    this.startHealthMonitoring();
  }

  private async loadTurnServers() {
    try {
      // 🎯 FASE 2: Carregar primeiro do Twilio, depois hardcoded, depois fallback
      console.log('🧊 [TURN] Loading servers - priority: Twilio > Hardcoded > Fallback...');
      
      // Tentar Twilio primeiro
      if (twilioWebRTCService.isTwilioEnabled()) {
        try {
          const twilioServers = await twilioWebRTCService.getIceServers();
          const turnServers = twilioServers.filter(server => 
            Array.isArray(server.urls) 
              ? server.urls.some(url => url.startsWith('turn:'))
              : typeof server.urls === 'string' && server.urls.startsWith('turn:')
          );
          
          if (turnServers.length > 0) {
            this.turnServers = turnServers;
            console.log('✅ [TURN] Loaded Twilio TURN servers:', turnServers.length);
            return;
          }
        } catch (twilioError) {
          console.warn('⚠️ [TURN] Twilio failed, trying hardcoded:', twilioError);
        }
      }
      
      // 🎯 FASE 2: Tentar credenciais hardcoded
      try {
        const { getHardcodedTurnServers } = await import('@/utils/webrtc/WebRTCConfig');
        const hardcodedServers = getHardcodedTurnServers();
        const turnServers = hardcodedServers.filter(server => 
          Array.isArray(server.urls) 
            ? server.urls.some(url => url.startsWith('turn:'))
            : typeof server.urls === 'string' && server.urls.startsWith('turn:')
        );
        
        if (turnServers.length > 0) {
          this.turnServers = turnServers;
          console.log('✅ [TURN] Loaded hardcoded TURN servers:', turnServers.length);
          return;
        }
      } catch (hardcodedError) {
        console.warn('⚠️ [TURN] Hardcoded failed, trying WebRTC config:', hardcodedError);
      }
      
      // Fallback final para config geral
      const config = await getWebRTCConfig();
      this.turnServers = config.iceServers?.filter(server => 
        Array.isArray(server.urls) 
          ? server.urls.some(url => url.startsWith('turn:'))
          : typeof server.urls === 'string' && server.urls.startsWith('turn:')
      ) || [];
      
      console.log('🧊 [TURN] Loaded config fallback TURN servers:', this.turnServers.length);
    } catch (error) {
      console.error('❌ [TURN] Failed to load TURN servers:', error);
      this.turnServers = [];
    }
  }

  // FASE 1: Teste automático de conectividade TURN
  async runDiagnostic(showToasts = false): Promise<TurnDiagnosticResult> {
    if (this.isRunningDiagnostic) {
      console.log('🧊 [TURN] Diagnostic already running, skipping...');
      return this.lastDiagnostic || this.getEmptyResult();
    }

    this.isRunningDiagnostic = true;
    console.log(`🧊 [TURN] Starting ${this.isDesktop ? 'DESKTOP' : 'MOBILE'} TURN connectivity diagnostic...`);
    
    if (showToasts) {
      toast.info(`🧊 Testando servidores TURN (${this.isDesktop ? 'Desktop' : 'Mobile'} mode)...`, { duration: 3000 });
    }

    const startTime = Date.now();
    
    // PLANO: Verificar cache primeiro para acelerar
    const cachedResults: TurnServerStatus[] = [];
    const serversToTest: RTCIceServer[] = [];
    
    this.turnServers.forEach(server => {
      const url = Array.isArray(server.urls) ? server.urls[0] : server.urls;
      const cached = this.getCachedServerStatus(url);
      
      if (cached) {
        cachedResults.push(cached);
      } else {
        serversToTest.push(server);
      }
    });
    
    console.log(`🧊 [TURN] Using ${cachedResults.length} cached results, testing ${serversToTest.length} servers`);
    
    // PLANO: Teste sequencial ao invés de paralelo para melhor diagnóstico
    const newResults: TurnServerStatus[] = [];
    for (const server of serversToTest) {
      try {
        const result = await this.testTurnServer(server);
        newResults.push(result);
        
        // PLANO: Parar no primeiro servidor funcionais para acelerar
        if (result.status === 'connected' && this.isDesktop && newResults.length >= 2) {
          console.log('🧊 [TURN] Desktop: Found 2 working servers, stopping early test');
          break;
        }
      } catch (error) {
        console.error('🧊 [TURN] Server test error:', error);
      }
    }
    
    try {
      // PLANO: Combinar resultados cached e novos testes
      const allServersStatus: TurnServerStatus[] = [...cachedResults, ...newResults];

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
    const credential = (server as any).credential;
    
    // PLANO: Validação de credenciais antes do teste
    if (!username || !credential) {
      console.warn(`🧊 [TURN] Invalid credentials for ${url}`);
      return {
        url,
        username,
        status: 'failed',
        error: 'Missing credentials',
        lastTested: Date.now()
      };
    }
    
    console.log(`🧊 [TURN] Testing server: ${url} (${this.isDesktop ? 'DESKTOP' : 'MOBILE'} mode)`);
    const startTime = Date.now();
    const timeout = this.isDesktop ? this.DESKTOP_TURN_TIMEOUT : this.MOBILE_TURN_TIMEOUT;

    try {
      // PLANO: Teste sequencial UDP primeiro, depois TCP
      let isWorking = false;
      
      // Tentar UDP primeiro
      try {
        isWorking = await Promise.race([
          this.testTurnProtocol(server, 'udp'),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('UDP Timeout')), timeout * 0.6) // 60% do tempo para UDP
          )
        ]);
        
        if (isWorking) {
          console.log(`✅ [TURN] UDP success: ${url}`);
        }
      } catch (udpError) {
        console.log(`⚠️ [TURN] UDP failed for ${url}, trying TCP: ${udpError}`);
        
        // Fallback para TCP se UDP falhar
        try {
          isWorking = await Promise.race([
            this.testTurnProtocol(server, 'tcp'),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('TCP Timeout')), timeout * 0.4) // 40% restante para TCP
            )
          ]);
          
          if (isWorking) {
            console.log(`✅ [TURN] TCP fallback success: ${url}`);
          }
        } catch (tcpError) {
          throw new Error(`Both UDP and TCP failed: ${tcpError}`);
        }
      }

      const latency = Date.now() - startTime;
      
      if (isWorking) {
        console.log(`✅ [TURN] Server working: ${url} (${latency}ms)`);
        
        // PLANO: Cache servidores funcionais por mais tempo
        const cacheKey = `turn-${url}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          status: 'connected',
          latency,
          timestamp: Date.now()
        }));
        
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
        status: latency >= (this.isDesktop ? this.DESKTOP_TURN_TIMEOUT : this.MOBILE_TURN_TIMEOUT) ? 'timeout' : 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastTested: Date.now()
      };
    }
  }

  // PLANO: Teste específico por protocolo (UDP/TCP)
  private async testTurnProtocol(server: RTCIceServer, protocol: 'udp' | 'tcp'): Promise<boolean> {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const protocolUrl = urls.find(url => url.includes(`?transport=${protocol}`)) || urls[0];
    
    const testServer = {
      ...server,
      urls: protocolUrl
    };
    
    return connectivityDiagnostics.testTurnConnectivity(testServer);
  }

  // PLANO: Verificar cache de servidores funcionais
  private getCachedServerStatus(url: string): TurnServerStatus | null {
    try {
      const cacheKey = `turn-${url}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        // PLANO: Cache válido por 2 minutos para servidores funcionais
        if (age < this.CACHE_DURATION && data.status === 'connected') {
          console.log(`📋 [TURN] Using cached result for ${url}: ${data.latency}ms`);
          return {
            url,
            status: 'connected',
            latency: data.latency,
            lastTested: data.timestamp
          };
        }
      }
    } catch (error) {
      console.warn(`⚠️ [TURN] Cache read error for ${url}:`, error);
    }
    
    return null;
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