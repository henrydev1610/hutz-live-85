/**
 * FASE 4: Advanced Backend Health Checker
 * Monitors backend connectivity and switches between local/production automatically
 */

import { getBackendBaseURL } from '@/utils/connectionUtils';

export interface BackendHealthStatus {
  isOnline: boolean;
  url: string;
  responseTime: number;
  lastCheck: number;
  error?: string;
  httpStatus?: number;
  endpoints: {
    health: boolean;
    socket: boolean;
    api: boolean;
  };
}

class BackendHealthChecker {
  private static instance: BackendHealthChecker;
  private healthStatus: BackendHealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: ((status: BackendHealthStatus) => void)[] = [];

  static getInstance(): BackendHealthChecker {
    if (!BackendHealthChecker.instance) {
      BackendHealthChecker.instance = new BackendHealthChecker();
    }
    return BackendHealthChecker.instance;
  }

  async checkBackendHealth(): Promise<BackendHealthStatus> {
    const backendUrl = getBackendBaseURL();
    const startTime = Date.now();
    
    console.log('🔍 HEALTH CHECK: Testing backend connectivity:', backendUrl);
    
    const status: BackendHealthStatus = {
      isOnline: false,
      url: backendUrl,
      responseTime: 0,
      lastCheck: Date.now(),
      endpoints: {
        health: false,
        socket: false,
        api: false
      }
    };

    try {
      // Test multiple endpoints
      const endpoints = [
        { name: 'health', path: '/health' },
        { name: 'socket', path: '/socket.io/' },
        { name: 'api', path: '/' }
      ];

      const promises = endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`${backendUrl}${endpoint.path}`, {
            method: 'HEAD',
            mode: 'no-cors', // Handle CORS issues
            cache: 'no-store',
            signal: AbortSignal.timeout(5000) // 5s timeout
          });
          
          console.log(`✅ ENDPOINT ${endpoint.name}: OK`);
          return { name: endpoint.name, success: true, status: response.status };
        } catch (error) {
          console.log(`❌ ENDPOINT ${endpoint.name}: FAIL -`, error);
          return { name: endpoint.name, success: false, error };
        }
      });

      const results = await Promise.all(promises);
      
      // Update endpoint status
      results.forEach(result => {
        if (result.name === 'health') status.endpoints.health = result.success;
        if (result.name === 'socket') status.endpoints.socket = result.success;
        if (result.name === 'api') status.endpoints.api = result.success;
      });

      // Consider online if at least one endpoint responds
      const anyEndpointOnline = Object.values(status.endpoints).some(Boolean);
      status.isOnline = anyEndpointOnline;
      
      if (anyEndpointOnline) {
        console.log(`✅ BACKEND ONLINE: ${backendUrl} (${Object.values(status.endpoints).filter(Boolean).length}/3 endpoints)`);
      } else {
        console.log(`❌ BACKEND OFFLINE: ${backendUrl} - All endpoints failed`);
        status.error = 'All endpoints failed to respond';
      }

    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
      console.error('❌ HEALTH CHECK FAILED:', error);
    }

    status.responseTime = Date.now() - startTime;
    this.healthStatus = status;
    
    // Notify listeners
    this.listeners.forEach(listener => listener(status));
    
    return status;
  }

  startMonitoring(intervalMs: number = 30000): void {
    console.log(`🔍 HEALTH MONITOR: Starting (${intervalMs}ms interval)`);
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    this.checkBackendHealth();
    
    // Set interval
    this.checkInterval = setInterval(() => {
      this.checkBackendHealth();
    }, intervalMs);
  }

  stopMonitoring(): void {
    console.log('🔍 HEALTH MONITOR: Stopping');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getLastStatus(): BackendHealthStatus | null {
    return this.healthStatus;
  }

  onStatusChange(callback: (status: BackendHealthStatus) => void): void {
    this.listeners.push(callback);
  }

  offStatusChange(callback: (status: BackendHealthStatus) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Test server with fallback strategies
  async testWithFallback(): Promise<{ success: boolean; url: string; fallbackUsed?: string }> {
    const primaryUrl = getBackendBaseURL();
    const currentHost = window.location.host;
    
    console.log('🔄 FALLBACK TEST: Testing primary backend:', primaryUrl);
    
    // Test primary backend
    const primaryStatus = await this.checkBackendHealth();
    
    if (primaryStatus.isOnline) {
      return { success: true, url: primaryUrl };
    }

    // FALLBACK 1: If production frontend but backend fails, try localhost
    if (currentHost.includes('hutz-live-85.onrender.com') || currentHost.includes('lovable')) {
      console.log('🔄 FALLBACK 1: Production backend failed, testing localhost...');
      
      const localhostUrl = 'http://localhost:3001';
      try {
        const response = await fetch(`${localhostUrl}/health`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          console.log('✅ FALLBACK 1: Localhost available');
          return { success: true, url: localhostUrl, fallbackUsed: 'localhost' };
        }
      } catch (error) {
        console.log('❌ FALLBACK 1: Localhost not available');
      }
    }

    // FALLBACK 2: If localhost but fails, try production
    if (currentHost.includes('localhost')) {
      console.log('🔄 FALLBACK 2: Localhost failed, testing production...');
      
      const productionUrl = 'https://server-hutz-live.onrender.com';
      try {
        const response = await fetch(`${productionUrl}/health`, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        
        console.log('✅ FALLBACK 2: Production available');
        return { success: true, url: productionUrl, fallbackUsed: 'production' };
      } catch (error) {
        console.log('❌ FALLBACK 2: Production not available');
      }
    }

    console.log('❌ ALL FALLBACKS FAILED');
    return { success: false, url: primaryUrl };
  }
}

// Export singleton instance
export const backendHealthChecker = BackendHealthChecker.getInstance();

// Global debug functions
(window as any).checkBackendHealth = () => backendHealthChecker.checkBackendHealth();
(window as any).testBackendFallback = () => backendHealthChecker.testWithFallback();