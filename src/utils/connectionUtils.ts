
/**
 * Utility functions for dynamic connection URL detection with cache busting
 */

// Cache busting version
const CONNECTION_VERSION = Date.now().toString();

export const clearConnectionCache = (): void => {
  console.log('🧹 CONNECTION CACHE: Clearing all connection-related cache');
  localStorage.removeItem('connectionCache');
  localStorage.removeItem('lastConnectionCheck');
  sessionStorage.removeItem('accessedViaQR');
  sessionStorage.removeItem('currentSessionId');
  console.log('✅ CONNECTION CACHE: Cache cleared successfully');
};

/**
 * Get the backend base URL - should match the server that generated the QR code
 */
export const getBackendBaseURL = (): string => {
  // Use environment variable if defined
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 BACKEND: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  // Check if we're on the Render deployment URL (from QR code)
  if (host.includes('hutz-live-85.onrender.com')) {
    const backendUrl = `${protocol}//hutz-live-85.onrender.com`;
    console.log(`🌐 BACKEND: Render deployment detected: ${backendUrl}`);
    return backendUrl;
  }
  
  // Lovable environment detection
  if (host.includes('lovableproject.com')) {
    const backendUrl = `${protocol}//${host}`;
    console.log(`🌐 BACKEND: Lovable environment detected: ${backendUrl}`);
    return backendUrl;
  }
  
  // Local development environment
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
    const localPort = '3001';
    const backendUrl = `${protocol}//${host.split(':')[0]}:${localPort}`;
    console.log(`🏠 BACKEND: Local development detected: ${backendUrl}`);
    return backendUrl;
  }
  
  // Production environment fallback
  const backendUrl = `${protocol}//${host}`;
  console.log(`🌐 BACKEND: Production environment detected: ${backendUrl}`);
  return backendUrl;
};

export const getWebSocketURL = (): string => {
  // Check for cached URL first (with version check)
  const cachedData = localStorage.getItem('connectionCache');
  if (cachedData) {
    try {
      const { url, version, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > 30000; // 30 seconds cache
      
      if (!isExpired && version === CONNECTION_VERSION) {
        console.log(`🔧 CONNECTION: Using cached WebSocket URL: ${url}`);
        return url;
      } else {
        console.log('🧹 CONNECTION: Cache expired or version mismatch, clearing');
        localStorage.removeItem('connectionCache');
      }
    } catch (error) {
      console.warn('⚠️ CONNECTION: Invalid cache data, clearing');
      localStorage.removeItem('connectionCache');
    }
  }

  // CRITICAL: Use the same base URL as the backend that generated the QR code
  const backendBaseUrl = getBackendBaseURL();
  const baseUrl = new URL(backendBaseUrl);
  
  // Convert HTTP(S) to WebSocket protocol
  const wsProtocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${baseUrl.host}`;
  
  console.log(`🔗 CONNECTION: WebSocket URL synchronized with backend: ${wsUrl}`);
  console.log(`📋 CONNECTION: Backend base: ${backendBaseUrl} → WebSocket: ${wsUrl}`);
  
  cacheConnectionURL(wsUrl);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  const backendUrl = getBackendBaseURL();
  console.log(`📡 API: Using synchronized backend URL: ${backendUrl}`);
  return backendUrl;
};

const cacheConnectionURL = (url: string): void => {
  try {
    const cacheData = {
      url,
      version: CONNECTION_VERSION,
      timestamp: Date.now()
    };
    localStorage.setItem('connectionCache', JSON.stringify(cacheData));
    console.log(`💾 CONNECTION: Cached URL: ${url}`);
  } catch (error) {
    console.warn('⚠️ CONNECTION: Failed to cache URL:', error);
  }
};

export const getEnvironmentInfo = () => {
  const { protocol, host } = window.location;
  const isLocalhost = host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
  const isLovable = host.includes('lovableproject.com');
  const isRender = host.includes('hutz-live-85.onrender.com');
  const isSecure = protocol === 'https:';
  
  return {
    isLocalhost,
    isLovable,
    isRender,
    isSecure,
    protocol,
    host,
    wsProtocol: isSecure ? 'wss:' : 'ws:',
    apiBaseUrl: getApiBaseURL(),
    wsUrl: getWebSocketURL(),
    version: CONNECTION_VERSION
  };
};

// Force refresh connections (for debugging)
export const forceRefreshConnections = (): void => {
  console.log('🔄 CONNECTION: Forcing connection refresh with URL sync');
  clearConnectionCache();
  // Trigger re-detection with backend sync
  const newWsUrl = getWebSocketURL();
  const newApiUrl = getApiBaseURL();
  console.log('🔄 CONNECTION: New URLs - WebSocket:', newWsUrl, 'API:', newApiUrl);
};

// Validate URL consistency (debugging function)
export const validateURLConsistency = (): boolean => {
  const backendUrl = getBackendBaseURL();
  const wsUrl = getWebSocketURL();
  const apiUrl = getApiBaseURL();
  
  const backendHost = new URL(backendUrl).host;
  const wsHost = new URL(wsUrl).host;
  const apiHost = new URL(apiUrl).host;
  
  const isConsistent = backendHost === wsHost && wsHost === apiHost;
  
  console.log('🔍 URL CONSISTENCY CHECK:', {
    backend: backendUrl,
    websocket: wsUrl,
    api: apiUrl,
    allHostsMatch: isConsistent,
    backendHost,
    wsHost,
    apiHost
  });
  
  return isConsistent;
};

// Make available globally for debugging
(window as any).forceRefreshConnections = forceRefreshConnections;
(window as any).clearConnectionCache = clearConnectionCache;
(window as any).validateURLConsistency = validateURLConsistency;
