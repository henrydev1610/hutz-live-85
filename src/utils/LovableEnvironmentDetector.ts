// FASE 1: Detector de ambiente Lovable e suas limitações

export interface EnvironmentCapabilities {
  supportsDirectWebRTC: boolean;
  supportsMediaStream: boolean;
  supportsPostMessage: boolean;
  requiresFallback: boolean;
  environment: 'lovable' | 'vercel' | 'local' | 'other';
  limitations: string[];
}

export class LovableEnvironmentDetector {
  private capabilities: EnvironmentCapabilities;

  constructor() {
    this.capabilities = this.detectEnvironment();
    this.logCapabilities();
  }

  private detectEnvironment(): EnvironmentCapabilities {
    const hostname = window.location.hostname;
    const userAgent = navigator.userAgent;
    const isInIframe = window.parent !== window;
    
    // Detectar Lovable
    if (hostname.includes('lovable') || 
        document.querySelector('script[src*="gptengineer"]') ||
        document.querySelector('script[src*="lovable"]')) {
      
      return {
        supportsDirectWebRTC: false,  // Limitado no Lovable
        supportsMediaStream: false,   // srcObject bloqueado
        supportsPostMessage: true,    // Funciona
        requiresFallback: true,       // Sempre precisar fallback
        environment: 'lovable',
        limitations: [
          'MediaStream srcObject bloqueado',
          'WebRTC limitado por iframe sandbox',
          'CSP restritivo',
          'CORS policies rígidas',
          'Isolamento de contexto'
        ]
      };
    }

    // Detectar Vercel
    if (hostname.includes('vercel.app')) {
      return {
        supportsDirectWebRTC: true,
        supportsMediaStream: true,
        supportsPostMessage: true,
        requiresFallback: false,
        environment: 'vercel',
        limitations: []
      };
    }

    // Local development
    if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
      return {
        supportsDirectWebRTC: true,
        supportsMediaStream: true,
        supportsPostMessage: true,
        requiresFallback: false,
        environment: 'local',
        limitations: []
      };
    }

    // Outros ambientes
    return {
      supportsDirectWebRTC: true,
      supportsMediaStream: true,
      supportsPostMessage: true,
      requiresFallback: false,
      environment: 'other',
      limitations: []
    };
  }

  private logCapabilities() {
    console.log('🌍 AMBIENTE DETECTADO:', this.capabilities.environment.toUpperCase());
    console.log('📊 CAPACIDADES:', {
      WebRTC: this.capabilities.supportsDirectWebRTC ? '✅' : '❌',
      MediaStream: this.capabilities.supportsMediaStream ? '✅' : '❌',
      PostMessage: this.capabilities.supportsPostMessage ? '✅' : '❌',
      RequiresFallback: this.capabilities.requiresFallback ? '⚠️' : '✅'
    });

    if (this.capabilities.limitations.length > 0) {
      console.warn('⚠️ LIMITAÇÕES DETECTADAS:');
      this.capabilities.limitations.forEach(limitation => {
        console.warn(`  - ${limitation}`);
      });
    }
  }

  // Testes dinâmicos de capacidades
  public async testWebRTCCapabilities(): Promise<boolean> {
    try {
      const pc = new RTCPeerConnection();
      await pc.close();
      console.log('✅ RTCPeerConnection funcional');
      return true;
    } catch (error) {
      console.error('❌ RTCPeerConnection bloqueado:', error);
      return false;
    }
  }

  public async testMediaStreamCapabilities(): Promise<boolean> {
    try {
      const video = document.createElement('video');
      const testStream = new MediaStream();
      video.srcObject = testStream;
      console.log('✅ MediaStream srcObject funcional');
      return true;
    } catch (error) {
      console.error('❌ MediaStream srcObject bloqueado:', error);
      return false;
    }
  }

  public async testUserMediaCapabilities(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1, height: 1 }, 
        audio: false 
      });
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ getUserMedia funcional');
      return true;
    } catch (error) {
      console.error('❌ getUserMedia bloqueado:', error);
      return false;
    }
  }

  // Executar todos os testes
  public async runAllTests(): Promise<void> {
    console.log('🧪 INICIANDO TESTES DE CAPACIDADE...');
    
    const webrtcWorks = await this.testWebRTCCapabilities();
    const streamWorks = await this.testMediaStreamCapabilities();  
    const userMediaWorks = await this.testUserMediaCapabilities();

    // Atualizar capacidades baseado nos testes
    this.capabilities.supportsDirectWebRTC = webrtcWorks;
    this.capabilities.supportsMediaStream = streamWorks;
    this.capabilities.requiresFallback = !webrtcWorks || !streamWorks;

    console.log('📊 RESULTADOS DOS TESTES:');
    console.log(`  WebRTC: ${webrtcWorks ? '✅' : '❌'}`);
    console.log(`  MediaStream: ${streamWorks ? '✅' : '❌'}`);
    console.log(`  UserMedia: ${userMediaWorks ? '✅' : '❌'}`);
    console.log(`  Fallback necessário: ${this.capabilities.requiresFallback ? '⚠️' : '✅'}`);
  }

  public getCapabilities(): EnvironmentCapabilities {
    return { ...this.capabilities };
  }

  public isLovable(): boolean {
    return this.capabilities.environment === 'lovable';
  }

  public requiresFallback(): boolean {
    return this.capabilities.requiresFallback;
  }
}

// Instância singleton
export const environmentDetector = new LovableEnvironmentDetector();