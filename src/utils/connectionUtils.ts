/**
 * Utility functions for dynamic connection URL detection
 */

export const getWebSocketURL = (): string => {
  // Use variável de ambiente se definida
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 CONNECTION: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  console.log(`🔍 CONNECTION: Detecting environment - protocol: ${protocol}, host: ${host}`);
  
  // Development environment (localhost ou IP local)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230'; // IP da rede local detectado pelo Vite
    console.log(`🏠 CONNECTION: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
  }
  
  // Lovable environment (specific detection)
  if (host.includes('lovableproject.com')) {
    const wsUrl = `wss://${host}`;
    console.log(`🌐 CONNECTION: Using Lovable WSS URL: ${wsUrl}`);
    return wsUrl;
  }
  
  // Production/staging environments with fallback logic
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  let wsUrl = `${wsProtocol}//${host}`;
  
  // Add fallback ports for different environments
  if (protocol === 'https:' && !host.includes(':')) {
    wsUrl = `${wsProtocol}//${host}:443`;
  } else if (protocol === 'http:' && !host.includes(':')) {
    wsUrl = `${wsProtocol}//${host}:3001`;
  }
  
  console.log(`🔗 CONNECTION: Using WebSocket URL: ${wsUrl}`);
  return wsUrl;
};

export const getApiBaseURL = (): string => {
  // Use variável de ambiente se definida
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  if (envApiUrl) {
    console.log(`🔧 API: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }

  const { protocol, host } = window.location;
  
  console.log(`📡 API: Detecting base URL - protocol: ${protocol}, host: ${host}`);
  
  // Development environment (localhost ou IP local)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230'; // IP da rede local detectado pelo Vite
    console.log(`🏠 API: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
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