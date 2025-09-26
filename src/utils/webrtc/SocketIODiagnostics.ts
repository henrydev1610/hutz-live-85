/**
 * Diagnósticos específicos para conexões Socket.IO
 * Identifica problemas no handshake e conectividade WebSocket
 */

import { io, Socket } from 'socket.io-client';
import { signalingConfig } from '../../config/signalingConfig';

export interface SocketIODiagnosticResult {
  success: boolean;
  url: string;
  error?: string;
  handshakeSuccess: boolean;
  transportType?: string;
  connectionTime?: number;
  details: {
    urlValid: boolean;
    serverReachable: boolean;
    socketIOCompatible: boolean;
    pathCorrect: boolean;
  };
}

export class SocketIODiagnostics {
  /**
   * Executa diagnósticos completos da conexão Socket.IO
   */
  static async runDiagnostics(): Promise<SocketIODiagnosticResult> {
    const config = signalingConfig.getConfig();
    const url = config.url;
    
    console.log('🔍 [SOCKET.IO DIAGNOSTICS] Iniciando diagnósticos para:', url);
    
    const result: SocketIODiagnosticResult = {
      success: false,
      url,
      handshakeSuccess: false,
      details: {
        urlValid: false,
        serverReachable: false,
        socketIOCompatible: false,
        pathCorrect: false
      }
    };

    try {
      // 1. Validar formato da URL
      result.details.urlValid = this.validateURL(url);
      if (!result.details.urlValid) {
        result.error = 'URL inválida ou malformada';
        return result;
      }

      // 2. Verificar se path /socket.io está presente
      result.details.pathCorrect = url.includes('/socket.io');
      if (!result.details.pathCorrect) {
        result.error = 'URL não contém path /socket.io necessário para Socket.IO';
        console.warn('⚠️ [SOCKET.IO DIAGNOSTICS] Path /socket.io ausente na URL:', url);
      }

      // 3. Testar conexão Socket.IO real
      const connectionResult = await this.testSocketIOConnection(url);
      result.handshakeSuccess = connectionResult.success;
      result.transportType = connectionResult.transport;
      result.connectionTime = connectionResult.connectionTime;
      result.details.serverReachable = connectionResult.success;
      result.details.socketIOCompatible = connectionResult.success;
      
      if (connectionResult.error) {
        result.error = connectionResult.error;
      }

      result.success = result.details.urlValid && 
                      result.details.pathCorrect && 
                      result.handshakeSuccess;

    } catch (error) {
      result.error = `Erro durante diagnósticos: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌ [SOCKET.IO DIAGNOSTICS] Erro crítico:', error);
    }

    this.logDiagnosticResults(result);
    return result;
  }

  /**
   * Testa conexão Socket.IO real com timeout
   */
  private static async testSocketIOConnection(url: string): Promise<{
    success: boolean;
    transport?: string;
    connectionTime?: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let socket: Socket | null = null;
      
      const timeout = setTimeout(() => {
        if (socket) {
          socket.disconnect();
        }
        resolve({
          success: false,
          error: 'Timeout na conexão Socket.IO (10s)'
        });
      }, 10000);

      try {
        console.log('🔌 [SOCKET.IO DIAGNOSTICS] Testando conexão Socket.IO:', url);
        
        socket = io(url, {
          autoConnect: true,
          timeout: 8000,
          transports: ['websocket', 'polling'],
          forceNew: true
        });

        socket.on('connect', () => {
          const connectionTime = Date.now() - startTime;
          console.log('✅ [SOCKET.IO DIAGNOSTICS] Conexão estabelecida!', {
            transport: socket?.io.engine?.transport?.name,
            connectionTime: `${connectionTime}ms`
          });
          
          clearTimeout(timeout);
          socket?.disconnect();
          
          resolve({
            success: true,
            transport: socket?.io.engine?.transport?.name,
            connectionTime
          });
        });

        socket.on('connect_error', (error) => {
          console.error('❌ [SOCKET.IO DIAGNOSTICS] Erro de conexão:', error);
          clearTimeout(timeout);
          socket?.disconnect();
          
          resolve({
            success: false,
            error: `Erro de conexão: ${error.message || String(error)}`
          });
        });

        socket.on('disconnect', (reason) => {
          console.log('🔌 [SOCKET.IO DIAGNOSTICS] Desconectado:', reason);
        });

      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Erro ao criar socket: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
  }

  /**
   * Valida formato da URL
   */
  private static validateURL(url: string): boolean {
    try {
      const parsedURL = new URL(url);
      const validProtocols = ['ws:', 'wss:', 'http:', 'https:'];
      return validProtocols.includes(parsedURL.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Log detalhado dos resultados
   */
  private static logDiagnosticResults(result: SocketIODiagnosticResult): void {
    console.log('📊 [SOCKET.IO DIAGNOSTICS] Resultados:', {
      url: result.url,
      success: result.success,
      handshakeSuccess: result.handshakeSuccess,
      transportType: result.transportType,
      connectionTime: result.connectionTime ? `${result.connectionTime}ms` : 'N/A',
      error: result.error || 'Nenhum erro',
      details: result.details
    });

    if (result.success) {
      console.log('✅ [SOCKET.IO DIAGNOSTICS] Socket.IO funcionando corretamente!');
    } else {
      console.error('❌ [SOCKET.IO DIAGNOSTICS] Problemas detectados:', result.error);
      
      // Sugestões baseadas nos problemas encontrados
      if (!result.details.pathCorrect) {
        console.warn('💡 [SOCKET.IO DIAGNOSTICS] SOLUÇÃO: Adicione /socket.io ao final da URL');
      }
      
      if (!result.details.serverReachable) {
        console.warn('💡 [SOCKET.IO DIAGNOSTICS] SOLUÇÃO: Verifique se o servidor está rodando e acessível');
      }
    }
  }
}

// Tornar disponível globalmente para debug
(window as any).socketIODiagnostics = SocketIODiagnostics;