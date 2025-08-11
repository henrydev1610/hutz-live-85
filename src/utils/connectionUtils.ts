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
 * FASE 1 & 2: CRITICAL URL SYNC - Get the backend base URL with production enforcement
 */
export const getBackendBaseURL = (): string => {
  // FASE 1: URL SYNC CRITICO - Verificar env primeiro
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 BACKEND URL SYNC: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  // FASE 1: CRITICAL FIX - ALWAYS map to server-hutz-live for backend
  if (host.includes('hutz-live-85.onrender.com') || host.includes('lovableproject.com')) {
    const backendUrl = 'https://server-hutz-live.onrender.com';
    console.log(`🌐 BACKEND URL SYNC: Production mapping - Frontend ${host} → Backend server-hutz-live.onrender.com`);
    console.log(`📋 URL MAPPING CRITICAL: ${host} → server-hutz-live.onrender.com`);
    return backendUrl;
  }
  
  // Local development environment
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
    const localPort = '3001';
    const backendUrl = `${protocol}//${host.split(':')[0]}:${localPort}`;
    console.log(`🏠 BACKEND URL SYNC: Local development detected: ${backendUrl}`);
    return backendUrl;
  }
  
  // Production environment fallback
  const backendUrl = `${protocol}//${host}`;
  console.log(`🌐 BACKEND URL SYNC: Production fallback: ${backendUrl}`);
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

  // FASE 1: CRITICAL - Use the EXACT same backend URL mapping
  const backendBaseUrl = getBackendBaseURL();
  const baseUrl = new URL(backendBaseUrl);
  
  // Convert HTTP(S) to WebSocket protocol
  const wsProtocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${baseUrl.host}`;
  
  console.log(`🔗 CONNECTION: WebSocket URL Sincronizado com backend: ${wsUrl}`);
  console.log(`📋 CONNECTION: Backend base: ${backendBaseUrl} → WebSocket: ${wsUrl}`);
  console.log(`🎯 URL VERIFICATION: Backend host: ${baseUrl.host}, Protocol: ${wsProtocol}`);
  
  cacheConnectionURL(wsUrl);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  const backendUrl = getBackendBaseURL();
  console.log(`📡 API: Using SYNCHRONIZED backend URL: ${backendUrl}`);
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
  
  const envInfo = {
    isLocalhost,
    isLovable,
    isRender,
    isSecure,
    protocol,
    host,
    wsProtocol: isSecure ? 'wss:' : 'ws:',
    apiBaseUrl: getApiBaseURL(),
    wsUrl: getWebSocketURL(),
    version: CONNECTION_VERSION,
    // FASE 5: Enhanced debug for URL sync
    urlMapping: {
      frontend: `${protocol}//${host}`,
      backend: getBackendBaseURL(),
      websocket: getWebSocketURL(),
      isURLSynced: getBackendBaseURL().includes('server-hutz-live.onrender.com')
    },
    // FASE 5: Mobile detection info
    mobileInfo: {
      isMobileUA: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      hasTouch: 'ontouchstart' in window,
      touchPoints: navigator.maxTouchPoints,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      accessedViaQR: sessionStorage.getItem('accessedViaQR') === 'true'
    }
  };

  console.log('🌍 ENVIRONMENT INFO ENHANCED:', envInfo);
  return envInfo;
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

// FASE 2: Enhanced URL consistency validation
export const validateURLConsistency = (): boolean => {
  const backendUrl = getBackendBaseURL();
  const wsUrl = getWebSocketURL();
  const apiUrl = getApiBaseURL();
  
  const backendHost = new URL(backendUrl).host;
  const wsHost = new URL(wsUrl).host;
  const apiHost = new URL(apiUrl).host;
  
  const isConsistent = backendHost === wsHost && wsHost === apiHost;
  
  // FASE 5: Enhanced consistency check with mobile context
  const currentHost = window.location.host;
  const expectedBackendHost = 'server-hutz-live.onrender.com';
  const isProperMapping = backendHost === expectedBackendHost;
  
  console.log('🔍 URL CONSISTENCY CHECK ENHANCED:', {
    currentFrontendHost: currentHost,
    backend: backendUrl,
    websocket: wsUrl,
    api: apiUrl,
    allHostsMatch: isConsistent,
    backendHost,
    wsHost,
    apiHost,
    expectedBackendHost,
    isProperMapping,
    hasMobileAccess: sessionStorage.getItem('accessedViaQR') === 'true',
    urlSyncStatus: isProperMapping ? '✅ SYNCED' : '⚠️ NOT_SYNCED'
  });
  
  return isConsistent && isProperMapping;
};

// FASE 5: Mobile network optimization
export const detectSlowNetwork = (): boolean => {
  // @ts-ignore - NetworkInformation API
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    const slowConnections = ['slow-2g', '2g', '3g'];
    const isSlowConnection = slowConnections.includes(connection.effectiveType);
    const isLowDownlink = connection.downlink < 1.5; // Less than 1.5 Mbps
    
    console.log(`📶 NETWORK DETECTION: Type: ${connection.effectiveType}, Downlink: ${connection.downlink}Mbps, Slow: ${isSlowConnection || isLowDownlink}`);
    
    return isSlowConnection || isLowDownlink;
  }
  
  return false; // Assume fast if can't detect
};

// Make available globally for debugging
(window as any).forceRefreshConnections = forceRefreshConnections;
(window as any).clearConnectionCache = clearConnectionCache;
(window as any).validateURLConsistency = validateURLConsistency;
(window as any).detectSlowNetwork = detectSlowNetwork;
