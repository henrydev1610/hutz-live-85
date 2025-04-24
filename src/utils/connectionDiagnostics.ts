
import { createLogger } from './loggingUtils';

const logger = createLogger('diagnostics');

/**
 * Comprehensive connection diagnostics for WebRTC
 */
export const diagnoseConnection = async (sessionId: string, participantId: string): Promise<any> => {
  logger.info(`Running connection diagnostics for session ${sessionId}, participant ${participantId}`);
  
  const result = {
    timestamp: Date.now(),
    participantId,
    sessionId,
    browserInfo: getBrowserInfo(),
    networkInfo: await getNetworkInfo(),
    webrtcSupport: checkWebRTCSupport(),
    connectionState: {},
    streamInfo: {}
  };
  
  // Broadcast diagnostic information
  try {
    const channel = new BroadcastChannel(`diagnostic-${sessionId}`);
    channel.postMessage({
      type: 'connection-diagnostics',
      participantId,
      deviceInfo: result.browserInfo,
      networkInfo: result.networkInfo,
      webrtcSupport: result.webrtcSupport,
      timestamp: Date.now()
    });
    setTimeout(() => channel.close(), 500);
    
    // Also store in localStorage for browsers without BroadcastChannel
    try {
      const key = `diagnostic-${sessionId}-${participantId}-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify({
        type: 'connection-diagnostics',
        participantId,
        deviceInfo: result.browserInfo,
        networkInfo: result.networkInfo,
        webrtcSupport: result.webrtcSupport,
        timestamp: Date.now()
      }));
      setTimeout(() => localStorage.removeItem(key), 10000);
    } catch (e) {
      logger.warn("Error storing diagnostics in localStorage:", e);
    }
  } catch (e) {
    logger.error("Error broadcasting diagnostics:", e);
  }
  
  return result;
};

/**
 * Tests broadcast channel reception
 */
export const testBroadcastReception = async (
  sessionId: string, 
  participantId: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let received = false;
      let timeoutId: number;
      
      // Set up response listener
      try {
        const responseChannel = new BroadcastChannel(`response-${sessionId}`);
        responseChannel.onmessage = (event) => {
          const { data } = event;
          if (data.testId === testId) {
            received = true;
            if (timeoutId) clearTimeout(timeoutId);
            responseChannel.close();
            resolve(true);
          }
        };
        
        // Set timeout to close channel
        timeoutId = window.setTimeout(() => {
          responseChannel.close();
          resolve(received);
        }, 5000);
      } catch (e) {
        logger.error("Error setting up response channel:", e);
        resolve(false);
        return;
      }
      
      // Send test message
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'connection-test',
          id: participantId,
          testId,
          timestamp: Date.now()
        });
        setTimeout(() => channel.close(), 500);
      } catch (e) {
        logger.error("Error sending test message:", e);
        resolve(false);
      }
    } catch (e) {
      logger.error("Error in broadcast reception test:", e);
      resolve(false);
    }
  });
};

/**
 * Gets browser and device information
 */
const getBrowserInfo = (): any => {
  const ua = navigator.userAgent;
  const browserInfo: any = {
    userAgent: ua,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
  };
  
  // Detect browser type
  if (/Firefox\/\d+/.test(ua)) {
    browserInfo.browser = 'firefox';
    browserInfo.browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || 'unknown';
  } else if (/Edg\/\d+/.test(ua) || /Edge\/\d+/.test(ua)) {
    browserInfo.browser = 'edge';
    browserInfo.browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || ua.match(/Edge\/(\d+)/)?.[1] || 'unknown';
  } else if (/Chrome\/\d+/.test(ua)) {
    browserInfo.browser = 'chrome';
    browserInfo.browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
  } else if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua) && !/Chromium\/\d+/.test(ua)) {
    browserInfo.browser = 'safari';
    browserInfo.browserVersion = ua.match(/Version\/(\d+)/)?.[1] || 'unknown';
  } else if (/OPR\/\d+/.test(ua) || /Opera\/\d+/.test(ua)) {
    browserInfo.browser = 'opera';
    browserInfo.browserVersion = ua.match(/OPR\/(\d+)/)?.[1] || ua.match(/Opera\/(\d+)/)?.[1] || 'unknown';
  } else {
    browserInfo.browser = 'unknown';
  }
  
  // Detect OS
  if (/Windows/.test(ua)) {
    browserInfo.os = 'windows';
  } else if (/Macintosh/.test(ua)) {
    browserInfo.os = 'mac';
  } else if (/Linux/.test(ua)) {
    browserInfo.os = 'linux';
  } else if (/Android/.test(ua)) {
    browserInfo.os = 'android';
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    browserInfo.os = 'ios';
  } else {
    browserInfo.os = 'unknown';
  }
  
  // Detect if mobile
  browserInfo.isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  
  return browserInfo;
};

/**
 * Gets network information if available
 */
const getNetworkInfo = async (): Promise<any> => {
  const networkInfo: any = {
    online: navigator.onLine
  };
  
  // Use Network Information API if available
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      networkInfo.effectiveType = conn.effectiveType;
      networkInfo.downlink = conn.downlink;
      networkInfo.rtt = conn.rtt;
      networkInfo.saveData = conn.saveData;
    }
  }
  
  // Test actual latency
  try {
    const latency = await measureLatency();
    networkInfo.measuredLatency = latency;
  } catch (e) {
    networkInfo.measuredLatency = null;
  }
  
  return networkInfo;
};

/**
 * Measures network latency
 */
const measureLatency = async (): Promise<number> => {
  const start = performance.now();
  
  try {
    // Send a tiny request to measure latency
    await fetch('https://www.google.com/favicon.ico', { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    
    return performance.now() - start;
  } catch (e) {
    // If direct fetch fails, try image load as fallback
    return new Promise((resolve, reject) => {
      const img = new Image();
      const startTime = performance.now();
      
      img.onload = () => resolve(performance.now() - startTime);
      img.onerror = reject;
      
      img.src = 'https://www.google.com/favicon.ico?' + new Date().getTime();
    });
  }
};

/**
 * Checks WebRTC support in the browser
 */
const checkWebRTCSupport = (): any => {
  const support = {
    rtcPeerConnection: !!window.RTCPeerConnection,
    mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    screenSharing: !!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices),
    webrtcStats: !!(window.RTCPeerConnection && 'getStats' in RTCPeerConnection.prototype),
    broadcastChannel: typeof BroadcastChannel !== 'undefined',
    h264: false,
    vp8: false,
    vp9: false
  };
  
  // Check codec support if applicable
  if (window.RTCRtpSender && RTCRtpSender.getCapabilities) {
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (capabilities && capabilities.codecs) {
        support.h264 = capabilities.codecs.some(c => c.mimeType.toLowerCase() === 'video/h264');
        support.vp8 = capabilities.codecs.some(c => c.mimeType.toLowerCase() === 'video/vp8');
        support.vp9 = capabilities.codecs.some(c => c.mimeType.toLowerCase() === 'video/vp9');
      }
    } catch (e) {
      logger.error("Error checking codec support:", e);
    }
  }
  
  // Check existing stream
  if ('MediaStream' in window) {
    support.mediaStream = true;
  }
  
  return support;
};
