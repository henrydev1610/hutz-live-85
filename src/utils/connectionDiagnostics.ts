
/**
 * Utility functions to help diagnose and troubleshoot WebRTC and communication issues
 */

/**
 * Test broadcast channel reception by sending a message and waiting for acknowledgment
 * @param sessionId The session ID to use for the channel
 * @param participantId The participant ID to include in the test
 * @returns Promise that resolves to true if acknowledgment was received, false otherwise
 */
export const testBroadcastReception = async (
  sessionId: string,
  participantId: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      // Generate a unique test ID
      const testId = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Set up channels for testing
      const testChannels = [
        new BroadcastChannel(`live-session-${sessionId}`),
        new BroadcastChannel(`webrtc-signaling-${sessionId}`)
      ];
      
      const responseChannel = new BroadcastChannel(`response-${sessionId}`);
      
      // Set a timeout for the test
      const timeout = setTimeout(() => {
        console.log(`Broadcast test ${testId} timed out`);
        responseChannel.close();
        testChannels.forEach(channel => channel.close());
        resolve(false);
      }, 3000);
      
      // Listen for acknowledgment
      responseChannel.onmessage = (event) => {
        const { data } = event;
        if (data.type === 'host-ack' && data.testId === testId) {
          console.log(`Received acknowledgment for test ${testId}`);
          clearTimeout(timeout);
          responseChannel.close();
          testChannels.forEach(channel => channel.close());
          resolve(true);
        }
      };
      
      // Send test messages on all channels
      testChannels.forEach(channel => {
        channel.postMessage({
          type: 'connection-test',
          id: participantId,
          testId: testId,
          timestamp: Date.now()
        });
      });
      
      // Also try localStorage method
      try {
        const localStorageKey = `test-${sessionId}-${participantId}-${testId}`;
        localStorage.setItem(localStorageKey, JSON.stringify({
          type: 'connection-test',
          id: participantId,
          testId: testId,
          timestamp: Date.now()
        }));
        
        // Remove the test message after a while
        setTimeout(() => {
          try {
            localStorage.removeItem(localStorageKey);
          } catch (e) {
            console.error("Error removing test message from localStorage:", e);
          }
        }, 5000);
      } catch (e) {
        console.warn("Failed to use localStorage for test:", e);
      }
    } catch (e) {
      console.error("Error in broadcast reception test:", e);
      resolve(false);
    }
  });
};

/**
 * Diagnose the current connection state and environment
 * @param sessionId The session ID
 * @param participantId The participant ID
 * @returns Promise that resolves to a diagnostic report object
 */
export const diagnoseConnection = async (
  sessionId: string,
  participantId: string
): Promise<any> => {
  try {
    // Gather browser and environment information
    const diagnostics = {
      timestamp: Date.now(),
      type: 'connection-diagnostics',
      participantId,
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onLine: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      document: {
        visibilityState: document.visibilityState,
        hidden: document.hidden
      },
      browserType: determineBrowserType(),
      webRTC: {
        RTCPeerConnectionSupported: typeof RTCPeerConnection !== 'undefined',
        mediaDevicesSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        mediaDevicesEnumerateSupported: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
        broadcastChannelSupported: typeof BroadcastChannel !== 'undefined'
      }
    };
    
    // Try to send the diagnostics through both broadcast and localStorage
    try {
      const channel = new BroadcastChannel(`diagnostic-${sessionId}`);
      channel.postMessage(diagnostics);
      setTimeout(() => channel.close(), 500);
    } catch (e) {
      console.warn("Failed to send diagnostics via broadcast channel:", e);
    }
    
    try {
      const key = `diagnostic-${sessionId}-${participantId}-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(diagnostics));
      setTimeout(() => localStorage.removeItem(key), 30000); // Keep for 30 seconds
    } catch (e) {
      console.warn("Failed to store diagnostics in localStorage:", e);
    }
    
    return diagnostics;
  } catch (e) {
    console.error("Error running diagnostics:", e);
    return { error: String(e) };
  }
};

/**
 * Determine the browser type from user agent
 */
function determineBrowserType(): string {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.indexOf('edge') > -1 || ua.indexOf('edg') > -1) {
    return 'edge';
  } else if (ua.indexOf('chrome') > -1) {
    return 'chrome';
  } else if (ua.indexOf('firefox') > -1) {
    return 'firefox';
  } else if (ua.indexOf('safari') > -1 && ua.indexOf('chrome') === -1) {
    return 'safari';
  } else if (ua.indexOf('opera') > -1 || ua.indexOf('opr') > -1) {
    return 'opera';
  } else {
    return 'unknown';
  }
}
