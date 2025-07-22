
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export interface SignalingConfig {
  type: 'node' | 'supabase';
  url: string;
  priority: number;
  fallbackUrl?: string;
}

export class SignalingResolver {
  private static instance: SignalingResolver;
  private currentConfig: SignalingConfig | null = null;
  private availableConfigs: SignalingConfig[] = [];
  private isResolving = false;

  private constructor() {
    this.initializeConfigs();
  }

  static getInstance(): SignalingResolver {
    if (!SignalingResolver.instance) {
      SignalingResolver.instance = new SignalingResolver();
    }
    return SignalingResolver.instance;
  }

  private initializeConfigs() {
    // Configure available signaling systems in order of preference
    this.availableConfigs = [
      {
        type: 'node',
        url: import.meta.env.VITE_API_URL || 'http://localhost:3001',
        priority: 1, // Higher priority for Node.js server (more stable)
        fallbackUrl: 'https://server-hutz-live.onrender.com'
      },
      {
        type: 'supabase',
        url: 'https://fuhvpzprzqdfcojueswo.supabase.co/functions/v1/signaling',
        priority: 2 // Lower priority for Supabase Edge Function
      }
    ];

    console.log('🔧 SIGNALING RESOLVER: Initialized with configs:', this.availableConfigs);
  }

  async resolveOptimalSignaling(): Promise<SignalingConfig> {
    if (this.isResolving) {
      console.log('⏳ SIGNALING RESOLVER: Resolution already in progress');
      return this.currentConfig || this.availableConfigs[0];
    }

    this.isResolving = true;
    console.log('🔍 SIGNALING RESOLVER: Starting optimal signaling resolution...');

    try {
      // Test all available configs
      const testResults = await Promise.allSettled(
        this.availableConfigs.map(config => this.testSignalingConfig(config))
      );

      const workingConfigs: SignalingConfig[] = [];
      
      testResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          workingConfigs.push(this.availableConfigs[index]);
          console.log(`✅ SIGNALING RESOLVER: ${this.availableConfigs[index].type} is available`);
        } else {
          console.log(`❌ SIGNALING RESOLVER: ${this.availableConfigs[index].type} is not available`);
        }
      });

      if (workingConfigs.length === 0) {
        throw new Error('No signaling systems are available');
      }

      // Sort by priority (lower number = higher priority)
      workingConfigs.sort((a, b) => a.priority - b.priority);
      const optimalConfig = workingConfigs[0];

      this.currentConfig = optimalConfig;
      console.log(`🎯 SIGNALING RESOLVER: Selected optimal config:`, optimalConfig);

      // Check for conflicts
      if (workingConfigs.length > 1) {
        console.warn('⚠️ SIGNALING RESOLVER: Multiple signaling systems available - potential conflict');
        console.warn('Available systems:', workingConfigs.map(c => c.type));
      }

      return optimalConfig;

    } catch (error) {
      console.error('❌ SIGNALING RESOLVER: Failed to resolve optimal signaling:', error);
      
      // Fallback to first available config
      const fallbackConfig = this.availableConfigs[0];
      this.currentConfig = fallbackConfig;
      return fallbackConfig;
      
    } finally {
      this.isResolving = false;
    }
  }

  private async testSignalingConfig(config: SignalingConfig): Promise<boolean> {
    console.log(`🔍 Testing ${config.type} signaling at ${config.url}`);
    
    try {
      if (config.type === 'node') {
        return await this.testNodeServer(config.url);
      } else if (config.type === 'supabase') {
        return await this.testSupabaseEdge(config.url);
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to test ${config.type} signaling:`, error);
      return false;
    }
  }

  private async testNodeServer(url: string): Promise<boolean> {
    try {
      // Test HTTP health endpoint
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) {
        return false;
      }

      // Test WebSocket connection
      return new Promise((resolve) => {
        const wsUrl = url.replace(/^http/, 'ws');
        const testSocket = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          testSocket.close();
          resolve(false);
        }, 2000);
        
        testSocket.onopen = () => {
          clearTimeout(timeout);
          testSocket.close();
          resolve(true);
        };
        
        testSocket.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }

  private async testSupabaseEdge(url: string): Promise<boolean> {
    try {
      // Test WebSocket upgrade for Supabase Edge Function
      return new Promise((resolve) => {
        const wsUrl = url.replace(/^https/, 'wss') + '?room=test&id=diagnostic';
        const testSocket = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          testSocket.close();
          resolve(false);
        }, 2000);
        
        testSocket.onopen = () => {
          clearTimeout(timeout);
          testSocket.close();
          resolve(true);
        };
        
        testSocket.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }

  async connectWithOptimalSignaling(): Promise<void> {
    const config = await this.resolveOptimalSignaling();
    
    console.log(`🔗 SIGNALING RESOLVER: Connecting with ${config.type} signaling`);
    
    // Disconnect any existing connection first
    if (unifiedWebSocketService.isConnected()) {
      console.log('🔌 SIGNALING RESOLVER: Disconnecting existing connection');
      unifiedWebSocketService.disconnect();
      
      // Wait for clean disconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Connect with the optimal configuration
    if (config.type === 'node') {
      await unifiedWebSocketService.connect(config.url);
    } else if (config.type === 'supabase') {
      await unifiedWebSocketService.connect(config.url);
    }
    
    console.log(`✅ SIGNALING RESOLVER: Connected using ${config.type} signaling`);
  }

  getCurrentConfig(): SignalingConfig | null {
    return this.currentConfig;
  }

  forceUseConfig(type: 'node' | 'supabase'): void {
    const config = this.availableConfigs.find(c => c.type === type);
    if (config) {
      this.currentConfig = config;
      console.log(`🔧 SIGNALING RESOLVER: Forced to use ${type} signaling`);
    } else {
      console.error(`❌ SIGNALING RESOLVER: Config ${type} not found`);
    }
  }

  async switchSignaling(type: 'node' | 'supabase'): Promise<void> {
    const config = this.availableConfigs.find(c => c.type === type);
    if (!config) {
      throw new Error(`Signaling type ${type} not available`);
    }

    console.log(`🔄 SIGNALING RESOLVER: Switching to ${type} signaling`);
    
    // Test the target config first
    const isAvailable = await this.testSignalingConfig(config);
    if (!isAvailable) {
      throw new Error(`${type} signaling is not available`);
    }

    // Disconnect current connection
    if (unifiedWebSocketService.isConnected()) {
      unifiedWebSocketService.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Connect with new config
    this.currentConfig = config;
    await unifiedWebSocketService.connect(config.url);
    
    console.log(`✅ SIGNALING RESOLVER: Successfully switched to ${type} signaling`);
  }
}

// Export singleton instance
export const signalingResolver = SignalingResolver.getInstance();
