/**
 * Utilitário para testar a conectividade WebSocket/Socket.IO
 * Permite testar de forma isolada se a conexão está funcionando
 */

import { SocketIODiagnostics } from './SocketIODiagnostics';
import { signalingConfig } from '../../config/signalingConfig';
import { unifiedWebSocketService } from '../../services/UnifiedWebSocketService';

export class ConnectionTester {
  /**
   * Executa teste completo de conectividade
   */
  static async runFullTest(): Promise<{
    configValid: boolean;
    diagnosticsPass: boolean;
    connectionWorks: boolean;
    error?: string;
    details: any;
  }> {
    console.log('🧪 [CONNECTION TEST] Iniciando teste completo de conectividade...');
    
    const result = {
      configValid: false,
      diagnosticsPass: false,
      connectionWorks: false,
      error: undefined as string | undefined,
      details: {} as any
    };

    try {
      // 1. Testar configuração
      console.log('📋 [TEST] 1/3 - Validando configuração...');
      const config = signalingConfig.getConfig();
      const validation = signalingConfig.validateConfig();
      
      result.configValid = validation.isValid;
      result.details.config = {
        url: config.url,
        protocol: config.protocol,
        environment: {
          isDevelopment: config.isDevelopment,
          isProduction: config.isProduction,
          isPreview: config.isPreview
        },
        validation: validation
      };

      if (!validation.isValid) {
        result.error = `Configuração inválida: ${validation.errors.join(', ')}`;
        console.error('❌ [TEST] Configuração falhou:', validation.errors);
      } else {
        console.log('✅ [TEST] Configuração válida');
      }

      // 2. Testar diagnósticos Socket.IO
      console.log('🔍 [TEST] 2/3 - Executando diagnósticos Socket.IO...');
      const diagnostics = await SocketIODiagnostics.runDiagnostics();
      
      result.diagnosticsPass = diagnostics.success;
      result.details.diagnostics = diagnostics;

      if (!diagnostics.success) {
        result.error = result.error ? 
          `${result.error}; Diagnósticos falharam: ${diagnostics.error}` :
          `Diagnósticos falharam: ${diagnostics.error}`;
        console.error('❌ [TEST] Diagnósticos falharam:', diagnostics.error);
      } else {
        console.log('✅ [TEST] Diagnósticos OK');
      }

      // 3. Testar conexão real WebSocket Service
      console.log('🔌 [TEST] 3/3 - Testando conexão real...');
      const connectionTest = await this.testRealConnection();
      
      result.connectionWorks = connectionTest.success;
      result.details.connection = connectionTest;

      if (!connectionTest.success) {
        result.error = result.error ? 
          `${result.error}; Conexão falhou: ${connectionTest.error}` :
          `Conexão falhou: ${connectionTest.error}`;
        console.error('❌ [TEST] Conexão falhou:', connectionTest.error);
      } else {
        console.log('✅ [TEST] Conexão bem-sucedida');
      }

    } catch (error) {
      result.error = `Erro durante teste: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌ [TEST] Erro crítico:', error);
    }

    // Log resultado final
    this.logTestResults(result);
    
    return result;
  }

  /**
   * Testa conexão real usando o UnifiedWebSocketService
   */
  private static async testRealConnection(): Promise<{
    success: boolean;
    error?: string;
    connectionTime?: number;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let timeoutHandle: NodeJS.Timeout;
      let connectionSucceeded = false;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        unifiedWebSocketService.disconnect();
      };

      const onSuccess = () => {
        if (connectionSucceeded) return;
        connectionSucceeded = true;
        const connectionTime = Date.now() - startTime;
        cleanup();
        resolve({
          success: true,
          connectionTime
        });
      };

      const onError = (error: string) => {
        if (connectionSucceeded) return;
        connectionSucceeded = true;
        cleanup();
        resolve({
          success: false,
          error
        });
      };

      // Setup timeout
      timeoutHandle = setTimeout(() => {
        onError('Timeout na conexão (15s)');
      }, 15000);

      // Setup callbacks
      unifiedWebSocketService.setCallbacks({
        onConnected: onSuccess,
        onDisconnected: (reason?: string) => {
          if (reason) {
            onError(`Desconectado: ${reason}`);
          }
        },
        onError: (error?: any) => {
          onError(`Erro de conexão: ${error?.message || String(error) || 'Erro desconhecido'}`);
        }
      });

      // Attempt connection
      unifiedWebSocketService.connect()
        .catch((error) => {
          onError(`Falha na conexão: ${error.message || String(error)}`);
        });
    });
  }

  /**
   * Log detalhado dos resultados
   */
  private static logTestResults(result: any): void {
    console.log('📊 [CONNECTION TEST] RESULTADO FINAL:');
    console.log('================================');
    console.log(`✅ Configuração válida: ${result.configValid ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Diagnósticos passaram: ${result.diagnosticsPass ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Conexão funciona: ${result.connectionWorks ? 'SIM' : 'NÃO'}`);
    
    if (result.error) {
      console.error(`❌ ERRO: ${result.error}`);
    }

    const allTestsPass = result.configValid && result.diagnosticsPass && result.connectionWorks;
    
    if (allTestsPass) {
      console.log('🎉 TODOS OS TESTES PASSARAM! Conexão WebSocket está funcionando.');
    } else {
      console.error('💥 TESTES FALHARAM! Revise a configuração e diagnósticos acima.');
      
      // Sugestões baseadas nos falhas
      if (!result.configValid) {
        console.warn('💡 SUGESTÃO: Verifique as variáveis de ambiente e configuração');
      }
      if (!result.diagnosticsPass) {
        console.warn('💡 SUGESTÃO: Verifique se a URL contém /socket.io e se o servidor está rodando');
      }
      if (!result.connectionWorks) {
        console.warn('💡 SUGESTÃO: Verifique logs de rede e permissões de firewall');
      }
    }
    console.log('================================');
  }

  /**
   * Teste rápido apenas da configuração
   */
  static quickConfigTest(): boolean {
    const config = signalingConfig.getConfig();
    const validation = signalingConfig.validateConfig();
    
    console.log('⚡ [QUICK TEST] Configuração:', {
      url: config.url,
      hasSocketIOPath: config.url.includes('/socket.io'),
      protocol: config.protocol,
      isValid: validation.isValid,
      errors: validation.errors
    });

    return validation.isValid && config.url.includes('/socket.io');
  }
}

// Tornar disponível globalmente para debug
(window as any).connectionTester = ConnectionTester;

// Log de inicialização
console.log('🧪 [CONNECTION TESTER] Utilitário carregado. Use connectionTester.runFullTest() no console.');