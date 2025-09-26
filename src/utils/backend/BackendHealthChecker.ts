/**
 * FASE 1: Sistema de Health Check para Backend
 * Detecta quando o backend está offline e fornece feedback claro
 */

import { getBackendBaseURL } from '@/utils/connectionUtils';

export interface BackendHealthResult {
  isOnline: boolean;
  responseTime: number;
  status: number;
  error?: string;
  url: string;
}

export interface BackendHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  errorHistory: Array<{ time: number; error: string }>;
}

class BackendHealthChecker {
  private healthStatus: BackendHealthStatus = {
    isHealthy: false,
    lastCheck: 0,
    consecutiveFailures: 0,
    averageResponseTime: 0,
    errorHistory: []
  };

  private responseTimes: number[] = [];
  private maxErrorHistory = 10;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(status: BackendHealthStatus) => void> = [];

  /**
   * Executa um health check único no backend
   */
  async checkBackendHealth(): Promise<BackendHealthResult> {
    const backendUrl = getBackendBaseURL();
    const healthEndpoint = `${backendUrl}/health`;
    const startTime = Date.now();

    console.log(`🏥 HEALTH CHECK: Testing backend at ${healthEndpoint}`);

    try {
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(30000) // FASE 2: 30s timeout para Render.com server wake up
      });

      const responseTime = Date.now() - startTime;
      
      const result: BackendHealthResult = {
        isOnline: response.ok,
        responseTime,
        status: response.status,
        url: healthEndpoint
      };

      if (response.ok) {
        console.log(`✅ HEALTH CHECK: Backend online (${responseTime}ms, status: ${response.status})`);
        this.updateHealthStatus(true, responseTime);
      } else {
        const error = `HTTP ${response.status}`;
        console.warn(`⚠️ HEALTH CHECK: Backend responded with error (${error}, ${responseTime}ms)`);
        result.error = error;
        this.updateHealthStatus(false, responseTime, error);
      }

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ HEALTH CHECK: Backend unreachable (${responseTime}ms): ${errorMessage}`);
      
      this.updateHealthStatus(false, responseTime, errorMessage);

      return {
        isOnline: false,
        responseTime,
        status: 0,
        error: errorMessage,
        url: healthEndpoint
      };
    }
  }

  /**
   * Atualiza o status de saúde interno
   */
  private updateHealthStatus(isHealthy: boolean, responseTime: number, error?: string): void {
    this.healthStatus.lastCheck = Date.now();
    this.healthStatus.isHealthy = isHealthy;

    if (isHealthy) {
      this.healthStatus.consecutiveFailures = 0;
      this.responseTimes.push(responseTime);
      
      // Manter apenas os últimos 10 tempos de resposta
      if (this.responseTimes.length > 10) {
        this.responseTimes.shift();
      }
      
      this.healthStatus.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        
    } else {
      this.healthStatus.consecutiveFailures++;
      
      if (error) {
        this.healthStatus.errorHistory.push({
          time: Date.now(),
          error
        });
        
        // Manter apenas os últimos erros
        if (this.healthStatus.errorHistory.length > this.maxErrorHistory) {
          this.healthStatus.errorHistory.shift();
        }
      }
    }

    // Notificar listeners
    this.notifyListeners();
  }

  /**
   * Inicia monitoramento contínuo do backend
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      this.stopHealthMonitoring();
    }

    console.log(`🔄 HEALTH MONITOR: Starting continuous health monitoring (${intervalMs}ms interval)`);
    
    // Check inicial
    this.checkBackendHealth();
    
    // Check periódico
    this.healthCheckInterval = setInterval(() => {
      this.checkBackendHealth();
    }, intervalMs);
  }

  /**
   * Para o monitoramento contínuo
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log(`⏹️ HEALTH MONITOR: Stopped health monitoring`);
    }
  }

  /**
   * Retorna o status atual de saúde
   */
  getHealthStatus(): BackendHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Adiciona listener para mudanças de status
   */
  addHealthListener(callback: (status: BackendHealthStatus) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeHealthListener(callback: (status: BackendHealthStatus) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notifica todos os listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.healthStatus);
      } catch (error) {
        console.error('❌ HEALTH LISTENER ERROR:', error);
      }
    });
  }

  /**
   * Verifica se o backend está configurado corretamente
   */
  async validateBackendConfiguration(): Promise<{
    isValid: boolean;
    url: string;
    issues: string[];
  }> {
    const backendUrl = getBackendBaseURL();
    const issues: string[] = [];

    console.log(`🔍 BACKEND VALIDATION: Checking configuration for ${backendUrl}`);

    // Verificar se a URL é válida
    try {
      new URL(backendUrl);
    } catch {
      issues.push('Invalid backend URL format');
    }

    // Verificar se é localhost em produção
    if (backendUrl.includes('localhost') && window.location.hostname !== 'localhost') {
      issues.push('Backend URL points to localhost but frontend is not on localhost');
    }

    // Verificar se o protocolo é correto
    if (window.location.protocol === 'https:' && backendUrl.startsWith('http:')) {
      issues.push('Mixed content: HTTPS frontend trying to connect to HTTP backend');
    }

    // Fazer um health check
    const healthResult = await this.checkBackendHealth();
    if (!healthResult.isOnline) {
      issues.push(`Backend health check failed: ${healthResult.error}`);
    }

    const isValid = issues.length === 0;
    
    console.log(`🔍 BACKEND VALIDATION: ${isValid ? 'VALID' : 'INVALID'}`, {
      url: backendUrl,
      isValid,
      issues
    });

    return {
      isValid,
      url: backendUrl,
      issues
    };
  }

  /**
   * Detecta se estamos em "modo degradado" devido a problemas de backend
   */
  isDegradedMode(): boolean {
    return this.healthStatus.consecutiveFailures >= 3 || 
           !this.healthStatus.isHealthy && 
           (Date.now() - this.healthStatus.lastCheck) > 60000; // 1 minuto sem check
  }

  /**
   * Força um re-check do backend
   */
  async forceHealthCheck(): Promise<BackendHealthResult> {
    console.log('🔄 HEALTH CHECK: Force checking backend health...');
    return await this.checkBackendHealth();
  }
}

// Singleton instance
export const backendHealthChecker = new BackendHealthChecker();

// Tornar disponível globalmente para debug
(window as any).backendHealthChecker = backendHealthChecker;