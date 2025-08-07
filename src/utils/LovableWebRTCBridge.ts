// FASE 3: Bridge para contornar limitações iframe do Lovable
import { setupVideoElement } from '@/utils/media/videoPlayback';

interface StreamTransferData {
  participantId: string;
  streamData: string; // Base64 encoded frames
  metadata: {
    width: number;
    height: number;
    timestamp: number;
    frameRate?: number;
  };
}

export class LovableWebRTCBridge {
  private canvasCache = new Map<string, HTMLCanvasElement>();
  private frameIntervals = new Map<string, number>();
  private isLovableEnvironment = false;

  constructor() {
    this.detectEnvironment();
  }

  private detectEnvironment() {
    try {
      // Detectar se está no iframe do Lovable
      this.isLovableEnvironment = window.location.hostname.includes('lovable') ||
                                 window.parent !== window ||
                                 !!document.querySelector('script[src*="gptengineer"]');
      
      console.log(`🌍 AMBIENTE DETECTADO: ${this.isLovableEnvironment ? 'Lovable (limitado)' : 'Padrão'}`);
    } catch (error) {
      console.log('⚠️ Erro detectando ambiente, assumindo Lovable:', error);
      this.isLovableEnvironment = true;
    }
  }

  // FASE 3: Converter MediaStream para dados transferíveis
  public async convertStreamToTransferable(participantId: string, stream: MediaStream): Promise<void> {
    if (!this.isLovableEnvironment) {
      console.log(`✅ Ambiente padrão: usando srcObject diretamente para ${participantId}`);
      return;
    }

    console.log(`🔄 LOVABLE BRIDGE: Convertendo stream para dados transferíveis - ${participantId}`);

    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.warn(`⚠️ Sem video track para ${participantId}`);
        return;
      }

      // Criar canvas para captura de frames
      let canvas = this.canvasCache.get(participantId);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 320;  // Resolução otimizada para transferência
        canvas.height = 240;
        this.canvasCache.set(participantId, canvas);
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      // Criar video temporário para captura
      const tempVideo = document.createElement('video');
      tempVideo.srcObject = stream;
      tempVideo.muted = true;
      tempVideo.playsInline = true;

      await tempVideo.play();

      // FASE 3: Capturar frames e transferir via MessageChannel
      const captureAndTransfer = () => {
        try {
          context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const frameData = canvas.toDataURL('image/jpeg', 0.7);

          // Enviar frame via CustomEvent para o componente
          window.dispatchEvent(new CustomEvent(`lovable-frame-${participantId}`, {
            detail: {
              participantId,
              frameData,
              timestamp: Date.now(),
              width: canvas.width,
              height: canvas.height
            }
          }));

        } catch (error) {
          console.error(`❌ Erro capturando frame para ${participantId}:`, error);
        }
      };

      // Iniciar captura de frames (15 FPS para performance)
      const interval = window.setInterval(captureAndTransfer, 66);
      this.frameIntervals.set(participantId, interval);

      console.log(`✅ LOVABLE BRIDGE: Captura de frames iniciada para ${participantId}`);

    } catch (error) {
      console.error(`❌ LOVABLE BRIDGE: Erro convertendo stream para ${participantId}:`, error);
    }
  }

  // FASE 3: Aplicar frames transferidos ao elemento de vídeo
  public setupLovableVideoElement(container: HTMLElement, participantId: string): HTMLCanvasElement | null {
    if (!this.isLovableEnvironment) return null;

    console.log(`🎨 LOVABLE BRIDGE: Criando canvas renderer para ${participantId}`);

    // Criar canvas para exibir frames
    const displayCanvas = document.createElement('canvas');
    displayCanvas.className = 'w-full h-full object-cover absolute inset-0 z-10';
    displayCanvas.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
      background: #000;
    `;

    const context = displayCanvas.getContext('2d');
    if (!context) return null;

    // Listener para frames recebidos
    const handleFrame = (event: CustomEvent) => {
      const { frameData, width, height } = event.detail;
      
      // Ajustar tamanho do canvas se necessário
      if (displayCanvas.width !== width || displayCanvas.height !== height) {
        displayCanvas.width = width;
        displayCanvas.height = height;
      }

      // Criar imagem e desenhar no canvas
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
      };
      img.src = frameData;
    };

    window.addEventListener(`lovable-frame-${participantId}`, handleFrame as EventListener);

    // Adicionar canvas ao container
    container.appendChild(displayCanvas);

    console.log(`✅ LOVABLE BRIDGE: Canvas renderer criado para ${participantId}`);
    return displayCanvas;
  }

  // Cleanup para participante
  public cleanup(participantId: string) {
    // Parar captura de frames
    const interval = this.frameIntervals.get(participantId);
    if (interval) {
      window.clearInterval(interval);
      this.frameIntervals.delete(participantId);
    }

    // Remover canvas do cache
    this.canvasCache.delete(participantId);

    // Remover event listeners
    window.removeEventListener(`lovable-frame-${participantId}`, () => {});

    console.log(`🧹 LOVABLE BRIDGE: Cleanup realizado para ${participantId}`);
  }

  // Cleanup geral
  public cleanupAll() {
    this.frameIntervals.forEach((interval, participantId) => {
      this.cleanup(participantId);
    });

    console.log('🧹 LOVABLE BRIDGE: Cleanup geral realizado');
  }
}

// Instância singleton
export const lovableBridge = new LovableWebRTCBridge();