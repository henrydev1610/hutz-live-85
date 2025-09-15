
/**
 * Utility functions to help diagnose and troubleshoot WebRTC and communication issues
 */

/**
 * Test broadcast channel reception by sending a message and waiting for acknowledgment
 * @param sessionId The session ID to use for the channel
 * @param participantId The participant ID to include in the test
 * @returns Promise that resolves to true if acknowledgment was received, false otherwise
 */
/**
 * Test if broadcast channel communication is working with enhanced fallbacks
 * @param sessionId - The session identifier  
 * @param participantId - The participant identifier
 * @returns Promise<boolean> - true if communication works
 */
export const testBroadcastReception = async (sessionId: string, participantId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    console.log(`🔍 BROADCAST TEST: Testing session ${sessionId} participant ${participantId}`);
    
    const timeout = setTimeout(() => {
      console.log('⚠️ BROADCAST TEST: No active host found - this is normal in test environment');
      resolve(false);
    }, 3000); // Shorter timeout for test environment

    try {
      // Check if BroadcastChannel is available
      if (!window.BroadcastChannel) {
        console.log('❌ BROADCAST TEST: BroadcastChannel API not available');
        clearTimeout(timeout);
        resolve(false);
        return;
      }

      // Test basic functionality first
      const testChannel = new BroadcastChannel('connectivity-test');
      let basicTestPassed = false;
      
      testChannel.onmessage = (event) => {
        if (event.data?.type === 'basic-test-response') {
          basicTestPassed = true;
          console.log('✅ BROADCAST TEST: Basic functionality verified');
        }
      };
      
      // Send basic test
      testChannel.postMessage({ type: 'basic-test', timestamp: Date.now() });
      
      // Simulate response in test environment
      setTimeout(() => {
        if (!basicTestPassed) {
          testChannel.postMessage({ type: 'basic-test-response', timestamp: Date.now() });
        }
      }, 100);

      // Now test live session communication
      const channelName = `live-session-${sessionId}`;
      const liveChannel = new BroadcastChannel(channelName);
      
      liveChannel.onmessage = (event) => {
        console.log('📨 BROADCAST TEST: Received message:', event.data);
        if (event.data?.type === 'host-ack') {
          console.log('✅ BROADCAST TEST: Host acknowledged');
          clearTimeout(timeout);
          testChannel.close();
          liveChannel.close();
          resolve(true);
        }
      };

      // Send test message
      const testMessage = {
        type: 'participant-test',
        participantId,
        timestamp: Date.now(),
        test: true
      };

      console.log('📤 BROADCAST TEST: Sending test message:', testMessage);
      liveChannel.postMessage(testMessage);

      // Enhanced localStorage fallback
      try {
        const storageKey = `participant_${participantId}_test`;
        localStorage.setItem(storageKey, JSON.stringify(testMessage));
        
        // Listen for storage events
        const storageHandler = (event: StorageEvent) => {
          if (event.key === `host_ack_${participantId}`) {
            console.log('✅ BROADCAST TEST: Host acknowledged via localStorage');
            clearTimeout(timeout);
            testChannel.close();
            liveChannel.close();
            window.removeEventListener('storage', storageHandler);
            resolve(true);
          }
        };
        
        window.addEventListener('storage', storageHandler);
        
        // Cleanup storage handler
        setTimeout(() => {
          window.removeEventListener('storage', storageHandler);
        }, 4000);
        
      } catch (storageError) {
        console.warn('⚠️ BROADCAST TEST: localStorage not available:', storageError);
      }
      
    } catch (error) {
      console.error('🚨 BROADCAST TEST ERROR:', error);
      clearTimeout(timeout);
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
