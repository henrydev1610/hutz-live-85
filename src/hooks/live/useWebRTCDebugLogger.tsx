import { useEffect } from 'react';

export const useWebRTCDebugLogger = () => {
  useEffect(() => {
    console.log('🔍 WEBRTC DEBUG LOGGER: Iniciando monitoramento WebRTC');
    
    // Monitor de eventos WebRTC globais
    const monitorWebRTCEvents = () => {
      console.log('📊 WEBRTC DEBUG LOGGER: ===== STATUS GLOBAL WEBRTC =====');
      console.log('📊 WEBRTC DEBUG LOGGER: Timestamp:', new Date().toISOString());
      
      // Verificar se RTCPeerConnection está disponível
      console.log('📊 WEBRTC DEBUG LOGGER: RTCPeerConnection disponível:', typeof RTCPeerConnection !== 'undefined');
      
      // Verificar getUserMedia
      console.log('📊 WEBRTC DEBUG LOGGER: getUserMedia disponível:', !!navigator.mediaDevices?.getUserMedia);
      
      // Verificar WebSocket
      console.log('📊 WEBRTC DEBUG LOGGER: WebSocket disponível:', typeof WebSocket !== 'undefined');
      
      // Monitor de performance
      const performanceEntries = performance.getEntriesByType('measure');
      console.log('📊 WEBRTC DEBUG LOGGER: Performance measures:', performanceEntries.length);
    };
    
    // Log inicial
    monitorWebRTCEvents();
    
    // Monitor periódico
    const interval = setInterval(monitorWebRTCEvents, 30000); // A cada 30 segundos
    
    // Monitor de eventos de rede
    window.addEventListener('online', () => {
      console.log('🌐 WEBRTC DEBUG LOGGER: Conexão online detectada');
    });
    
    window.addEventListener('offline', () => {
      console.log('🌐 WEBRTC DEBUG LOGGER: Conexão offline detectada');
    });
    
    // Monitor de erros não capturados
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('webrtc') || event.message?.includes('WebRTC') || 
          event.message?.includes('peer') || event.message?.includes('ICE')) {
        console.error('❌ WEBRTC DEBUG LOGGER: Erro WebRTC não capturado:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      }
    };
    
    window.addEventListener('error', handleError);
    
    // Monitor de promises rejeitadas
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString?.() || event.reason;
      if (typeof reason === 'string' && 
          (reason.includes('webrtc') || reason.includes('WebRTC') || 
           reason.includes('peer') || reason.includes('ICE'))) {
        console.error('❌ WEBRTC DEBUG LOGGER: Promise WebRTC rejeitada:', {
          reason: event.reason,
          stack: event.reason?.stack
        });
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      console.log('🧹 WEBRTC DEBUG LOGGER: Parando monitoramento WebRTC');
      clearInterval(interval);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Função para debug manual
  const debugCurrentState = () => {
    console.log('🔍 WEBRTC DEBUG LOGGER: ===== DEBUG MANUAL =====');
    console.log('🔍 WEBRTC DEBUG LOGGER: Navigator userAgent:', navigator.userAgent);
    console.log('🔍 WEBRTC DEBUG LOGGER: Location:', window.location.href);
    console.log('🔍 WEBRTC DEBUG LOGGER: Connection type:', (navigator as any).connection?.effectiveType || 'unknown');
    
    // Verificar localStorage/sessionStorage para dados WebRTC
    try {
      const storageKeys = Object.keys(localStorage).filter(key => 
        key.includes('webrtc') || key.includes('stream') || key.includes('peer')
      );
      console.log('🔍 WEBRTC DEBUG LOGGER: Storage keys relacionados:', storageKeys);
    } catch (e) {
      console.log('🔍 WEBRTC DEBUG LOGGER: Erro ao acessar localStorage:', e);
    }
  };
  
  return { debugCurrentState };
};