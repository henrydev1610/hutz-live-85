/**
 * Utility functions for dynamic connection URL detection
 */

export const getWebSocketURL = (): string => {
  const { protocol, host } = window.location;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  console.log(`🔍 CONNECTION: Mobile detection: ${isMobile}, protocol: ${protocol}, host: ${host}`);
  
  // PRIORIDADE 1: Environment variable override (sempre primeiro)
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    console.log(`🔧 CONNECTION: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }
  
  // PRIORIDADE 2: Development environment (localhost)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230';
    console.log(`🏠 CONNECTION: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
  }
  
  // PRIORIDADE 3: Production - tentar servidor dedicado apenas se não for desenvolvimento
  if (host.includes('lovableproject.com') || host.includes('onrender.com')) {
    const serverUrl = 'https://server-hutz-live.onrender.com';
    console.log(`🌐 CONNECTION: Using production server: ${serverUrl}`);
    return serverUrl;
  }
  
  // PRIORIDADE 4: Same origin fallback (mais confiável)
  const baseUrl = `${protocol}//${host}`;
  console.log(`🔗 CONNECTION: Using same origin fallback: ${baseUrl}`);
  return baseUrl;
};

export const getApiBaseURL = (): string => {
  const { protocol, host } = window.location;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  console.log(`📡 API: Mobile detection: ${isMobile}, protocol: ${protocol}, host: ${host}`);
  
  // PRIORIDADE 1: Environment variable override (sempre primeiro)
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    console.log(`🔧 API: Using environment API URL: ${envApiUrl}`);
    return envApiUrl;
  }
  
  // PRIORIDADE 2: Development environment (localhost)
  if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.') || host.includes('10.255.') || host.includes('127.0.0.1')) {
    const localIP = '172.26.204.230';
    console.log(`🏠 API: Using local network IP: ${localIP}`);
    return `http://${localIP}:3001`;
  }
  
  // PRIORIDADE 3: Production - tentar servidor dedicado apenas para Lovable/Render
  if (host.includes('lovableproject.com') || host.includes('onrender.com')) {
    const serverUrl = 'https://server-hutz-live.onrender.com';
    console.log(`🌐 API: Using production server: ${serverUrl}`);
    return serverUrl;
  }
  
  // PRIORIDADE 4: Same origin fallback
  const apiUrl = `${protocol}//${host}`;
  console.log(`🔗 API: Using same origin fallback: ${apiUrl}`);
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