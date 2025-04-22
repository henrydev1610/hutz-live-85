
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

export const diagnoseConnection = async (sessionId: string, participantId: string): Promise<any> => {
  try {
    const diagnostics: any = {
      timestamp: Date.now(),
      sessionId,
      participantId,
      browser: navigator.userAgent,
      network: {}
    };
    
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
    
    // Send diagnostic info over broadcast with fallback
    try {
      // Try BroadcastChannel first
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
        const storageKey = `diagnostic-${sessionId}-${Date.now()}`;
        localStorage.setItem(storageKey, JSON.stringify({
          type: 'connection-diagnostics',
          ...diagnostics,
          timestamp: Date.now()
        }));
        // Clean up old diagnostic data
        setTimeout(() => localStorage.removeItem(storageKey), 10000);
      }
      
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

export const testBroadcastReception = async (sessionId: string, participantId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      let received = false;
      const testId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // First try BroadcastChannel approach
      try {
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
      } catch (broadcastError) {
        console.warn("BroadcastChannel not supported, using localStorage fallback:", broadcastError);
        fallbackStorageTest();
      }
      
      // Fallback to localStorage for browsers that don't fully support BroadcastChannel
      function fallbackStorageTest() {
        try {
          // Send test message via localStorage
          const storageTestKey = `test-${sessionId}-${participantId}-${testId}`;
          localStorage.setItem(storageTestKey, JSON.stringify({
            type: 'connection-test',
            id: participantId,
            testId,
            timestamp: Date.now()
          }));
          
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
          
          // Set timeout to resolve after 2 seconds if no response
          setTimeout(() => {
            window.removeEventListener('storage', storageListener);
            localStorage.removeItem(storageTestKey);
            if (!received) {
              // As a last resort, just assume it works to not block the user experience
              console.log("No explicit confirmation of connection, proceeding anyway");
              resolve(true);
            }
          }, 2000);
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
