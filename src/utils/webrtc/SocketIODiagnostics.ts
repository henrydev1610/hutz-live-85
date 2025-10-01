/**
 * Socket.IO Diagnostics
 * Testa conectividade específica do Socket.IO antes da conexão principal
 */

import { io, Socket } from 'socket.io-client';

export interface SocketIODiagnosticResult {
  success: boolean;
  url: string;
  error?: string;
  latency?: number;
  handshakeCompleted: boolean;
  transportUsed?: string;
}

export class SocketIODiagnostics {
  /**
   * Testa conexão Socket.IO com timeout
   */
  static async testConnection(url: string, timeout: number = 5000): Promise<SocketIODiagnosticResult> {
    const startTime = Date.now();
    
    console.log(`🔍 [SOCKET.IO DIAGNOSTICS] Testando conexão: ${url}`);

    return new Promise((resolve) => {
      let resolved = false;
      let testSocket: Socket | null = null;

      const cleanup = () => {
        if (testSocket) {
          testSocket.removeAllListeners();
          testSocket.disconnect();
          testSocket = null;
        }
      };

      const resolveOnce = (result: SocketIODiagnosticResult) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      // Timeout
      const timeoutId = setTimeout(() => {
        resolveOnce({
          success: false,
          url,
          error: 'Connection timeout',
          handshakeCompleted: false
        });
      }, timeout);

      try {
        testSocket = io(url, {
          transports: ['websocket', 'polling'],
          reconnection: false,
          timeout: timeout - 1000,
          forceNew: true,
          autoConnect: false
        });

        testSocket.on('connect', () => {
          const latency = Date.now() - startTime;
          console.log(`✅ [SOCKET.IO DIAGNOSTICS] Conectado em ${latency}ms`);
          
          clearTimeout(timeoutId);
          resolveOnce({
            success: true,
            url,
            latency,
            handshakeCompleted: true,
            transportUsed: testSocket?.io?.engine?.transport?.name
          });
        });

        testSocket.on('connect_error', (error) => {
          console.error(`❌ [SOCKET.IO DIAGNOSTICS] Erro de conexão:`, error.message);
          
          clearTimeout(timeoutId);
          resolveOnce({
            success: false,
            url,
            error: error.message,
            handshakeCompleted: false
          });
        });

        testSocket.on('error', (error) => {
          console.error(`❌ [SOCKET.IO DIAGNOSTICS] Erro:`, error);
          
          clearTimeout(timeoutId);
          resolveOnce({
            success: false,
            url,
            error: String(error),
            handshakeCompleted: false
          });
        });

        // Iniciar conexão
        testSocket.connect();

      } catch (error) {
        console.error(`❌ [SOCKET.IO DIAGNOSTICS] Exceção:`, error);
        
        clearTimeout(timeoutId);
        resolveOnce({
          success: false,
          url,
          error: error instanceof Error ? error.message : String(error),
          handshakeCompleted: false
        });
      }
    });
  }

  /**
   * Testa múltiplas URLs e retorna a primeira que funciona
   */
  static async findWorkingURL(urls: string[], timeout: number = 5000): Promise<SocketIODiagnosticResult | null> {
    console.log(`🔍 [SOCKET.IO DIAGNOSTICS] Testando ${urls.length} URLs...`);

    for (const url of urls) {
      const result = await this.testConnection(url, timeout);
      if (result.success) {
        console.log(`✅ [SOCKET.IO DIAGNOSTICS] URL funcionando encontrada: ${url}`);
        return result;
      }
    }

    console.error(`❌ [SOCKET.IO DIAGNOSTICS] Nenhuma URL funcionando encontrada`);
    return null;
  }

  /**
   * Executa diagnóstico completo e retorna relatório
   */
  static async runFullDiagnostics(urls: string[]): Promise<{
    workingURL: string | null;
    allResults: SocketIODiagnosticResult[];
    recommendations: string[];
  }> {
    console.log(`🔍 [SOCKET.IO DIAGNOSTICS] Executando diagnóstico completo...`);

    const allResults: SocketIODiagnosticResult[] = [];
    const recommendations: string[] = [];

    // Testar todas as URLs em paralelo
    const results = await Promise.all(
      urls.map(url => this.testConnection(url, 5000))
    );

    allResults.push(...results);

    // Encontrar primeira URL funcionando
    const workingResult = results.find(r => r.success);
    const workingURL = workingResult?.url || null;

    // Gerar recomendações
    if (!workingURL) {
      recommendations.push('❌ Nenhuma URL de sinalização está acessível');
      recommendations.push('Verifique se o servidor está rodando');
      recommendations.push('Verifique firewall e configurações de rede');
      recommendations.push('Confirme que VITE_SIGNALING_SERVER_URL está correto no .env');
    } else {
      recommendations.push(`✅ URL funcionando: ${workingURL}`);
      
      if (workingResult.latency && workingResult.latency > 2000) {
        recommendations.push('⚠️ Latência alta detectada (>2s)');
        recommendations.push('Considere usar um servidor mais próximo');
      }

      if (workingResult.transportUsed === 'polling') {
        recommendations.push('⚠️ Usando polling (fallback)');
        recommendations.push('WebSocket pode estar bloqueado');
      }
    }

    // Log do relatório
    console.log(`📊 [SOCKET.IO DIAGNOSTICS] Relatório:`);
    console.log(`   URL funcionando: ${workingURL || 'Nenhuma'}`);
    console.log(`   Total de URLs testadas: ${urls.length}`);
    console.log(`   URLs bem-sucedidas: ${results.filter(r => r.success).length}`);
    recommendations.forEach(rec => console.log(`   ${rec}`));

    return {
      workingURL,
      allResults,
      recommendations
    };
  }
}
