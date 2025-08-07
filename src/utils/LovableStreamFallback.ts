// FASE 4: Fallback HTTP para streaming quando WebRTC falha completamente

export class LovableStreamFallback {
  private endpoints = new Map<string, string>();
  private eventSources = new Map<string, EventSource>();
  private canvasElements = new Map<string, HTMLCanvasElement>();

  constructor(private serverUrl: string = 'https://hutz-live-spark-server.onrender.com') {}

  // FASE 4: Iniciar streaming HTTP como fallback
  public async startHttpStreaming(participantId: string, container: HTMLElement): Promise<boolean> {
    console.log(`🌐 HTTP FALLBACK: Iniciando streaming HTTP para ${participantId}`);

    try {
      // Criar endpoint único para este participante
      const streamEndpoint = `${this.serverUrl}/api/stream/${participantId}`;
      this.endpoints.set(participantId, streamEndpoint);

      // Criar canvas para exibir frames HTTP
      const canvas = document.createElement('canvas');
      canvas.className = 'w-full h-full object-cover absolute inset-0 z-10';
      canvas.style.cssText = `
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

      container.appendChild(canvas);
      this.canvasElements.set(participantId, canvas);

      // Usar Server-Sent Events para streaming de frames
      const eventSource = new EventSource(`${streamEndpoint}/events`);
      this.eventSources.set(participantId, eventSource);

      eventSource.onmessage = (event) => {
        try {
          const frameData = JSON.parse(event.data);
          this.renderHttpFrame(participantId, frameData);
        } catch (error) {
          console.error(`❌ HTTP FALLBACK: Erro parsing frame para ${participantId}:`, error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`❌ HTTP FALLBACK: EventSource error para ${participantId}:`, error);
        // Tentar reconectar automaticamente
        setTimeout(() => {
          this.startHttpStreaming(participantId, container);
        }, 2000);
      };

      console.log(`✅ HTTP FALLBACK: Streaming HTTP iniciado para ${participantId}`);
      return true;

    } catch (error) {
      console.error(`❌ HTTP FALLBACK: Falha iniciando streaming para ${participantId}:`, error);
      return false;
    }
  }

  // FASE 4: Renderizar frame recebido via HTTP
  private renderHttpFrame(participantId: string, frameData: any) {
    const canvas = this.canvasElements.get(participantId);
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    try {
      // Assumindo que frameData contém base64 image
      const img = new Image();
      img.onload = () => {
        // Ajustar tamanho do canvas se necessário
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
      };
      
      img.src = frameData.data || frameData;

    } catch (error) {
      console.error(`❌ HTTP FALLBACK: Erro renderizando frame para ${participantId}:`, error);
    }
  }

  // FASE 4: Notificar servidor sobre novo participante
  public async notifyParticipantJoined(participantId: string, sessionId: string): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/participants/${participantId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          timestamp: Date.now(),
          fallbackMode: 'http'
        })
      });

      console.log(`✅ HTTP FALLBACK: Participante ${participantId} notificado ao servidor`);
    } catch (error) {
      console.error(`❌ HTTP FALLBACK: Erro notificando servidor sobre ${participantId}:`, error);
    }
  }

  // Cleanup para participante
  public cleanup(participantId: string) {
    // Fechar EventSource
    const eventSource = this.eventSources.get(participantId);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(participantId);
    }

    // Remover canvas
    const canvas = this.canvasElements.get(participantId);
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    this.canvasElements.delete(participantId);

    // Limpar endpoint
    this.endpoints.delete(participantId);

    console.log(`🧹 HTTP FALLBACK: Cleanup realizado para ${participantId}`);
  }

  // Cleanup geral
  public cleanupAll() {
    this.eventSources.forEach((_, participantId) => {
      this.cleanup(participantId);
    });

    console.log('🧹 HTTP FALLBACK: Cleanup geral realizado');
  }
}

// Instância singleton
export const httpStreamFallback = new LovableStreamFallback();