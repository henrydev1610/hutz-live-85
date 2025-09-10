/**
 * Pre-allocated Transceivers Manager
 * 
 * Resolve instabilidade WebRTC criando transceivers em ORDEM FIXA
 * ao criar PeerConnection. Nunca mais cria/remove transceivers dinamicamente.
 * 
 * REGRAS:
 * 1. Transceivers criados ANTES de qualquer negociação
 * 2. Ordem fixa: [video, audio] sempre
 * 3. Apenas replaceTrack para trocar mídia
 * 4. Nunca addTrack/removeTrack após criação
 */

interface TransceiverSetup {
  video: RTCRtpTransceiver;
  audio: RTCRtpTransceiver | null;
}

export class PreAllocatedTransceivers {
  private transceivers = new Map<string, TransceiverSetup>();

  /**
   * Cria transceivers em ordem fixa ANTES de qualquer negociação
   */
  initializeTransceivers(
    participantId: string,
    peerConnection: RTCPeerConnection,
    role: 'host' | 'participant'
  ): TransceiverSetup {
    console.log(`🔧 [TRANSCEIVERS] Initializing fixed-order transceivers for ${participantId} (${role})`);

    // ORDEM FIXA: Video primeiro, áudio depois (se necessário)
    let setup: TransceiverSetup;
    
    if (role === 'participant') {
      // Participant: sendonly video, inactive audio (reserva slot)
      setup = {
        video: peerConnection.addTransceiver('video', { 
          direction: 'sendonly',
          streams: [] // Sem stream inicial - será definido via replaceTrack
        }),
        audio: peerConnection.addTransceiver('audio', { 
          direction: 'inactive' // Reserve slot para futuro uso
        })
      };
      console.log(`✅ [TRANSCEIVERS] Participant ${participantId}: video=sendonly, audio=inactive`);
    } else {
      // Host: recvonly video, inactive audio (reserva slot)
      setup = {
        video: peerConnection.addTransceiver('video', { 
          direction: 'recvonly'
        }),
        audio: peerConnection.addTransceiver('audio', { 
          direction: 'inactive' // Reserve slot para futuro uso
        })
      };
      console.log(`✅ [TRANSCEIVERS] Host ${participantId}: video=recvonly, audio=inactive`);
    }

    this.transceivers.set(participantId, setup);
    
    console.log(`🎯 [TRANSCEIVERS] Fixed topology established for ${participantId}:`, {
      videoDirection: setup.video.direction,
      audioDirection: setup.audio?.direction,
      transceiverCount: peerConnection.getTransceivers().length
    });

    return setup;
  }

  /**
   * Substitui track no transceiver de vídeo pré-alocado
   */
  async replaceVideoTrack(
    participantId: string,
    track: MediaStreamTrack
  ): Promise<RTCRtpSender | null> {
    const setup = this.transceivers.get(participantId);
    if (!setup) {
      throw new Error(`No transceivers found for participant: ${participantId}`);
    }

    console.log(`🔄 [TRANSCEIVERS] Replacing video track for ${participantId}:`, {
      trackId: track.id,
      trackState: track.readyState,
      enabled: track.enabled,
      muted: track.muted
    });

    try {
      const sender = setup.video.sender;
      if (sender) {
        await sender.replaceTrack(track);
        console.log(`✅ [TRANSCEIVERS] Video track replaced successfully for ${participantId}`);
        return sender;
      } else {
        console.warn(`⚠️ [TRANSCEIVERS] No sender found in video transceiver for ${participantId}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [TRANSCEIVERS] Failed to replace video track for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém sender de vídeo pré-alocado
   */
  getVideoSender(participantId: string): RTCRtpSender | null {
    const setup = this.transceivers.get(participantId);
    return setup?.video.sender || null;
  }

  /**
   * Valida que ordem das m-lines não foi alterada
   */
  validateTransceiverOrder(participantId: string, peerConnection: RTCPeerConnection): boolean {
    const transceivers = peerConnection.getTransceivers();
    
    if (transceivers.length !== 2) {
      console.warn(`⚠️ [TRANSCEIVERS] Expected 2 transceivers for ${participantId}, got ${transceivers.length}`);
      return false;
    }

    // Validar ordem: video primeiro, audio segundo
    const videoFirst = transceivers[0].receiver.track?.kind === 'video' ||
                      transceivers[0].sender?.track?.kind === 'video';
    const audioSecond = transceivers[1].receiver.track?.kind === 'audio' ||
                       transceivers[1].sender?.track?.kind === 'audio' ||
                       transceivers[1].direction === 'inactive';

    const orderValid = videoFirst && audioSecond;
    
    if (!orderValid) {
      console.error(`❌ [TRANSCEIVERS] Invalid transceiver order for ${participantId}:`, {
        transceiver0: {
          kind: transceivers[0].receiver.track?.kind || transceivers[0].sender?.track?.kind,
          direction: transceivers[0].direction
        },
        transceiver1: {
          kind: transceivers[1].receiver.track?.kind || transceivers[1].sender?.track?.kind,
          direction: transceivers[1].direction
        }
      });
    }

    return orderValid;
  }

  /**
   * Limpa transceivers de um participante
   */
  cleanup(participantId: string): void {
    this.transceivers.delete(participantId);
    console.log(`🧹 [TRANSCEIVERS] Cleaned up transceivers for ${participantId}`);
  }

  /**
   * Limpa todos os transceivers
   */
  cleanupAll(): void {
    this.transceivers.clear();
    console.log(`🧹 [TRANSCEIVERS] All transceivers cleaned up`);
  }

  /**
   * Debug: Lista estado de todos os transceivers
   */
  logTransceiverStates(): void {
    console.log(`📊 [TRANSCEIVERS] Current transceiver states:`);
    this.transceivers.forEach((setup, participantId) => {
      console.log(`  ${participantId}:`, {
        video: {
          direction: setup.video.direction,
          currentDirection: setup.video.currentDirection,
          hasSender: !!setup.video.sender,
          hasReceiver: !!setup.video.receiver
        },
        audio: setup.audio ? {
          direction: setup.audio.direction,
          currentDirection: setup.audio.currentDirection
        } : 'null'
      });
    });
  }
}

// Global instance
export const preAllocatedTransceivers = new PreAllocatedTransceivers();