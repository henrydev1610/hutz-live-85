// Monitoramento contínuo do contador de streams ativos
class StreamCountMonitor {
  private lastKnownCount = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  startMonitoring() {
    console.log('🔍 [STREAM-MONITOR] Iniciando monitoramento do contador de streams');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.checkStreamCount();
    }, 2000); // Check every 2 seconds
    
    // Initial check
    this.checkStreamCount();
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  private checkStreamCount() {
    try {
      // Get current DOM elements with streams
      const videoElements = document.querySelectorAll('video[srcObject]');
      const streamContainers = document.querySelectorAll('[data-participant-id]');
      const activeStreamElements = Array.from(videoElements).filter(video => {
        const videoEl = video as HTMLVideoElement;
        return videoEl.srcObject && (videoEl.srcObject as MediaStream).active;
      });
      
      // Get active streams count from UI
      const streamCountElement = document.getElementById('active-streams-count');
      const displayedCount = streamCountElement ? parseInt(streamCountElement.textContent || '0') : 0;
      
      console.log('🔍 [STREAM-MONITOR] Contagem atual:', {
        displayedCount,
        videoElementsWithSrc: videoElements.length,
        activeStreamElements: activeStreamElements.length,
        streamContainers: streamContainers.length,
        lastKnownCount: this.lastKnownCount,
        timestamp: new Date().toISOString()
      });
      
      // Check for discrepancies
      if (activeStreamElements.length > 0 && displayedCount === 0) {
        console.warn('🚨 [STREAM-MONITOR] DISCREPÂNCIA DETECTADA: Há elementos de vídeo ativos mas contador mostra 0');
        this.triggerStreamRefresh();
      }
      
      this.lastKnownCount = displayedCount;
      
    } catch (error) {
      console.error('❌ [STREAM-MONITOR] Erro durante verificação:', error);
    }
  }
  
  private triggerStreamRefresh() {
    console.log('🔄 [STREAM-MONITOR] Disparando refresh forçado do contador de streams');
    
    // Dispatch events to trigger refresh
    window.dispatchEvent(new CustomEvent('force-streams-refresh'));
    window.dispatchEvent(new CustomEvent('streams-updated', {
      detail: { source: 'monitor', timestamp: Date.now() }
    }));
    
    // Force check of participant streams from global state
    if ((window as any).__livePageDebug) {
      const debugInfo = (window as any).__livePageDebug.getStreamInfo();
      console.log('🔍 [STREAM-MONITOR] Estado global dos streams:', debugInfo);
    }
  }
  
  forceRefresh() {
    console.log('🔄 [STREAM-MONITOR] Refresh manual solicitado');
    this.triggerStreamRefresh();
  }
}

// Global instance
export const streamCountMonitor = new StreamCountMonitor();

// Expose global debug function
if (typeof window !== 'undefined') {
  (window as any).__streamMonitor = {
    start: () => streamCountMonitor.startMonitoring(),
    stop: () => streamCountMonitor.stopMonitoring(),
    forceRefresh: () => streamCountMonitor.forceRefresh(),
    getCurrentInfo: () => {
      const videoElements = document.querySelectorAll('video[srcObject]');
      const activeElements = Array.from(videoElements).filter(video => {
        const videoEl = video as HTMLVideoElement;
        return videoEl.srcObject && (videoEl.srcObject as MediaStream).active;
      });
      
      return {
        videoElements: videoElements.length,
        activeElements: activeElements.length,
        displayedCount: document.getElementById('active-streams-count')?.textContent || '0'
      };
    }
  };
  
  console.log('🔍 [STREAM-MONITOR] Monitor exposto globalmente em window.__streamMonitor');
}