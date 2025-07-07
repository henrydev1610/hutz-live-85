/**
 * Utility functions for dynamic connection URL detection
 */

export const getWebSocketURL = (): string => {
  const { protocol, host } = window.location;
  
  console.log(`🔍 CONNECTION: Detecting environment - protocol: ${protocol}, host: ${host}`);
  
  // Development environment (localhost ou IP local)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230'; // IP da rede local detectado pelo Vite
    console.log(`🏠 CONNECTION: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
  }
  
  // Ngrok environment (specific detection) - use same origin with backend port
  if (host.includes('ngrok-free.app') || host.includes('ngrok.io')) {
    // Try to connect to backend through ngrok (assuming backend is also tunneled)
    const backendHost = host.replace('88099e135c0d', 'BACKEND_TUNNEL_ID'); // User needs to update this
    const wsUrl = `https://${backendHost}`;
    console.log(`🌐 CONNECTION: Using Ngrok backend URL: ${wsUrl}`);
    
    // Fallback: if backend not tunneled, use local connection
    // Comment: User should run 'ngrok http 3001' for backend and update BACKEND_TUNNEL_ID above
    console.log(`⚠️  NGROK: For full functionality, tunnel backend with 'ngrok http 3001'`);
    return wsUrl;
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
  
  // Development environment (localhost ou IP local)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230'; // IP da rede local detectado pelo Vite
    console.log(`🏠 API: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
  }
  
  // Ngrok environment - use current origin for API
  if (host.includes('ngrok-free.app') || host.includes('ngrok.io')) {
    const apiUrl = `${protocol}//${host}`;
    console.log(`🌐 API: Using Ngrok API URL: ${apiUrl}`);
    return apiUrl;
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