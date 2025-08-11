/**
 * Teste de conectividade do servidor para diagnóstico
 */

import { getBackendBaseURL } from '@/utils/connectionUtils';

export class ServerConnectivityTest {
  static async testServerHealth(): Promise<{
    online: boolean;
    url: string;
    status?: number;
    error?: string;
    details: any;
  }> {
    const backendUrl = getBackendBaseURL();
    console.log(`🌐 [TEST] Testing server connectivity: ${backendUrl}`);

    const result: {
      online: boolean;
      url: string;
      status?: number;
      error?: string;
      details: any;
    } = {
      online: false,
      url: backendUrl,
      details: {} as any
    };

    try {
      // Teste 1: Health check endpoint
      const healthUrl = `${backendUrl}/health`;
      console.log(`🏥 [TEST] Testing health endpoint: ${healthUrl}`);
      
      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000)
      });

      result.details.health = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        headers: Object.fromEntries(healthResponse.headers)
      };

      if (healthResponse.ok) {
        result.online = true;
        result.status = healthResponse.status;
        console.log('✅ [TEST] Server health check passed');
        return result;
      }

    } catch (healthError) {
      console.warn('⚠️ [TEST] Health endpoint failed:', healthError);
      result.details.healthError = healthError instanceof Error ? healthError.message : String(healthError);
    }

    try {
      // Teste 2: Root endpoint
      const rootResponse = await fetch(backendUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000)
      });

      result.details.root = {
        status: rootResponse.status,
        ok: rootResponse.ok,
        headers: Object.fromEntries(rootResponse.headers)
      };

      if (rootResponse.ok) {
        result.online = true;
        result.status = rootResponse.status;
        console.log('✅ [TEST] Server root endpoint accessible');
        return result;
      }

    } catch (rootError) {
      console.warn('⚠️ [TEST] Root endpoint failed:', rootError);
      result.details.rootError = rootError instanceof Error ? rootError.message : String(rootError);
    }

    try {
      // Teste 3: Socket.IO endpoint específico
      const socketUrl = `${backendUrl}/socket.io/`;
      const socketResponse = await fetch(socketUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000)
      });

      result.details.socketio = {
        status: socketResponse.status,
        ok: socketResponse.ok,
        headers: Object.fromEntries(socketResponse.headers)
      };

      if (socketResponse.status < 500) { // Socket.IO pode retornar 400, mas ainda está online
        result.online = true;
        result.status = socketResponse.status;
        console.log('✅ [TEST] Socket.IO endpoint accessible');
        return result;
      }

    } catch (socketError) {
      console.warn('⚠️ [TEST] Socket.IO endpoint failed:', socketError);
      result.details.socketError = socketError instanceof Error ? socketError.message : String(socketError);
    }

    result.error = 'All connectivity tests failed';
    console.error('❌ [TEST] Server appears to be offline');
    return result;
  }

  static async runComprehensiveTest(): Promise<void> {
    console.log('🔧 [TEST] Running comprehensive server connectivity test...');
    
    const result = await this.testServerHealth();
    
    console.log('📊 [TEST] Connectivity Test Results:', {
      server: result.url,
      online: result.online,
      status: result.status,
      error: result.error,
      details: result.details
    });

    if (!result.online) {
      console.error('🚨 [TEST] CRITICAL: Server is not reachable!');
      console.error('💡 [TEST] Possible issues:');
      console.error('   - Server is down or restarting');
      console.error('   - URL mapping is incorrect');
      console.error('   - CORS configuration issues');
      console.error('   - Network connectivity problems');
    } else {
      console.log('✅ [TEST] Server is online and reachable');
    }
  }
}

// Disponibilizar globalmente para debug
(window as any).testServerConnectivity = () => ServerConnectivityTest.runComprehensiveTest();