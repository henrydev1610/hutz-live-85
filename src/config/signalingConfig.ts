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
    
    // PRIORIDADE 1: Variável de ambiente (mais alta prioridade)
    let url = import.meta.env.VITE_SIGNALING_SERVER_URL;
    
    if (DEBUG) {
      console.log('🔧 [SIGNALING CONFIG] Inicializando configuração');
      console.log('🔧 [SIGNALING CONFIG] Host atual:', currentHost);
      console.log('🔧 [SIGNALING CONFIG] VITE_SIGNALING_SERVER_URL:', url);
      console.log('🔧 [SIGNALING CONFIG] VITE_API_URL:', import.meta.env.VITE_API_URL);
    }

    // PRIORIDADE 2: VITE_API_URL como fallback
    if (!url) {
      url = import.meta.env.VITE_API_URL;
      if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Usando VITE_API_URL como fallback');
    }

    // PRIORIDADE 3: Detecção de ambiente
    if (!url) {
      if (isLocalhost) {
        url = 'http://localhost:3000';
        if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente local detectado');
      } else if (currentHost.includes('render.com')) {
        url = 'https://server-hutz-live.onrender.com';
        if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente Render detectado');
      } else if (currentHost.includes('lovableproject.com')) {
        url = 'https://server-hutz-live.onrender.com';
        if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente Lovable detectado');
      } else {
        url = 'https://server-hutz-live.onrender.com';
        if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Ambiente desconhecido, usando produção');
      }
    }

    // Garantir que a URL inclui /socket.io
    const hasSocketIOPath = url.includes('/socket.io');
    if (!hasSocketIOPath) {
      url = url.endsWith('/') ? `${url}socket.io` : `${url}/socket.io`;
      if (DEBUG) console.log('🔧 [SIGNALING CONFIG] Path /socket.io adicionado');
    }

    // Detectar ambiente
    let environment: 'development' | 'production' | 'render' = 'production';
    if (isLocalhost) {
      environment = 'development';
    } else if (url.includes('render.com')) {
      environment = 'render';
    }

    this.config = {
      url,
      environment,
      isLocalhost,
      hasSocketIOPath: true
    };

    if (DEBUG) {
      console.log('✅ [SIGNALING CONFIG] Configuração final:', this.config);
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
      envVars: {
        VITE_SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL,
        VITE_API_URL: import.meta.env.VITE_API_URL,
      }
    };
  }
}

// Exportar instância singleton
export const signalingConfig = new SignalingConfigManager();

// Inicializar automaticamente
signalingConfig.initialize();

// Forçar re-inicialização após 1s para garantir que env vars foram carregadas
setTimeout(() => {
  if (DEBUG) console.log('🔄 [SIGNALING CONFIG] Re-inicializando configuração...');
  signalingConfig.forceInitialize();
}, 1000);
