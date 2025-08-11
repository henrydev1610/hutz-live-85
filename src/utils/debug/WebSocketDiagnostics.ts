/**
 * Utilitário para diagnóstico de problemas de WebSocket
 */

import { getBackendBaseURL, getWebSocketURL, validateURLConsistency } from '@/utils/connectionUtils';
import { ServerConnectivityTest } from './ServerConnectivityTest';

export interface WebSocketDiagnosticResult {
  success: boolean;
  url: string;
  error?: string;
  details: {
    urlValid: boolean;
    hostReachable: boolean;
    protocolSupported: boolean;
    corsOk: boolean;
  };
}

export class WebSocketDiagnostics {
  static async runDiagnostics(): Promise<WebSocketDiagnosticResult> {
    console.log('🔧 [DIAG] Starting WebSocket diagnostics...');
    
    const url = getWebSocketURL();
    const backendUrl = getBackendBaseURL();
    
    console.log('🔍 [DIAG] URLs:', {
      websocket: url,
      backend: backendUrl,
      frontend: window.location.origin
    });

    const result: WebSocketDiagnosticResult = {
      success: false,
      url,
      details: {
        urlValid: false,
        hostReachable: false,
        protocolSupported: false,
        corsOk: false
      }
    };

    try {
      // 1. Validar URL
      new URL(url);
      result.details.urlValid = true;
      console.log('✅ [DIAG] URL is valid');

      // 2. Testar conectividade HTTP do backend usando teste abrangente
      console.log(`🌐 [DIAG] Testing backend reachability...`);
      
      const serverTest = await ServerConnectivityTest.testServerHealth();
      if (serverTest.online) {
        result.details.hostReachable = true;
        result.details.corsOk = true;
        console.log('✅ [DIAG] Backend is reachable and CORS OK');
      } else {
        console.error('❌ [DIAG] Backend is not reachable:', serverTest.error);
        console.error('📋 [DIAG] Server test details:', serverTest.details);
      }

      // 3. Verificar suporte a WebSocket
      if ('WebSocket' in window) {
        result.details.protocolSupported = true;
        console.log('✅ [DIAG] WebSocket is supported');
      } else {
        console.error('❌ [DIAG] WebSocket not supported');
      }

      // 4. Teste de conexão WebSocket simples
      console.log(`🔌 [DIAG] Testing WebSocket connection to: ${url}`);
      await this.testWebSocketConnection(url);
      
      result.success = true;
      console.log('✅ [DIAG] All diagnostics passed');

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('❌ [DIAG] Diagnostics failed:', error);
    }

    return result;
  }

  private static testWebSocketConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket test timeout'));
      }, 10000);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('✅ [DIAG] Raw WebSocket connection successful');
        clearTimeout(timeout);
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        console.error('❌ [DIAG] Raw WebSocket connection failed:', error);
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log(`🔌 [DIAG] WebSocket closed: ${event.code} - ${event.reason}`);
        if (event.code !== 1000) {
          clearTimeout(timeout);
          reject(new Error(`WebSocket closed with code: ${event.code}`));
        }
      };
    });
  }

  static logEnvironmentInfo(): void {
    console.log('🌍 [DIAG] Environment Information:');
    console.log('Frontend URL:', window.location.origin);
    console.log('Backend URL:', getBackendBaseURL());
    console.log('WebSocket URL:', getWebSocketURL());
    console.log('URL Consistency:', validateURLConsistency());
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocol:', window.location.protocol);
  }
}

// Disponibilizar globalmente para debug
(window as any).runWebSocketDiagnostics = () => WebSocketDiagnostics.runDiagnostics();
(window as any).logEnvironmentInfo = () => WebSocketDiagnostics.logEnvironmentInfo();