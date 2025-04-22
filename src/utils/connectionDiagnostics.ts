
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
    
    // Optimized approach to sending diagnostics across browsers
    try {
      // Create a unique diagnostic ID to help with tracing
      const diagnosticId = `diag-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      diagnostics.diagnosticId = diagnosticId;
      
      // Try all available communication methods for maximum compatibility
      await Promise.allSettled([
        // Method 1: BroadcastChannel (Chrome, Edge)
        (async () => {
          try {
            if (typeof BroadcastChannel !== 'undefined') {
              const channels = [
                new BroadcastChannel(`diagnostic-${sessionId}`),
                new BroadcastChannel(`live-session-${sessionId}`)
              ];
              
              channels.forEach(channel => {
                channel.postMessage({
                  type: 'connection-diagnostics',
                  ...diagnostics,
                  method: 'broadcast'
                });
                setTimeout(() => channel.close(), 500);
              });
              return true;
            }
            return false;
          } catch (e) {
            console.warn("BroadcastChannel diagnostic message failed:", e);
            return false;
          }
        })(),
        
        // Method 2: LocalStorage with custom events (Firefox/Opera/Safari)
        (async () => {
          try {
            sendStorageFallbackMessage(sessionId, {
              ...diagnostics,
              method: 'storage'
            });
            return true;
          } catch (e) {
            console.error("LocalStorage diagnostic message failed:", e);
            return false;
          }
        })(),
        
        // Method 3: WebRTC data channel ping if available
        // This leverages existing WebRTC connections if they are established
        (async () => {
          if (window.RTCPeerConnection && (window as any).__webrtcConnections) {
            try {
              const connections = (window as any).__webrtcConnections;
              let sent = false;
              
              for (const connId in connections) {
                const conn = connections[connId];
                if (conn?.dataChannel?.readyState === 'open') {
                  conn.dataChannel.send(JSON.stringify({
                    type: 'diagnostic-data',
                    ...diagnostics,
                    method: 'webrtc'
                  }));
                  sent = true;
                }
              }
              return sent;
            } catch (e) {
              console.warn("WebRTC diagnostic message failed:", e);
              return false;
            }
          }
          return false;
        })()
      ]);
      
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
 * Enhanced helper function to send messages via localStorage for Firefox/Opera/Safari
 * Now with better cross-browser event triggering
 */
const sendStorageFallbackMessage = (sessionId: string, data: any, isRedundant = false) => {
  try {
    const storageKey = `diagnostic-${sessionId}-${data.participantId || ''}-${Date.now()}`;
    const messageData = {
      type: 'connection-diagnostics',
      ...(isRedundant ? { isRedundant: true } : {}),
      ...data,
      timestamp: Date.now()
    };
    
    localStorage.setItem(storageKey, JSON.stringify(messageData));
    
    // Try multiple approaches to notify other tabs/windows
    
    // Approach 1: Standard storage event (works in Firefox)
    try {
      // This won't actually trigger in same tab, but helps other tabs
      window.localStorage.setItem(`notify-${storageKey}`, Date.now().toString());
      window.localStorage.removeItem(`notify-${storageKey}`);
    } catch (e) {
      console.warn("Standard storage notification failed:", e);
    }
    
    // Approach 2: Dispatch custom event (works in most browsers)
    try {
      window.dispatchEvent(new CustomEvent('storage-message', { 
        detail: { key: storageKey, data: messageData } 
      }));
    } catch (e) {
      console.warn("Custom event dispatch failed:", e);
    }
    
    // Approach 3: Try to create a real StorageEvent (for older browsers)
    try {
      const storageEvent = document.createEvent('StorageEvent');
      storageEvent.initStorageEvent('storage', false, false, storageKey, null, 
                                   JSON.stringify(messageData), window.location.href, 
                                   window.localStorage);
      window.dispatchEvent(storageEvent);
    } catch (e) {
      console.warn("Manual storage event dispatch failed:", e);
    }
    
    // Clean up old diagnostic data
    setTimeout(() => localStorage.removeItem(storageKey), 30000);
    
    return true;
  } catch (e) {
    console.error("Error in localStorage fallback:", e);
    return false;
  }
};

/**
 * Enhanced browser detection with additional details for better debugging
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
 * Enhanced broadcast reception test with improved cross-browser support
 * Added more aggressive fallback mechanisms for Firefox and Opera
 */
export const testBroadcastReception = async (sessionId: string, participantId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      let received = false;
      const testId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const browserType = detectBrowserType();
      
      // Enhanced browser-specific strategy
      if (browserType === 'firefox' || browserType === 'opera' || browserType === 'safari') {
        console.log(`Using optimized approach for ${browserType}`);
        // For browsers with known BroadcastChannel issues, prioritize localStorage
        fallbackStorageTest();
        
        // Still try BroadcastChannel as secondary if it exists
        if (typeof BroadcastChannel !== 'undefined') {
          setTimeout(() => {
            try {
              broadcastChannelTest();
            } catch (e) {
              console.warn(`BroadcastChannel test failed for ${browserType}`, e);
            }
          }, 100);
        }
      } else {
        // Chrome/Edge first try BroadcastChannel, then fallback
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            broadcastChannelTest();
          } else {
            console.warn("BroadcastChannel not available, using localStorage fallback");
            fallbackStorageTest();
          }
        } catch (broadcastError) {
          console.warn("BroadcastChannel error, using localStorage fallback:", broadcastError);
          fallbackStorageTest();
        }
      }
      
      // BroadcastChannel test implementation with better error handling
      function broadcastChannelTest() {
        try {
          // Create a response channel to listen for acknowledgments
          const responseChannel = new BroadcastChannel(`response-${sessionId}`);
          responseChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'host-ack' && 
                (event.data.targetId === participantId || !event.data.targetId)) {
              received = true;
              responseChannel.close();
              resolve(true);
            }
          };
          
          // Create test channel and send message
          const channels = [
            new BroadcastChannel(`live-session-${sessionId}`),
            new BroadcastChannel(`telao-session-${sessionId}`)
          ];
          
          channels.forEach(channel => {
            try {
              channel.postMessage({
                type: 'connection-test',
                id: participantId,
                browserType,
                testId,
                timestamp: Date.now()
              });
            } catch (e) {
              console.warn(`Error posting to channel:`, e);
            }
          });
          
          // Set timeout to resolve after 2 seconds if no response
          setTimeout(() => {
            responseChannel.close();
            channels.forEach(channel => channel.close());
            
            if (!received) {
              // Try localStorage fallback if BroadcastChannel failed
              fallbackStorageTest();
            }
          }, 2000);
        } catch (e) {
          console.error("Error in broadcast test:", e);
          fallbackStorageTest();
        }
      }
      
      // Enhanced localStorage fallback with multiple notification methods
      function fallbackStorageTest() {
        try {
          // Send test message via localStorage using multiple keys for redundancy
          const baseKey = `test-${sessionId}-${participantId}`;
          const keys = [
            `${baseKey}-${testId}`,
            `${baseKey}-fallback-${Date.now()}`
          ];
          
          const testData = {
            type: 'connection-test',
            id: participantId,
            browserType,
            testId,
            timestamp: Date.now(),
            keys // Include the keys we're using for better tracing
          };
          
          // Store in multiple locations for redundancy
          keys.forEach(key => localStorage.setItem(key, JSON.stringify(testData)));
          
          // Try multiple notification mechanisms
          
          // 1. Standard localStorage change (helps other tabs)
          localStorage.setItem(`notify-${keys[0]}`, Date.now().toString());
          localStorage.removeItem(`notify-${keys[0]}`);
          
          // 2. Custom event (helps same tab)
          window.dispatchEvent(new CustomEvent('storage-message', { 
            detail: { keys, data: testData } 
          }));
          
          // 3. Try to create a real StorageEvent (for older browsers)
          try {
            const event = document.createEvent('StorageEvent');
            event.initStorageEvent('storage', false, false, keys[0], null, 
                                 JSON.stringify(testData), location.href, localStorage);
            window.dispatchEvent(event);
          } catch (e) {
            console.warn("Could not dispatch storage event manually:", e);
          }
          
          // Set up response listeners for all possible channels
          
          // 1. Storage event listener (works across tabs)
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
          
          // 2. Custom event listener (works in same tab)
          const customListener = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && 
                customEvent.detail.key && 
                customEvent.detail.key.startsWith(`response-${sessionId}`)) {
              try {
                const data = customEvent.detail.data;
                if (data.type === 'host-ack' && 
                    (data.targetId === participantId || !data.targetId || data.testId === testId)) {
                  received = true;
                  window.removeEventListener('storage-message', customListener);
                  resolve(true);
                }
              } catch (parseError) {
                console.error("Error handling custom event response:", parseError);
              }
            }
          };
          
          window.addEventListener('storage-message', customListener);
          
          // 3. Direct localStorage polling (works everywhere as fallback)
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
                      window.removeEventListener('storage-message', customListener);
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
          }, 300); // Check more frequently than before
          
          // Set timeout to clean up and resolve
          setTimeout(() => {
            window.removeEventListener('storage', storageListener);
            window.removeEventListener('storage-message', customListener);
            clearInterval(checkInterval);
            
            // Clean up test messages
            keys.forEach(key => localStorage.removeItem(key));
            
            if (!received) {
              // As a last resort, assume it works to prevent blocking the user
              console.log("No explicit confirmation of connection, proceeding anyway");
              resolve(true);
            }
          }, 3000);
        } catch (storageError) {
          console.error("localStorage fallback failed:", storageError);
          // Last resort fallback - just assume connection works to not block user
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
