/**
 * Signaling Server Configuration
 * Gerencia URLs de conexão com validação e fallbacks automáticos
 */

const DEBUG = true;

interface SignalingConfig {
  url: string;
  environment: 'development' | 'production' | 'render';
  isLocalhost: boolean;
  hasSocketIOPath: boolean;
}

class SignalingConfigManager {
  private config: SignalingConfig | null = null;

  /**
   * Inicializa a configuração detectando ambiente
   */
  initialize(): SignalingConfig {
    if (this.config) return this.config;

    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    
    let url: string;
    let environment: 'development' | 'production' | 'render';
    
    if (DEBUG) {
      console.log('🔧 [SIGNALING CONFIG] Inicializando configuração');
      console.log('🔧 [SIGNALING CONFIG] Host atual:', currentHost);
      console.log('🔧 [SIGNALING CONFIG] isLocalhost:', isLocalhost);
    }

    // Detecção de ambiente baseada no hostname
    if (isLocalhost) {
      url = 'http://localhost:3000/socket.io';
      environment = 'development';
      if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente LOCAL detectado');
    } else {
      // Produção (Lovable, Render, etc)
      url = 'https://server-hutz-live.onrender.com/socket.io';
      environment = 'production';
      if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente PRODUÇÃO detectado');
    }

    this.config = {
      url,
      environment,
      isLocalhost,
      hasSocketIOPath: true
    };

    if (DEBUG) {
      console.log('✅ [SIGNALING CONFIG] Configuração final:', this.config);
      console.log('✅ [SIGNALING CONFIG] URL:', url);
      console.log('✅ [SIGNALING CONFIG] Environment:', environment);
    }

    return this.config;
  }

  /**
   * Retorna a URL do servidor de sinalização
   */
  getURL(): string {
    if (!this.config) {
      this.initialize();
    }
    return this.config!.url;
  }

  /**
   * Retorna URLs alternativas para fallback
   */
  getAlternativeURLs(): string[] {
    const urls: string[] = [];
    
    // URL principal
    urls.push(this.getURL());
    
    // Fallbacks
    const isLocalhost = window.location.hostname === 'localhost';
    
    if (isLocalhost) {
      urls.push('http://localhost:3000/socket.io');
      urls.push('http://127.0.0.1:3000/socket.io');
    } else {
      urls.push('https://server-hutz-live.onrender.com/socket.io');
    }

    // Remover duplicatas
    return [...new Set(urls)];
  }

  /**
   * Força re-inicialização da configuração
   */
  forceInitialize(): SignalingConfig {
    this.config = null;
    return this.initialize();
  }

  /**
   * Retorna informações de debug
   */
  getDebugInfo(): Record<string, any> {
    const config = this.config || this.initialize();
    return {
      ...config,
      alternativeURLs: this.getAlternativeURLs(),
      currentHost: window.location.hostname,
      timestamp: new Date().toISOString()
    };
  }
}

// Exportar instância singleton
export const signalingConfig = new SignalingConfigManager();

// Inicializar automaticamente
signalingConfig.initialize();
