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
        VITE_SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL || 'not-set',
        NODE_ENV: import.meta.env.MODE
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
    
    // Environment detection
    const isDevelopment = currentHost.includes('localhost') || 
                         currentHost.startsWith('127.0.0.1') || 
                         currentHost.startsWith('192.168.') ||
                         import.meta.env.MODE === 'development';
    
    const isPreview = currentHost.includes('lovable.app') || 
                     currentHost.includes('lovableproject.com');
    
    const isProduction = currentHost.includes('onrender.com') || 
                        (!isDevelopment && !isPreview);

    // URL resolution priority: env var > production mapping > localhost fallback
    let signalingURL: string;
    
    const envSignalingURL = import.meta.env.VITE_SIGNALING_SERVER_URL;
    
    if (envSignalingURL) {
      // Use explicit environment variable
      signalingURL = envSignalingURL;
      console.log('🔧 [SIGNALING CONFIG] Using environment variable:', envSignalingURL);
    } else if (isProduction || isPreview) {
      // Production/preview: use the production signaling server with Socket.IO path
      signalingURL = 'wss://server-hutz-live.onrender.com/socket.io';
      console.log('🌐 [SIGNALING CONFIG] Production/preview auto-config:', signalingURL);
    } else {
      // Development fallback to localhost with Socket.IO path
      signalingURL = `ws://localhost:3001/socket.io`;
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
   * Force refresh configuration (for testing/debugging)
   */
  refreshConfig(): void {
    this.config = null;
    this.logConfig();
  }
}

// Export singleton instance
export const signalingConfig = new SignalingConfigManager();

// Export types for consumers
export type { SignalingConfig };

// Initialize and log configuration on module load
signalingConfig.logConfig();

// Make available for debugging
(window as any).signalingConfig = signalingConfig;