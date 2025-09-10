interface MutedTrackStatus {
  trackId: string;
  kind: string;
  isMuted: boolean;
  readyState: RTCDataChannelState;
  enabled: boolean;
  isValidForWebRTC: boolean;
}

interface MutedTrackConfig {
  unmutedTimeout: number;
  maxRetryAttempts: number;
  retryInterval: number;
}

interface TrackAttachmentRecord {
  trackId: string;
  isAttached: boolean;
  attachmentTimestamp: number;
}

export class MutedTrackHandler {
  private mutedTracks = new Map<string, MutedTrackStatus>();
  private attachedTracks = new Set<string>();
  private timeouts = new Map<string, NodeJS.Timeout>();
  private config: MutedTrackConfig;

  constructor(config?: Partial<MutedTrackConfig>) {
    this.config = {
      unmutedTimeout: 2000,
      maxRetryAttempts: 3,
      retryInterval: 1000,
      ...config
    };
  }

  async handleMutedTrack(track: MediaStreamTrack, participantId: string): Promise<{ success: boolean; track: MediaStreamTrack; wasMuted: boolean }> {
    const wasMuted = track.muted;
    
    if (!wasMuted) {
      console.log(`[MutedTrackHandler] Track ${track.id} (${track.kind}) já está unmuted`);
      return { success: true, track, wasMuted: false };
    }

    console.log(`[MutedTrackHandler] Processando track muted: ${track.id} (${track.kind})`);
    
    // Registrar status da track
    this.registerMutedTrack(track, participantId);
    
    // Tentar unmute inteligente
    const result = await this.attemptSmartUnmute(track, participantId);
    
    return { 
      success: result.success, 
      track: result.track, 
      wasMuted 
    };
  }

  private async attemptSmartUnmute(track: MediaStreamTrack, participantId: string): Promise<{ success: boolean; track: MediaStreamTrack }> {
    console.log(`[MutedTrackHandler] Iniciando smart unmute para track ${track.id}`);
    
    // 1. Aguardar auto-unmute do navegador
    const autoUnmuted = await this.waitForAutoUnmute(track);
    if (autoUnmuted) {
      console.log(`[MutedTrackHandler] ✅ Track ${track.id} unmuted automaticamente pelo navegador`);
      return { success: true, track };
    }
    
    // 2. Tentar unmute programático
    const programmaticUnmuted = await this.attemptProgrammaticUnmute(track);
    if (programmaticUnmuted) {
      console.log(`[MutedTrackHandler] ✅ Track ${track.id} unmuted programaticamente`);
      return { success: true, track };
    }
    
    // 3. Verificar se track ainda é válida para WebRTC
    const isValid = this.isTrackValidForWebRTC(track);
    if (isValid) {
      console.log(`[MutedTrackHandler] ⚠️ Track ${track.id} permanece muted mas é válida para WebRTC`);
      return { success: true, track };
    }
    
    console.log(`[MutedTrackHandler] ❌ Track ${track.id} não pôde ser recuperada`);
    return { success: false, track };
  }

  private waitForAutoUnmute(track: MediaStreamTrack): Promise<boolean> {
    return new Promise((resolve) => {
      if (!track.muted) {
        resolve(true);
        return;
      }

      const timeoutId = setTimeout(() => {
        track.removeEventListener('unmute', onUnmute);
        resolve(false);
      }, this.config.unmutedTimeout);

      const onUnmute = () => {
        clearTimeout(timeoutId);
        console.log(`[MutedTrackHandler] Track ${track.id} recebeu evento unmute`);
        resolve(true);
      };

      track.addEventListener('unmute', onUnmute, { once: true });
    });
  }

  private async attemptProgrammaticUnmute(track: MediaStreamTrack): Promise<boolean> {
    if (!track.muted) return true;
    
    console.log(`[MutedTrackHandler] Tentando unmute programático para track ${track.id}`);
    
    try {
      // Force toggle para tentar desbloquear
      track.enabled = false;
      await new Promise(resolve => setTimeout(resolve, 50));
      track.enabled = true;
      
      // Aguardar um pouco para o navegador processar
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const isUnmuted = !track.muted;
      if (isUnmuted) {
        console.log(`[MutedTrackHandler] ✅ Force toggle funcionou para track ${track.id}`);
      }
      
      return isUnmuted;
    } catch (error) {
      console.error(`[MutedTrackHandler] Erro no unmute programático:`, error);
      return false;
    }
  }

  private isTrackValidForWebRTC(track: MediaStreamTrack): boolean {
    return track.readyState === 'live' && track.enabled;
  }

  private registerMutedTrack(track: MediaStreamTrack, participantId: string): void {
    const status: MutedTrackStatus = {
      trackId: track.id,
      kind: track.kind,
      isMuted: track.muted,
      readyState: track.readyState as RTCDataChannelState,
      enabled: track.enabled,
      isValidForWebRTC: this.isTrackValidForWebRTC(track)
    };

    this.mutedTracks.set(track.id, status);
    this.setupTrackEventListeners(track, participantId);
  }

  private setupTrackEventListeners(track: MediaStreamTrack, participantId: string): void {
    const handleUnmute = () => {
      console.log(`[MutedTrackHandler] ✅ Track ${track.id} foi unmuted`);
      const status = this.mutedTracks.get(track.id);
      if (status) {
        status.isMuted = false;
        status.isValidForWebRTC = this.isTrackValidForWebRTC(track);
      }
    };

    const handleMute = () => {
      console.log(`[MutedTrackHandler] ⚠️ Track ${track.id} foi muted novamente`);
      const status = this.mutedTracks.get(track.id);
      if (status) {
        status.isMuted = true;
        status.isValidForWebRTC = this.isTrackValidForWebRTC(track);
      }
    };

    const handleEnded = () => {
      console.log(`[MutedTrackHandler] ❌ Track ${track.id} foi finalizada`);
      this.cleanup(track.id);
    };

    track.addEventListener('unmute', handleUnmute);
    track.addEventListener('mute', handleMute);
    track.addEventListener('ended', handleEnded);
  }

  // Gerenciamento de anexação de tracks para evitar duplicatas
  isTrackAttached(trackId: string): boolean {
    return this.attachedTracks.has(trackId);
  }

  markTrackAsAttached(trackId: string): void {
    this.attachedTracks.add(trackId);
    console.log(`[MutedTrackHandler] Track ${trackId} marcada como anexada ao PeerConnection`);
  }

  unmarkTrackAsAttached(trackId: string): void {
    this.attachedTracks.delete(trackId);
    console.log(`[MutedTrackHandler] Track ${trackId} removida do registro de anexação`);
  }

  getMutedTracksStatus(): Map<string, MutedTrackStatus> {
    return new Map(this.mutedTracks);
  }

  hasRecoverableMutedTracks(): boolean {
    return Array.from(this.mutedTracks.values()).some(status => 
      status.isMuted && status.isValidForWebRTC
    );
  }

  private cleanup(trackId: string): void {
    const timeout = this.timeouts.get(trackId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(trackId);
    }
    
    this.mutedTracks.delete(trackId);
    this.attachedTracks.delete(trackId);
  }

  destroy(): void {
    // Limpar todos os timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Limpar todos os registros
    this.mutedTracks.clear();
    this.attachedTracks.clear();
    
    console.log(`[MutedTrackHandler] Handler destruído e recursos limpos`);
  }
}