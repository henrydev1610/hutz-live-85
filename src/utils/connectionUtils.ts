/**
 * Utility functions for dynamic connection URL detection
 */

export const getWebSocketURL = (): string => {
  const { protocol, host } = window.location;
  
  // Development environment (localhost)
  if (host.includes('localhost')) {
    return 'http://localhost:3001';
  }
  
  // Production/Preview environment (Lovable or other hosting)
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}`;
};

export const getApiBaseURL = (): string => {
  const { protocol, host } = window.location;
  
  // Development environment (localhost)
  if (host.includes('localhost')) {
    return 'http://localhost:3001';
  }
  
  // Production/Preview environment
  return `${protocol}//${host}`;
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