// FASE 4: Ferramentas de diagnóstico avançado para servidores TURN
import { connectivityDiagnostics } from './ConnectivityDiagnostics';
import { getWebRTCConfig } from './WebRTCConfig';

interface TurnServerStatus {
  url: string;
  username?: string;
  isWorking: boolean;
  lastTest: number;
  latency?: number;
  error?: string;
}

class TurnServerDiagnostics {
  private static instance: TurnServerDiagnostics;
  private serverStatusCache: Map<string, TurnServerStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutos para funcionais
  private readonly FAILED_CACHE_DURATION = 1 * 60 * 1000; // 1 minuto para falhas

  static getInstance(): TurnServerDiagnostics {
    if (!TurnServerDiagnostics.instance) {
      TurnServerDiagnostics.instance = new TurnServerDiagnostics();
    }
    return TurnServerDiagnostics.instance;
  }

  // FASE 4: Teste manual de servidores TURN
  async testAllTurnServers(): Promise<TurnServerStatus[]> {
    const config = getWebRTCConfig();
    const turnServers = config.iceServers?.filter(server => 
      (server.urls as string).includes('turn:') || 
      (server.urls as string).includes('turns:')
    ) || [];

    console.log('🔍 TURN DIAGNOSTICS: Testing', turnServers.length, 'TURN servers');

    const results: TurnServerStatus[] = [];
    
    for (const server of turnServers) {
      const startTime = performance.now();
      try {
        const isWorking = await connectivityDiagnostics.testTurnConnectivity(server);
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        const status: TurnServerStatus = {
          url: server.urls as string,
          username: (server as any).username,
          isWorking,
          lastTest: Date.now(),
          latency: isWorking ? latency : undefined,
          error: isWorking ? undefined : 'No relay candidates received'
        };

        this.serverStatusCache.set(server.urls as string, status);
        results.push(status);

        console.log(`${isWorking ? '✅' : '❌'} TURN TEST:`, {
          url: server.urls,
          username: (server as any).username,
          working: isWorking,
          latency: isWorking ? `${latency}ms` : 'N/A'
        });

      } catch (error) {
        const status: TurnServerStatus = {
          url: server.urls as string,
          username: (server as any).username,
          isWorking: false,
          lastTest: Date.now(),
          error: String(error)
        };

        this.serverStatusCache.set(server.urls as string, status);
        results.push(status);

        console.error('❌ TURN TEST ERROR:', server.urls, error);
      }
    }

    return results;
  }

  // FASE 4: Health check automático
  startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    console.log('🏥 TURN HEALTH: Starting automatic health checks every 5 minutes');
    
    this.healthCheckInterval = setInterval(async () => {
      console.log('🏥 TURN HEALTH: Running scheduled health check');
      try {
        const results = await this.testAllTurnServers();
        const working = results.filter(r => r.isWorking).length;
        const total = results.length;
        
        console.log(`🏥 TURN HEALTH: ${working}/${total} servers working`);
        
        if (working === 0) {
          console.error('🚨 TURN HEALTH: ALL TURN SERVERS FAILED!');
          this.notifyTurnFailure();
        }
      } catch (error) {
        console.error('🏥 TURN HEALTH: Health check failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🏥 TURN HEALTH: Stopped health checks');
    }
  }

  // FASE 4: Dashboard de status
  getStatusDashboard(): any {
    const config = getWebRTCConfig();
    const allServers = config.iceServers || [];
    const turnServers = allServers.filter(server => 
      (server.urls as string).includes('turn:') || 
      (server.urls as string).includes('turns:')
    );
    const stunServers = allServers.filter(server => 
      (server.urls as string).includes('stun:')
    );

    const cachedResults = Array.from(this.serverStatusCache.values());
    const workingTurn = cachedResults.filter(r => r.isWorking).length;
    const totalTurn = turnServers.length;

    return {
      timestamp: Date.now(),
      summary: {
        turnServers: totalTurn,
        stunServers: stunServers.length,
        turnWorking: workingTurn,
        turnHealth: totalTurn > 0 ? Math.round((workingTurn / totalTurn) * 100) : 0
      },
      servers: {
        turn: cachedResults,
        stun: stunServers.map(s => ({ url: s.urls, type: 'stun' }))
      },
      recommendations: this.generateRecommendations(workingTurn, totalTurn)
    };
  }

  private generateRecommendations(working: number, total: number): string[] {
    const recommendations: string[] = [];
    
    if (working === 0 && total > 0) {
      recommendations.push('🚨 CRÍTICO: Todos os servidores TURN falharam');
      recommendations.push('🔧 Verificar credenciais e conectividade');
      recommendations.push('🔄 Considerar usar iceTransportPolicy: relay');
    } else if (working < total / 2) {
      recommendations.push('⚠️ Mais da metade dos TURN servers falharam');
      recommendations.push('🔍 Investigar problemas de rede');
    } else if (working === total && total > 0) {
      recommendations.push('✅ Todos os TURN servers funcionando');
      recommendations.push('🎯 Conectividade otimizada');
    }
    
    if (total === 0) {
      recommendations.push('⚠️ Nenhum servidor TURN configurado');
      recommendations.push('📡 Adicionar TURN servers para redes restritivas');
    }
    
    return recommendations;
  }

  private notifyTurnFailure(): void {
    // Notificar via evento global
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('turn-servers-failed', {
        detail: { timestamp: Date.now() }
      }));
    }
  }

  // FASE 5: Limpeza de cache baseada em performance
  cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [url, status] of this.serverStatusCache.entries()) {
      const cacheDuration = status.isWorking ? this.CACHE_DURATION : this.FAILED_CACHE_DURATION;
      
      if (now - status.lastTest > cacheDuration) {
        this.serverStatusCache.delete(url);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 TURN CACHE: Cleaned ${cleaned} expired entries`);
    }
  }
}

export const turnServerDiagnostics = TurnServerDiagnostics.getInstance();

// FASE 4: Função global para testes manuais
if (typeof window !== 'undefined') {
  (window as any).__testTurnServers = () => turnServerDiagnostics.testAllTurnServers();
  (window as any).__turnStatus = () => turnServerDiagnostics.getStatusDashboard();
  (window as any).__turnHealth = () => {
    turnServerDiagnostics.startHealthCheck();
    console.log('🏥 TURN health monitoring started');
  };
}