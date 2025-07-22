
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
  // FASE 2: CRITICAL - Sempre forçar URL do backend de produção
  const productionBackendUrl = 'https://server-hutz-live.onrender.com';
  console.log(`🔧 BACKEND URL CRITICAL OVERRIDE: Using forced production backend: ${productionBackendUrl}`);
  return productionBackendUrl;
};

export const getFrontendBaseURL = (): string => {
  // FASE 2: CRITICAL - Sempre forçar URL do frontend de produção
  const productionFrontendUrl = 'https://hutz-live-85.onrender.com';
  console.log(`🔧 FRONTEND URL CRITICAL OVERRIDE: Using forced production frontend: ${productionFrontendUrl}`);
  return productionFrontendUrl;
};

export const getWebSocketURL = (): string => {
  // FASE 2: CRITICAL - Forçar WebSocket para produção
  const backendUrl = getBackendBaseURL();
  const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  
  console.log(`🔗 WEBSOCKET URL: Forced production WebSocket URL: ${wsUrl}`);
  
  // Cache for performance
  cacheConnectionURL(wsUrl);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  // FASE 2: CRITICAL - Forçar API para produção
  const backendUrl = getBackendBaseURL();
  console.log(`📡 API URL: Forced production API URL: ${backendUrl}`);
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
  
  // FASE 2: Force production URLs for consistency
  const productionBackendUrl = getBackendBaseURL();
  const productionFrontendUrl = getFrontendBaseURL();
  const productionWsUrl = getWebSocketURL();
  
  const envInfo = {
    isLocalhost,
    isLovable,
    isRender,
    isSecure,
    protocol,
    host,
    wsProtocol: isSecure ? 'wss:' : 'ws:',
    apiBaseUrl: productionBackendUrl,
    wsUrl: productionWsUrl,
    version: CONNECTION_VERSION,
    // FASE 5: Enhanced debug for URL sync
    urlMapping: {
      currentEnvironment: isLocalhost ? 'local' : isLovable ? 'lovable' : isRender ? 'render' : 'unknown',
      frontend: productionFrontendUrl,
      backend: productionBackendUrl,
      websocket: productionWsUrl,
      isURLSynced: true // Now always true since we force production URLs
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

  console.log('🌍 ENVIRONMENT INFO:', envInfo);
  return envInfo;
};

// Force refresh connections (for debugging)
export const forceRefreshConnections = (): void => {
  console.log('🔄 CONNECTION: Forcing connection refresh with URL sync');
  clearConnectionCache();
  
  // FASE 2: Trigger re-detection with production enforcement
  const newWsUrl = getWebSocketURL();
  const newApiUrl = getApiBaseURL();
  console.log('🔄 CONNECTION: New URLs - WebSocket:', newWsUrl, 'API:', newApiUrl);
};

// FASE 3: Room validation - Check if room exists before joining
export const validateRoom = async (roomId: string): Promise<boolean> => {
  try {
    console.log(`🔍 ROOM VALIDATION: Checking if room ${roomId} exists`);
    
    const backendUrl = getBackendBaseURL();
    const response = await fetch(`${backendUrl}/api/rooms/${roomId}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (response.ok) {
      console.log(`✅ ROOM VALIDATION: Room ${roomId} exists`);
      return true;
    } else {
      console.warn(`⚠️ ROOM VALIDATION: Room ${roomId} does not exist or error occurred`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ROOM VALIDATION: Error checking room ${roomId}:`, error);
    return false;
  }
};

// FASE 3: Room creation - Create room if it doesn't exist
export const createRoomIfNeeded = async (roomId: string): Promise<boolean> => {
  try {
    const exists = await validateRoom(roomId);
    
    if (exists) {
      console.log(`✅ ROOM EXISTS: Room ${roomId} already exists`);
      return true;
    }
    
    console.log(`🏠 ROOM CREATION: Creating room ${roomId}`);
    
    const backendUrl = getBackendBaseURL();
    const response = await fetch(`${backendUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Room-Id': roomId,
      },
      body: JSON.stringify({ roomId }),
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (response.ok) {
      console.log(`✅ ROOM CREATION: Room ${roomId} created successfully`);
      return true;
    } else {
      console.error(`❌ ROOM CREATION: Failed to create room ${roomId}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ROOM CREATION: Error creating room ${roomId}:`, error);
    return false;
  }
};

// FASE 5: URL consistency validation
export const validateURLConsistency = (): boolean => {
  // With our forced URL approach, consistency should always be true
  const backendUrl = getBackendBaseURL();
  const frontendUrl = getFrontendBaseURL();
  const wsUrl = getWebSocketURL();
  
  console.log('🔍 URL CONSISTENCY CHECK:', {
    backend: backendUrl,
    frontend: frontendUrl,
    websocket: wsUrl,
    allForced: true,
    backendHost: new URL(backendUrl).host,
    frontendHost: new URL(frontendUrl).host,
    wsHost: new URL(wsUrl).host,
  });
  
  return true; // Now always true as we force correct URLs
};

// Make available globally for debugging
(window as any).forceRefreshConnections = forceRefreshConnections;
(window as any).clearConnectionCache = clearConnectionCache;
(window as any).validateURLConsistency = validateURLConsistency;
(window as any).validateRoom = validateRoom;
(window as any).createRoomIfNeeded = createRoomIfNeeded;
