// FASE 1: Detector de ambiente Lovable e suas limitações

export interface EnvironmentCapabilities {
  supportsDirectWebRTC: boolean;
  supportsMediaStream: boolean;
  supportsPostMessage: boolean;
  requiresFallback: boolean;
  supportsTwilioVideo: boolean;
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
        requiresFallback: true,       // Sempre precisar fallback - EXCETO para Twilio
        supportsTwilioVideo: true,    // Twilio funciona com .attach() direto
        environment: 'lovable',
        limitations: [
          'MediaStream srcObject bloqueado',
          'WebRTC limitado por iframe sandbox',
          'CSP restritivo - EXCETO Twilio Video',
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
        supportsTwilioVideo: true,
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
        supportsTwilioVideo: true,
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
      supportsTwilioVideo: true,
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
      // FASE 2: Padronizar para usar configuração global do sistema
      const { getActiveWebRTCConfig } = await import('@/utils/webrtc/WebRTCConfig');
      const config = await getActiveWebRTCConfig();
      const pc = new RTCPeerConnection(config);
      await pc.close();
      console.log('✅ RTCPeerConnection funcional com configuração padrão do sistema');
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

  public supportsTwilioVideo(): boolean {
    return this.capabilities.supportsTwilioVideo;
  }

  public isTwilioTrack(track: any): boolean {
    // Detectar se é um track do Twilio Video (tem método .attach)
    return track && typeof track.attach === 'function' && track.kind;
  }

  public isTwilioVideoActive(): boolean {
    // Verificar se Twilio Video SDK está carregado
    return typeof window !== 'undefined' && 
           ((window as any).Twilio?.Video !== undefined);
  }
}

// Instância singleton
export const environmentDetector = new LovableEnvironmentDetector();