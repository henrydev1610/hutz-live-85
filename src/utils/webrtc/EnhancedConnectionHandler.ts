// FASE 2: Enhanced ConnectionHandler using Polite Peer pattern and Centralized Rendering

import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig, useRelayOnly } from '@/utils/webrtc/WebRTCConfig';
import { PoliteWebRTCHandler } from './PoliteWebRTCHandler';
import { centralizedVideoRenderer } from './CentralizedVideoRenderer';

export class EnhancedConnectionHandler {
  private politeHandlers: Map<string, PoliteWebRTCHandler> = new Map();
  private isHost: boolean = false;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  
  // FASE 4: ICE failure detection and relay fallback
  private iceFailureTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly ICE_FAILURE_TIMEOUT = 15000; // 15s

  constructor(isHost: boolean = false) {
    this.isHost = isHost;
    console.log(`🎯 ENHANCED: Initialized connection handler, isHost: ${isHost}`);
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
  }

  // FASE 2: Criar conexão com padrão "polite peer"
  createConnection(participantId: string, localStream?: MediaStream): PoliteWebRTCHandler {
    console.log(`🤝 ENHANCED: Creating polite connection for ${participantId}, isHost: ${this.isHost}`);
    
    // Remover conexão existente se houver
    this.cleanupConnection(participantId);

    const rtcConfig = getActiveWebRTCConfig();
    
    const politeHandler = new PoliteWebRTCHandler(rtcConfig, {
      isPolite: this.isHost, // Host é polite, participante é impolite
      participantId,
      onStreamReceived: (stream) => this.handleStreamReceived(participantId, stream),
      onIceCandidate: (candidate) => {
        unifiedWebSocketService.sendIceCandidate(participantId, candidate);
        console.log(`🧊 ENHANCED: ICE candidate sent for ${participantId}`);
      },
      onOffer: (offer) => {
        unifiedWebSocketService.sendOffer(participantId, offer);
        console.log(`📤 ENHANCED: Offer sent for ${participantId}`);
      },
      onAnswer: (answer) => {
        unifiedWebSocketService.sendAnswer(participantId, answer);
        console.log(`📥 ENHANCED: Answer sent for ${participantId}`);
      }
    });

    this.politeHandlers.set(participantId, politeHandler);

    // FASE 4: Configurar detecção de falha ICE com fallback relay
    this.setupIceFailureDetection(participantId, politeHandler);

    // Se temos um stream local, adicionar
    if (localStream) {
      politeHandler.addStream(localStream);
    }

    return politeHandler;
  }

  // FASE 4: Detectar falhas de ICE e forçar relay
  private setupIceFailureDetection(participantId: string, handler: PoliteWebRTCHandler): void {
    const timeout = setTimeout(() => {
      const state = handler.getConnectionState();
      if (state === 'connecting' || state === 'new') {
        console.warn(`⚠️ ENHANCED: ICE connection timeout for ${participantId}, forcing relay`);
        
        // Forçar relay e recriar conexão
        useRelayOnly(true);
        this.recreateConnectionWithRelay(participantId);
      }
    }, this.ICE_FAILURE_TIMEOUT);

    this.iceFailureTimeouts.set(participantId, timeout);
  }

  private recreateConnectionWithRelay(participantId: string): void {
    console.log(`🔄 ENHANCED: Recreating connection with TURN relay for ${participantId}`);
    
    const oldHandler = this.politeHandlers.get(participantId);
    if (oldHandler) {
      oldHandler.close();
    }

    // Recriar com relay forçado
    this.createConnection(participantId);
    
    // Reset relay flag after recreation
    setTimeout(() => {
      useRelayOnly(false);
    }, 1000);
  }

  // FASE 5: Manipular stream recebido usando renderizador centralizado
  private handleStreamReceived(participantId: string, stream: MediaStream): void {
    console.log(`🎥 ENHANCED: Stream received for ${participantId}`);
    
    // Encontrar container apropriado
    const container = document.getElementById(`video-container-${participantId}`) || 
                     document.querySelector(`[data-participant="${participantId}"]`) ||
                     document.querySelector('.video-preview-container');

    if (container) {
      // FASE 5: Usar renderizador centralizado
      const videoConfig = {
        autoplay: true,
        playsInline: true,
        muted: this.isHost, // Host deve estar muted para evitar feedback
        className: 'w-full h-full object-cover rounded-lg'
      };

      const videoElement = centralizedVideoRenderer.createVideoElement(
        participantId, 
        container as HTMLElement, 
        stream,
        videoConfig
      );

      console.log(`✅ ENHANCED: Video element created and configured for ${participantId}`);
      
      // Callback para sistema externo
      if (this.streamCallback) {
        this.streamCallback(participantId, stream);
      }

      // Disparar evento customizado para integração
      window.dispatchEvent(new CustomEvent('participant-stream-connected', {
        detail: { 
          participantId, 
          stream, 
          element: videoElement,
          timestamp: Date.now(),
          source: 'EnhancedConnectionHandler'
        }
      }));

    } else {
      console.warn(`⚠️ ENHANCED: No container found for ${participantId}`);
    }

    // Limpar timeout de ICE
    const timeout = this.iceFailureTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceFailureTimeouts.delete(participantId);
    }

    // Callback de participante conectado
    if (this.participantJoinCallback) {
      this.participantJoinCallback(participantId);
    }
  }

  // FASE 2: Processar ofertas com padrão polite
  async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📥 ENHANCED: Processing offer from ${participantId}`);
    
    let handler = this.politeHandlers.get(participantId);
    if (!handler) {
      handler = this.createConnection(participantId);
    }

    await handler.processOffer(offer);
  }

  // FASE 2: Processar respostas  
  async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`📤 ENHANCED: Processing answer from ${participantId}`);
    
    const handler = this.politeHandlers.get(participantId);
    if (handler) {
      await handler.processAnswer(answer);
    } else {
      console.warn(`⚠️ ENHANCED: No handler found for answer from ${participantId}`);
    }
  }

  // FASE 2: Adicionar candidatos ICE
  async handleIceCandidate(participantId: string, candidate: RTCIceCandidate): Promise<void> {
    console.log(`🧊 ENHANCED: Processing ICE candidate from ${participantId}`);
    
    const handler = this.politeHandlers.get(participantId);
    if (handler) {
      await handler.addIceCandidate(candidate);
    } else {
      console.warn(`⚠️ ENHANCED: No handler found for ICE candidate from ${participantId}`);
    }
  }

  // FASE 2: Substituir track (troca de câmera)
  async replaceVideoTrack(participantId: string, newTrack: MediaStreamTrack): Promise<void> {
    console.log(`🔄 ENHANCED: Replacing video track for ${participantId}`);
    
    const handler = this.politeHandlers.get(participantId);
    if (handler) {
      await handler.replaceVideoTrack(newTrack);
      console.log(`✅ ENHANCED: Video track replaced for ${participantId}`);
    } else {
      console.warn(`⚠️ ENHANCED: No handler found to replace track for ${participantId}`);
    }
  }

  // FASE 5: Diagnósticos objetivos
  getDiagnostics(): {
    connections: number;
    healthyVideos: number;
    participantStates: Array<{
      participantId: string;
      connectionState: RTCPeerConnectionState;
      videoMetrics: { width: number; height: number; receiving: boolean };
    }>;
  } {
    const participantStates: Array<{
      participantId: string;
      connectionState: RTCPeerConnectionState;
      videoMetrics: { width: number; height: number; receiving: boolean };
    }> = [];

    for (const [participantId, handler] of this.politeHandlers) {
      participantStates.push({
        participantId,
        connectionState: handler.getConnectionState(),
        videoMetrics: handler.getVideoMetrics()
      });
    }

    const systemDiag = centralizedVideoRenderer.getSystemDiagnostics();

    return {
      connections: this.politeHandlers.size,
      healthyVideos: systemDiag.healthyVideos,
      participantStates
    };
  }

  // Limpeza de conexão específica
  cleanupConnection(participantId: string): void {
    const handler = this.politeHandlers.get(participantId);
    if (handler) {
      handler.close();
      this.politeHandlers.delete(participantId);
    }

    const timeout = this.iceFailureTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      this.iceFailureTimeouts.delete(participantId);
    }

    // Remover elemento de vídeo
    centralizedVideoRenderer.removeVideoElement(participantId);

    console.log(`🧹 ENHANCED: Connection cleaned up for ${participantId}`);
  }

  // Limpeza completa
  cleanup(): void {
    console.log(`🧹 ENHANCED: Full cleanup of all connections`);
    
    for (const participantId of this.politeHandlers.keys()) {
      this.cleanupConnection(participantId);
    }

    centralizedVideoRenderer.cleanup();
  }

  // Verificar se uma conexão existe
  hasConnection(participantId: string): boolean {
    return this.politeHandlers.has(participantId);
  }

  // Obter estado de uma conexão
  getConnectionState(participantId: string): RTCPeerConnectionState | null {
    const handler = this.politeHandlers.get(participantId);
    return handler ? handler.getConnectionState() : null;
  }
}