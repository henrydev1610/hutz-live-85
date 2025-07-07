/**
 * Utility functions for dynamic connection URL detection
 */

export const getWebSocketURL = (): string => {
  const { protocol, host } = window.location;
  
  console.log(`🔍 CONNECTION: Detecting environment - protocol: ${protocol}, host: ${host}`);
  
  // Development environment (localhost)
  if (host.includes('localhost')) {
    console.log('🏠 CONNECTION: Using localhost WebSocket URL');
    return 'http://localhost:3001';
  }
  
  // Lovable environment (specific detection)
  if (host.includes('lovableproject.com')) {
    const wsUrl = `wss://${host}`;
    console.log(`🌐 CONNECTION: Using Lovable WSS URL: ${wsUrl}`);
    return wsUrl;
  }
  
  // Other production/preview environments
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${host}`;
  console.log(`🔗 CONNECTION: Using generic WebSocket URL: ${wsUrl}`);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  const { protocol, host } = window.location;
  
  console.log(`📡 API: Detecting base URL - protocol: ${protocol}, host: ${host}`);
  
  // Development environment (localhost)
  if (host.includes('localhost')) {
    console.log('🏠 API: Using localhost API URL');
    return 'http://localhost:3001';
  }
  
  // Production/Preview environment (use current origin)
  const apiUrl = `${protocol}//${host}`;
  console.log(`🌐 API: Using production API URL: ${apiUrl}`);
  return apiUrl;
};

export const getEnvironmentInfo = () => {
  const { protocol, host } = window.location;
  const isLocalhost = host.includes('localhost');
  const isSecure = protocol === 'https:';
  
  return {
    isLocalhost,
    isSecure,
    protocol,
    host,
    wsProtocol: isSecure ? 'wss:' : 'ws:',
    apiBaseUrl: getApiBaseURL(),
    wsUrl: getWebSocketURL()
  };
};