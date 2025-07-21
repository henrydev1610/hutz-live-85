
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

export const getWebSocketURL = (): string => {
  // Check for cached URL first (with version check)
  const cachedData = localStorage.getItem('connectionCache');
  if (cachedData) {
    try {
      const { url, version, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > 30000; // 30 seconds cache
      
      if (!isExpired && version === CONNECTION_VERSION) {
        console.log(`🔧 CONNECTION: Using cached URL: ${url}`);
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

  // Use environment variable if defined
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 CONNECTION: Using environment API URL: ${envApiUrl}`);
    cacheConnectionURL(envApiUrl);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  console.log(`🔍 CONNECTION: Auto-detecting environment - protocol: ${protocol}, host: ${host}`);
  
  let detectedURL = '';
  
  // Lovable environment detection (most specific first)
  if (host.includes('lovableproject.com')) {
    detectedURL = `wss://${host}`;
    console.log(`🌐 CONNECTION: Lovable environment detected: ${detectedURL}`);
  }
  // Local development environment
  else if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
    // For local development, try to detect the actual server
    const localPort = '3001';
    detectedURL = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host.split(':')[0]}:${localPort}`;
    console.log(`🏠 CONNECTION: Local development detected: ${detectedURL}`);
  }
  // Production environment
  else {
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    detectedURL = `${wsProtocol}//${host}`;
    console.log(`🌐 CONNECTION: Production environment detected: ${detectedURL}`);
  }
  
  cacheConnectionURL(detectedURL);
  return detectedURL;
};

export const getApiBaseURL = (): string => {
  // Use environment variable if defined
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 API: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  console.log(`📡 API: Auto-detecting base URL - protocol: ${protocol}, host: ${host}`);
  
  // Lovable environment
  if (host.includes('lovableproject.com')) {
    const apiUrl = `${protocol}//${host}`;
    console.log(`🌐 API: Lovable API URL: ${apiUrl}`);
    return apiUrl;
  }
  
  // Local development
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
    const localPort = '3001';
    const apiUrl = `${protocol}//${host.split(':')[0]}:${localPort}`;
    console.log(`🏠 API: Local development API URL: ${apiUrl}`);
    return apiUrl;
  }
  
  // Production environment
  const apiUrl = `${protocol}//${host}`;
  console.log(`🌐 API: Production API URL: ${apiUrl}`);
  return apiUrl;
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
  const isSecure = protocol === 'https:';
  
  return {
    isLocalhost,
    isLovable,
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
  console.log('🔄 CONNECTION: Forcing connection refresh');
  clearConnectionCache();
  // Trigger re-detection
  getWebSocketURL();
  getApiBaseURL();
};

// Make available globally for debugging
(window as any).forceRefreshConnections = forceRefreshConnections;
(window as any).clearConnectionCache = clearConnectionCache;
