/**
 * Central signaling configuration module
 * Handles environment-specific WebSocket URL resolution with validation
 */

interface SignalingConfig {
  url: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isPreview: boolean;
  protocol: 'ws' | 'wss';
}

class SignalingConfigManager {
  private config: SignalingConfig | null = null;

  /**
   * Get the resolved signaling configuration
   */
  getConfig(): SignalingConfig {
    if (!this.config) {
      this.config = this.resolveConfig();
    }
    return this.config;
  }

  /**
   * Get the signaling server URL
   */
  getSignalingURL(): string {
    return this.getConfig().url;
  }

  /**
   * Validate configuration for production environments
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    // Validate WSS in production/preview
    if (!config.isDevelopment && config.protocol !== 'wss') {
      errors.push('Production environments must use WSS (wss://) protocol');
    }

    // Validate no localhost in production
    if (!config.isDevelopment && config.url.includes('localhost')) {
      errors.push('Production environments cannot use localhost URLs');
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      errors.push(`Invalid signaling URL format: ${config.url}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Log configuration details for debugging
   */
  logConfig(): void {
    const config = this.getConfig();
    const validation = this.validateConfig();
    
    console.log('🔧 [SIGNALING CONFIG] Configuration loaded:', {
      url: config.url,
      protocol: config.protocol,
      currentHost: window.location.host,
      environment: {
        isDevelopment: config.isDevelopment,
        isProduction: config.isProduction,
        isPreview: config.isPreview
      },
      validation: {
        isValid: validation.isValid,
        errors: validation.errors
      },
      envVars: {
        VITE_SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL || 'NOT_SET',
        NODE_ENV: import.meta.env.MODE,
        DEV: import.meta.env.DEV,
        PROD: import.meta.env.PROD
      }
    });

    // Log warnings for production issues
    if (!validation.isValid) {
      console.error('❌ [SIGNALING CONFIG] Configuration errors:', validation.errors);
    }

    // Log success for valid configurations
    if (validation.isValid) {
      console.log(`✅ [SIGNALING CONFIG] Valid ${config.isDevelopment ? 'development' : 'production'} configuration`);
    }
  }

  private resolveConfig(): SignalingConfig {
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;
    
    // Environment detection - mais específico para Render
    const isDevelopment = currentHost.includes('localhost') || 
                         currentHost.startsWith('127.0.0.1') || 
                         currentHost.startsWith('192.168.') ||
                         import.meta.env.MODE === 'development';
    
    const isPreview = currentHost.includes('lovable.app') || 
                     currentHost.includes('lovableproject.com');
    
    // Render domains seguem padrão específico
    const isProduction = currentHost.includes('onrender.com') || 
                        currentHost.includes('.app') ||
                        (!isDevelopment && !isPreview);

    // URL resolution com prioridade para variável de ambiente
    let signalingURL: string;
    
    const envSignalingURL = import.meta.env.VITE_SIGNALING_SERVER_URL;
    
    if (envSignalingURL) {
      // Use explicit environment variable - SEMPRE tem prioridade
      signalingURL = envSignalingURL;
      console.log('🔧 [SIGNALING CONFIG] Using environment variable:', envSignalingURL);
    } else if (isProduction) {
      // Production: use the production signaling server 
      signalingURL = 'wss://server-hutz-live.onrender.com/socket.io';
      console.log('🌐 [SIGNALING CONFIG] Production auto-config:', signalingURL);
    } else if (isPreview) {
      // Preview: usar servidor de produção também
      signalingURL = 'wss://server-hutz-live.onrender.com/socket.io';
      console.log('📱 [SIGNALING CONFIG] Preview using production server:', signalingURL);
    } else {
      // Development fallback to localhost
      signalingURL = 'ws://localhost:3001/socket.io';
      console.log('🏠 [SIGNALING CONFIG] Development fallback:', signalingURL);
    }

    // CRÍTICO: Garantir que URLs têm o path /socket.io para Socket.IO
    if (!signalingURL.includes('/socket.io')) {
      const hasProtocol = signalingURL.includes('://');
      if (hasProtocol) {
        signalingURL += '/socket.io';
      } else {
        signalingURL = `ws://${signalingURL}/socket.io`;
      }
      console.log('🔧 [SIGNALING CONFIG] Auto-appended /socket.io path:', signalingURL);
    }

    // Protocol extraction
    const protocol = signalingURL.startsWith('wss://') ? 'wss' : 'ws';

    return {
      url: signalingURL,
      isProduction,
      isDevelopment,
      isPreview,
      protocol
    };
  }

  /**
   * Force refresh configuration and retry connection (para debugging no Render)
   */
  refreshConfig(): void {
    this.config = null;
    this.logConfig();
  }

  /**
   * Força reinicialização completa da configuração (para Render deploy)
   */
  forceInitialize(): SignalingConfig {
    console.log('🔄 [SIGNALING CONFIG] Force initializing configuration...');
    this.config = null;
    const config = this.getConfig();
    this.logConfig();
    return config;
  }
}

// Export singleton instance
export const signalingConfig = new SignalingConfigManager();

// Export types for consumers
export type { SignalingConfig };

// Initialize and log configuration on module load
signalingConfig.logConfig();

// Força inicialização em produção após 1 segundo para garantir que env vars foram carregadas
if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.log('🔄 [SIGNALING CONFIG] Re-validating configuration after environment load...');
    signalingConfig.forceInitialize();
  }, 1000);
}

// Make available for debugging
(window as any).signalingConfig = signalingConfig;