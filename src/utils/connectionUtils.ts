
/**
 * Utility functions for dynamic connection URL detection with Railway support
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
 * RAILWAY MIGRATION: Enhanced URL detection with Railway support
 */
export const getBackendBaseURL = (): string => {
  // PRIORITY 1: Environment variable (highest priority)
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 BACKEND URL: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  // PRIORITY 2: Railway.app detection (NEW)
  if (host.includes('railway.app')) {
    const backendUrl = `https://${host.replace('frontend', 'backend')}`;
    console.log(`🚄 RAILWAY: Frontend ${host} → Backend ${backendUrl}`);
    return backendUrl;
  }
  
  // PRIORITY 3: Specific Railway domain mapping
  if (host.includes('your-frontend-domain.railway.app')) {
    const backendUrl = 'https://your-backend-domain.railway.app';
    console.log(`🚄 RAILWAY MAPPING: ${host} → your-backend-domain.railway.app`);
    return backendUrl;
  }
  
  // PRIORITY 4: Render.com (legacy support during migration)
  if (host.includes('hutz-live-85.onrender.com') || host.includes('lovableproject.com')) {
    const backendUrl = 'https://server-hutz-live.onrender.com';
    console.log(`🌐 RENDER LEGACY: ${host} → server-hutz-live.onrender.com`);
    return backendUrl;
  }
  
  // PRIORITY 5: Local development
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
    const localPort = '3001';
    const backendUrl = `${protocol}//${host.split(':')[0]}:${localPort}`;
    console.log(`🏠 LOCAL DEV: ${backendUrl}`);
    return backendUrl;
  }
  
  // PRIORITY 6: Production fallback
  const backendUrl = `${protocol}//${host}`;
  console.log(`🌐 FALLBACK: ${backendUrl}`);
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
        console.log(`🔧 WEBSOCKET: Using cached URL: ${url}`);
        return url;
      } else {
        console.log('🧹 WEBSOCKET: Cache expired or version mismatch, clearing');
        localStorage.removeItem('connectionCache');
      }
    } catch (error) {
      console.warn('⚠️ WEBSOCKET: Invalid cache data, clearing');
      localStorage.removeItem('connectionCache');
    }
  }

  // Get backend URL with Railway support
  const backendBaseUrl = getBackendBaseURL();
  const baseUrl = new URL(backendBaseUrl);
  
  // Convert HTTP(S) to WebSocket protocol
  const wsProtocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${baseUrl.host}`;
  
  console.log(`🔗 WEBSOCKET: URL synchronized with backend: ${wsUrl}`);
  console.log(`📋 WEBSOCKET: Backend base: ${backendBaseUrl} → WebSocket: ${wsUrl}`);
  
  // Railway-specific logging
  if (baseUrl.host.includes('railway.app')) {
    console.log(`🚄 RAILWAY WEBSOCKET: Optimized connection to ${wsUrl}`);
  }
  
  cacheConnectionURL(wsUrl);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  const backendUrl = getBackendBaseURL();
  console.log(`📡 API: Using backend URL: ${backendUrl}`);
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
  const isRender = host.includes('hutz-live-85.onrender.com') || host.includes('onrender.com');
  const isRailway = host.includes('railway.app');
  const isSecure = protocol === 'https:';
  
  const envInfo = {
    isLocalhost,
    isLovable,
    isRender,
    isRailway, // NEW: Railway detection
    isSecure,
    protocol,
    host,
    wsProtocol: isSecure ? 'wss:' : 'ws:',
    apiBaseUrl: getApiBaseURL(),
    wsUrl: getWebSocketURL(),
    version: CONNECTION_VERSION,
    // Enhanced URL mapping with Railway support
    urlMapping: {
      frontend: `${protocol}//${host}`,
      backend: getBackendBaseURL(),
      websocket: getWebSocketURL(),
      platform: isRailway ? 'railway' : isRender ? 'render' : isLovable ? 'lovable' : isLocalhost ? 'local' : 'unknown',
      isOptimized: isRailway || isLocalhost, // Railway and local are optimized
      isURLSynced: validateURLConsistency()
    },
    // Mobile detection info
    mobileInfo: {
      isMobileUA: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      hasTouch: 'ontouchstart' in window,
      touchPoints: navigator.maxTouchPoints,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      accessedViaQR: sessionStorage.getItem('accessedViaQR') === 'true'
    }
  };

  console.log('🌍 ENVIRONMENT INFO (Railway Enhanced):', envInfo);
  return envInfo;
};

// Force refresh connections with Railway awareness
export const forceRefreshConnections = (): void => {
  console.log('🔄 CONNECTION: Forcing refresh with Railway support');
  clearConnectionCache();
  
  const newWsUrl = getWebSocketURL();
  const newApiUrl = getApiBaseURL();
  const envInfo = getEnvironmentInfo();
  
  console.log('🔄 CONNECTION: New URLs:', { 
    websocket: newWsUrl, 
    api: newApiUrl,
    platform: envInfo.urlMapping.platform,
    optimized: envInfo.urlMapping.isOptimized
  });
};

// Enhanced URL consistency validation with Railway support
export const validateURLConsistency = (): boolean => {
  const backendUrl = getBackendBaseURL();
  const wsUrl = getWebSocketURL();
  const apiUrl = getApiBaseURL();
  
  const backendHost = new URL(backendUrl).host;
  const wsHost = new URL(wsUrl).host;
  const apiHost = new URL(apiUrl).host;
  
  const isConsistent = backendHost === wsHost && wsHost === apiHost;
  
  const currentHost = window.location.host;
  const isRailway = currentHost.includes('railway.app');
  const isRender = currentHost.includes('onrender.com');
  
  // Railway-specific validation
  const isRailwayMapping = isRailway && backendHost.includes('railway.app');
  const isRenderMapping = isRender && backendHost.includes('onrender.com');
  const isProperMapping = isRailwayMapping || isRenderMapping || currentHost.includes('localhost');
  
  console.log('🔍 URL CONSISTENCY CHECK (Railway Enhanced):', {
    currentFrontendHost: currentHost,
    backend: backendUrl,
    websocket: wsUrl,
    api: apiUrl,
    allHostsMatch: isConsistent,
    platform: isRailway ? 'railway' : isRender ? 'render' : 'other',
    isRailwayMapping,
    isRenderMapping,
    isProperMapping,
    hasMobileAccess: sessionStorage.getItem('accessedViaQR') === 'true',
    urlSyncStatus: isProperMapping ? '✅ SYNCED' : '⚠️ NOT_SYNCED'
  });
  
  return isConsistent && isProperMapping;
};

// Railway-optimized network detection
export const detectSlowNetwork = (): boolean => {
  // @ts-ignore - NetworkInformation API
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    const slowConnections = ['slow-2g', '2g', '3g'];
    const isSlowConnection = slowConnections.includes(connection.effectiveType);
    const isLowDownlink = connection.downlink < 1.5; // Less than 1.5 Mbps
    
    console.log(`📶 NETWORK DETECTION (Railway): Type: ${connection.effectiveType}, Downlink: ${connection.downlink}Mbps, Slow: ${isSlowConnection || isLowDownlink}`);
    
    return isSlowConnection || isLowDownlink;
  }
  
  return false; // Assume fast if can't detect
};

// Railway-specific connection test
export const testRailwayConnection = async (): Promise<boolean> => {
  const backendUrl = getBackendBaseURL();
  
  if (!backendUrl.includes('railway.app')) {
    console.log('🚄 RAILWAY TEST: Not a Railway URL, skipping test');
    return true;
  }
  
  try {
    console.log('🚄 RAILWAY TEST: Testing connection to', backendUrl);
    
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (response.ok) {
      const health = await response.json();
      console.log('🚄 RAILWAY TEST: Connection successful', health);
      return true;
    } else {
      console.error('🚄 RAILWAY TEST: Health check failed', response.status);
      return false;
    }
  } catch (error) {
    console.error('🚄 RAILWAY TEST: Connection failed', error);
    return false;
  }
};

// Make available globally for debugging
(window as any).forceRefreshConnections = forceRefreshConnections;
(window as any).clearConnectionCache = clearConnectionCache;
(window as any).validateURLConsistency = validateURLConsistency;
(window as any).detectSlowNetwork = detectSlowNetwork;
(window as any).testRailwayConnection = testRailwayConnection;
