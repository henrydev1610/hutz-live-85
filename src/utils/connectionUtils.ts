export const getWebSocketURL = (): string => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const apiUrl = import.meta.env.VITE_API_URL;

  // Use VITE_API_BASE_URL in development, otherwise use VITE_API_URL
  const baseURL = import.meta.env.DEV ? apiBaseUrl : apiUrl;

  if (!baseURL) {
    throw new Error('API base URL is not defined in environment variables.');
  }

  return baseURL;
};

export const validateURLConsistency = (): void => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const apiUrl = import.meta.env.VITE_API_URL;

  if (import.meta.env.DEV && apiBaseUrl && apiUrl && apiBaseUrl !== apiUrl) {
    console.warn(
      '⚠️ Inconsistent URLs detected: VITE_API_BASE_URL and VITE_API_URL are different in development.'
    );
  }
};

export const getEnvironmentInfo = (): {
  environment: string;
  baseURL: string | undefined;
  apiBaseUrl: string | undefined;
  apiUrl: string | undefined;
} => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const apiUrl = import.meta.env.VITE_API_URL;

  // Use VITE_API_BASE_URL in development, otherwise use VITE_API_URL
  const baseURL = import.meta.env.DEV ? apiBaseUrl : apiUrl;

  return {
    environment: import.meta.env.MODE,
    baseURL: baseURL,
    apiBaseUrl: apiBaseUrl,
    apiUrl: apiUrl,
  };
};

export const validateRoom = async (roomId: string): Promise<boolean> => {
  try {
    const baseURL = getWebSocketURL();
    const response = await fetch(`${baseURL}/rooms/${roomId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      console.log(`✅ ROOM VALIDATION: Room ${roomId} exists`);
      return true;
    } else if (response.status === 404) {
      console.warn(`⚠️ ROOM VALIDATION: Room ${roomId} not found`);
      return false;
    } else {
      console.error(`❌ ROOM VALIDATION: Unexpected status code: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ ROOM VALIDATION: Error validating room:', error);
    return false;
  }
};

export const createRoomIfNeeded = async (roomId: string): Promise<boolean> => {
  try {
    const baseURL = getWebSocketURL();
    const response = await fetch(`${baseURL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId }),
    });

    if (response.status === 201) {
      console.log(`✅ ROOM CREATION: Room ${roomId} created successfully`);
      return true;
    } else if (response.status === 409) {
      console.warn(`⚠️ ROOM CREATION: Room ${roomId} already exists`);
      return true;
    } else {
      console.error(`❌ ROOM CREATION: Unexpected status code: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ ROOM CREATION: Error creating room:', error);
    return false;
  }
};

export const detectSlowNetwork = (): boolean => {
  // Check for slow network indicators
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    // Check effective connection type
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return true;
    }
    
    // Check downlink speed (in Mbps)
    const downlink = connection.downlink;
    if (downlink && downlink < 1.5) {
      return true;
    }
    
    // Check RTT (round trip time in ms)
    const rtt = connection.rtt;
    if (rtt && rtt > 300) {
      return true;
    }
  }
  
  // Mobile device heuristic
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndMobile = isMobile && (
    navigator.hardwareConcurrency <= 2 || 
    (navigator as any).deviceMemory <= 2
  );
  
  return isLowEndMobile;
};
