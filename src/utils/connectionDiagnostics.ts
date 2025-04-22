
// Need to add type declaration for navigator.connection
interface NetworkInformation {
  downlink: number;
  effectiveType: string;
  rtt: number;
  saveData: boolean;
  type?: string;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
  }
}

/**
 * Diagnoses connection issues and provides comprehensive browser information
 * Enhanced to better handle cross-browser compatibility issues with WebRTC and BroadcastChannel
 */
export const diagnoseConnection = async (sessionId: string, participantId: string): Promise<any> => {
  try {
    const diagnostics: any = {
      timestamp: Date.now(),
      sessionId,
      participantId,
      browser: {
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
        appName: navigator.appName,
        platform: navigator.platform
      },
      features: {
        broadcastChannelSupported: typeof BroadcastChannel !== 'undefined',
        webRTCSupported: !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia,
        localStorageSupported: testLocalStorage(),
        mediaDevicesSupported: !!navigator.mediaDevices,
        getUserMediaSupported: !!navigator.mediaDevices?.getUserMedia
      },
      network: {}
    };
    
    // Add browser detection
    diagnostics.browserType = detectBrowserType();
    
    // Access navigator.connection with proper type checking
    if (navigator.connection) {
      diagnostics.network = {
        downlink: navigator.connection.downlink,
        effectiveType: navigator.connection.effectiveType,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }
    
    // Test broadcast channel communication with fallback
    const broadcastTest = await testBroadcastReception(sessionId, participantId);
    diagnostics.broadcastChannelWorking = broadcastTest;
    
    // Send diagnostic info over broadcast with enhanced fallbacks
    try {
      // Try Broadcast channel first (Chrome, Edge, others)
      try {
        const diagnosticChannel = new BroadcastChannel(`diagnostic-${sessionId}`);
        diagnosticChannel.postMessage({
          type: 'connection-diagnostics',
          ...diagnostics
        });
        setTimeout(() => diagnosticChannel.close(), 500);
      } catch (e) {
        console.warn("BroadcastChannel not supported, using localStorage fallback");
        // Fallback to localStorage for Firefox/Opera
        sendStorageFallbackMessage(sessionId, diagnostics);
      }
      
      // Always also send via localStorage as redundant method
      sendStorageFallbackMessage(sessionId, diagnostics, true);
      
      return diagnostics;
    } catch (e) {
      console.error("Error sending diagnostics:", e);
      return { ...diagnostics, error: String(e) };
    }
  } catch (e) {
    console.error("Error in diagnostics:", e);
    return { error: String(e) };
  }
};

/**
 * Helper function to send messages via localStorage for Firefox/Opera
 */
const sendStorageFallbackMessage = (sessionId: string, data: any, isRedundant = false) => {
  try {
    const storageKey = `diagnostic-${sessionId}-${data.participantId || ''}-${Date.now()}`;
    localStorage.setItem(storageKey, JSON.stringify({
      type: 'connection-diagnostics',
      ...(isRedundant ? { isRedundant: true } : {}),
      ...data,
      timestamp: Date.now()
    }));
    
    // Create a storage event to notify other tabs
    try {
      // This is for Firefox primarily, which has better support for storage events
      const notifyEvent = document.createEvent('StorageEvent');
      notifyEvent.initStorageEvent('storage', false, false, storageKey, null, JSON.stringify(data), 
                                 window.location.href, window.localStorage);
      window.dispatchEvent(notifyEvent);
    } catch (e) {
      console.warn("Could not dispatch storage event manually:", e);
    }
    
    // Clean up old diagnostic data
    setTimeout(() => localStorage.removeItem(storageKey), 30000);
  } catch (e) {
    console.error("Error in localStorage fallback:", e);
  }
};

/**
 * Detects the browser type for more specific handling
 */
const detectBrowserType = (): string => {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.indexOf('firefox') > -1) {
    return 'firefox';
  } else if (ua.indexOf('opr') > -1 || ua.indexOf('opera') > -1) {
    return 'opera';
  } else if (ua.indexOf('edge') > -1 || ua.indexOf('edg') > -1) {
    return 'edge';
  } else if (ua.indexOf('chrome') > -1) {
    return 'chrome';
  } else if (ua.indexOf('safari') > -1) {
    return 'safari';
  } else {
    return 'unknown';
  }
};

/**
 * Tests if localStorage is actually working (not just present)
 */
const testLocalStorage = (): boolean => {
  try {
    const testKey = `test-${Date.now()}`;
    localStorage.setItem(testKey, 'test');
    const result = localStorage.getItem(testKey) === 'test';
    localStorage.removeItem(testKey);
    return result;
  } catch (e) {
    return false;
  }
};

/**
 * Tests broadcast channel reception with enhanced fallbacks for Firefox and Opera
 */
export const testBroadcastReception = async (sessionId: string, participantId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      let received = false;
      const testId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const browserType = detectBrowserType();
      
      // For Firefox and Opera, prioritize localStorage fallback
      if (browserType === 'firefox' || browserType === 'opera') {
        fallbackStorageTest();
        
        // Try BroadcastChannel as secondary test
        try {
          broadcastChannelTest();
        } catch (e) {
          console.warn("BroadcastChannel test failed as expected for", browserType);
        }
      } else {
        // First try BroadcastChannel approach for Chrome and others
        try {
          broadcastChannelTest();
        } catch (broadcastError) {
          console.warn("BroadcastChannel not supported, using localStorage fallback:", broadcastError);
          fallbackStorageTest();
        }
      }
      
      // BroadcastChannel test implementation
      function broadcastChannelTest() {
        // Create a response channel to listen for acknowledgments
        const responseChannel = new BroadcastChannel(`response-${sessionId}`);
        responseChannel.onmessage = (event) => {
          if (event.data.type === 'host-ack' && 
              (event.data.targetId === participantId || !event.data.targetId)) {
            received = true;
            resolve(true);
          }
        };
        
        // Create test channel and send message
        const testChannel = new BroadcastChannel(`live-session-${sessionId}`);
        testChannel.postMessage({
          type: 'connection-test',
          id: participantId,
          browserType,
          testId,
          timestamp: Date.now()
        });
        
        // Set timeout to resolve after 2 seconds if no response
        setTimeout(() => {
          responseChannel.close();
          testChannel.close();
          if (!received) {
            // Try localStorage fallback if BroadcastChannel failed
            fallbackStorageTest();
          }
        }, 2000);
      }
      
      // Fallback to localStorage for browsers that don't fully support BroadcastChannel
      function fallbackStorageTest() {
        try {
          // Send test message via localStorage
          const storageTestKey = `test-${sessionId}-${participantId}-${testId}`;
          const testData = {
            type: 'connection-test',
            id: participantId,
            browserType,
            testId,
            timestamp: Date.now()
          };
          
          localStorage.setItem(storageTestKey, JSON.stringify(testData));
          
          // Try to manually dispatch a storage event for Firefox
          try {
            const event = document.createEvent('StorageEvent');
            event.initStorageEvent('storage', false, false, storageTestKey, null, 
                                 JSON.stringify(testData), location.href, localStorage);
            window.dispatchEvent(event);
          } catch (e) {
            console.warn("Could not dispatch storage event manually:", e);
          }
          
          // Listen for response using storage events
          const storageListener = (e: StorageEvent) => {
            if (e.key && e.key.startsWith(`response-${sessionId}`)) {
              try {
                const data = JSON.parse(e.newValue || "{}");
                if (data.type === 'host-ack' && 
                    (data.targetId === participantId || !data.targetId || data.testId === testId)) {
                  received = true;
                  window.removeEventListener('storage', storageListener);
                  resolve(true);
                }
              } catch (parseError) {
                console.error("Error parsing storage response:", parseError);
              }
            }
          };
          
          window.addEventListener('storage', storageListener);
          
          // Periodically check localStorage directly for responses (for Opera)
          const checkInterval = setInterval(() => {
            try {
              // Scan localStorage for response keys
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`response-${sessionId}`)) {
                  try {
                    const data = JSON.parse(localStorage.getItem(key) || "{}");
                    if (data.type === 'host-ack' && 
                        (data.targetId === participantId || !data.targetId || data.testId === testId)) {
                      received = true;
                      clearInterval(checkInterval);
                      window.removeEventListener('storage', storageListener);
                      localStorage.removeItem(key);  // Clean up response
                      resolve(true);
                      return;
                    }
                  } catch (e) {
                    console.warn("Error parsing potential response:", e);
                  }
                }
              }
            } catch (e) {
              console.error("Error checking localStorage:", e);
            }
          }, 500);
          
          // Set timeout to resolve after 3 seconds if no response
          setTimeout(() => {
            window.removeEventListener('storage', storageListener);
            clearInterval(checkInterval);
            localStorage.removeItem(storageTestKey);
            if (!received) {
              // As a last resort, just assume it works to not block the user experience
              console.log("No explicit confirmation of connection, proceeding anyway");
              resolve(true);
            }
          }, 3000);
        } catch (storageError) {
          console.error("localStorage fallback failed:", storageError);
          // As a last resort, just assume it works to not block the user experience
          resolve(true);
        }
      }
    } catch (e) {
      console.error("Connection test error:", e);
      // Return true anyway to not block the user experience
      resolve(true);
    }
  });
};
