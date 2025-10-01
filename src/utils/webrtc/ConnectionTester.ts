/**
 * Connection Tester
 * Testes abrangentes de conectividade para WebSocket e WebRTC
 */

import { SocketIODiagnostics, SocketIODiagnosticResult } from './SocketIODiagnostics';
import { signalingConfig } from '@/config/signalingConfig';

export interface ConnectionTestReport {
  timestamp: number;
  socketIO: {
    tested: boolean;
    success: boolean;
    workingURL: string | null;
    allResults: SocketIODiagnosticResult[];
    recommendations: string[];
  };
  webRTC: {
    tested: boolean;
    supported: boolean;
    error?: string;
  };
  network: {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
  };
  environment: {
    hostname: string;
    protocol: string;
    userAgent: string;
  };
  overall: {
    healthy: boolean;
    criticalIssues: string[];
    warnings: string[];
  };
}

export class ConnectionTester {
  /**
   * Executa teste completo de conectividade
   */
  static async runFullTest(): Promise<ConnectionTestReport> {
    console.log('🔍 [CONNECTION TESTER] Iniciando teste completo...');

    const report: ConnectionTestReport = {
      timestamp: Date.now(),
      socketIO: {
        tested: false,
        success: false,
        workingURL: null,
        allResults: [],
        recommendations: []
      },
      webRTC: {
        tested: false,
        supported: false
      },
      network: {
        online: navigator.onLine
      },
      environment: {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent
      },
      overall: {
        healthy: false,
        criticalIssues: [],
        warnings: []
      }
    };

    // Teste 1: Socket.IO
    try {
      const urls = signalingConfig.getAlternativeURLs();
      const socketIOResult = await SocketIODiagnostics.runFullDiagnostics(urls);
      
      report.socketIO = {
        tested: true,
        success: !!socketIOResult.workingURL,
        workingURL: socketIOResult.workingURL,
        allResults: socketIOResult.allResults,
        recommendations: socketIOResult.recommendations
      };

      if (!socketIOResult.workingURL) {
        report.overall.criticalIssues.push('Socket.IO não está acessível');
      }
    } catch (error) {
      console.error('❌ [CONNECTION TESTER] Erro ao testar Socket.IO:', error);
      report.socketIO.tested = true;
      report.socketIO.success = false;
      report.overall.criticalIssues.push('Falha ao testar Socket.IO');
    }

    // Teste 2: WebRTC
    try {
      const hasRTCPeerConnection = typeof RTCPeerConnection !== 'undefined';
      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      
      report.webRTC = {
        tested: true,
        supported: hasRTCPeerConnection && hasGetUserMedia
      };

      if (!hasRTCPeerConnection) {
        report.overall.criticalIssues.push('RTCPeerConnection não suportado');
      }
      if (!hasGetUserMedia) {
        report.overall.warnings.push('getUserMedia não disponível');
      }
    } catch (error) {
      console.error('❌ [CONNECTION TESTER] Erro ao testar WebRTC:', error);
      report.webRTC = {
        tested: true,
        supported: false,
        error: error instanceof Error ? error.message : String(error)
      };
      report.overall.criticalIssues.push('Erro ao verificar suporte WebRTC');
    }

    // Teste 3: Qualidade de rede
    try {
      const connection = (navigator as any).connection;
      if (connection) {
        report.network.effectiveType = connection.effectiveType;
        report.network.downlink = connection.downlink;

        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          report.overall.warnings.push('Conexão de rede muito lenta detectada');
        }
      }

      if (!navigator.onLine) {
        report.overall.criticalIssues.push('Dispositivo offline');
      }
    } catch (error) {
      console.error('❌ [CONNECTION TESTER] Erro ao testar rede:', error);
    }

    // Avaliação geral
    report.overall.healthy = 
      report.socketIO.success &&
      report.webRTC.supported &&
      report.network.online &&
      report.overall.criticalIssues.length === 0;

    // Log do relatório
    this.logReport(report);

    return report;
  }

  /**
   * Loga relatório de forma formatada
   */
  private static logReport(report: ConnectionTestReport): void {
    console.log('📊 [CONNECTION TESTER] ═══════════════════════════════════');
    console.log(`📊 [CONNECTION TESTER] Relatório de Conectividade`);
    console.log('📊 [CONNECTION TESTER] ═══════════════════════════════════');
    
    // Socket.IO
    console.log(`📊 [CONNECTION TESTER] Socket.IO:`);
    console.log(`   ✓ Testado: ${report.socketIO.tested}`);
    console.log(`   ✓ Sucesso: ${report.socketIO.success}`);
    console.log(`   ✓ URL: ${report.socketIO.workingURL || 'Nenhuma'}`);
    
    // WebRTC
    console.log(`📊 [CONNECTION TESTER] WebRTC:`);
    console.log(`   ✓ Suportado: ${report.webRTC.supported}`);
    if (report.webRTC.error) {
      console.log(`   ✗ Erro: ${report.webRTC.error}`);
    }
    
    // Rede
    console.log(`📊 [CONNECTION TESTER] Rede:`);
    console.log(`   ✓ Online: ${report.network.online}`);
    if (report.network.effectiveType) {
      console.log(`   ✓ Tipo: ${report.network.effectiveType}`);
    }
    
    // Geral
    console.log(`📊 [CONNECTION TESTER] Geral:`);
    console.log(`   ✓ Saudável: ${report.overall.healthy}`);
    
    if (report.overall.criticalIssues.length > 0) {
      console.log(`   ⚠️ PROBLEMAS CRÍTICOS:`);
      report.overall.criticalIssues.forEach(issue => 
        console.log(`      - ${issue}`)
      );
    }
    
    if (report.overall.warnings.length > 0) {
      console.log(`   ⚠️ Avisos:`);
      report.overall.warnings.forEach(warning => 
        console.log(`      - ${warning}`)
      );
    }

    if (report.socketIO.recommendations.length > 0) {
      console.log(`   💡 Recomendações:`);
      report.socketIO.recommendations.forEach(rec => 
        console.log(`      ${rec}`)
      );
    }
    
    console.log('📊 [CONNECTION TESTER] ═══════════════════════════════════');
  }

  /**
   * Teste rápido apenas de Socket.IO
   */
  static async quickSocketIOTest(): Promise<boolean> {
    const urls = signalingConfig.getAlternativeURLs();
    const result = await SocketIODiagnostics.findWorkingURL(urls, 3000);
    return result?.success || false;
  }
}
