
/**
 * Utility for WebRTC and BroadcastChannel connection diagnostics
 */

// Function to diagnose WebRTC connection issues
export const diagnoseConnection = async (sessionId: string, participantId: string) => {
  try {
    // Check BroadcastChannel support
    const broadcastSupported = 'BroadcastChannel' in window;
    
    // Check WebRTC support
    const rtcSupported = 'RTCPeerConnection' in window;
    
    // Check MediaDevices support
    const mediaDevicesSupported = 'mediaDevices' in navigator;
    
    // Get available devices
    let videoDevices: MediaDeviceInfo[] = [];
    if (mediaDevicesSupported) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
      } catch (e) {
        console.error("Error enumerating devices:", e);
      }
    }
    
    // Check permissions
    let cameraPermission = false;
    if (mediaDevicesSupported) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        cameraPermission = true;
      } catch (e) {
        console.error("Camera permission denied:", e);
      }
    }
    
    // Test BroadcastChannel
    let broadcastWorking = false;
    if (broadcastSupported) {
      try {
        const testChannel = new BroadcastChannel(`test-${sessionId}`);
        
        const testPromise = new Promise<boolean>((resolve) => {
          const timeoutId = setTimeout(() => resolve(false), 1000);
          
          testChannel.onmessage = () => {
            clearTimeout(timeoutId);
            resolve(true);
          };
          
          testChannel.postMessage({ type: 'test', timestamp: Date.now() });
        });
        
        broadcastWorking = await testPromise;
        testChannel.close();
      } catch (e) {
        console.error("Error testing BroadcastChannel:", e);
      }
    }
    
    // Log diagnostics to console and attempt to send via BroadcastChannel
    const diagnostics = {
      sessionId,
      participantId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      features: {
        broadcastSupported,
        broadcastWorking,
        rtcSupported,
        mediaDevicesSupported,
        cameraPermission,
      },
      videoDevices: videoDevices.length,
      connectionType: navigator.connection ? (navigator.connection as any).effectiveType : 'unknown',
    };
    
    console.log("Connection diagnostics:", diagnostics);
    
    // Try to send diagnostics via multiple channels
    if (broadcastSupported) {
      try {
        const channels = [
          new BroadcastChannel(`diagnostic-${sessionId}`),
          new BroadcastChannel(`live-session-${sessionId}`),
          new BroadcastChannel(`telao-session-${sessionId}`)
        ];
        
        channels.forEach(channel => {
          channel.postMessage({
            type: 'connection-diagnostics',
            ...diagnostics
          });
          setTimeout(() => channel.close(), 500);
        });
      } catch (e) {
        console.error("Error sending diagnostics:", e);
      }
    }
    
    return diagnostics;
  } catch (e) {
    console.error("Error running diagnostics:", e);
    return {
      error: e,
      sessionId,
      participantId,
      timestamp: Date.now()
    };
  }
};

// Checks if BroadcastChannel message is being received by the host
export const testBroadcastReception = async (
  sessionId: string, 
  participantId: string,
  messageType: string = 'video-stream-info'
) => {
  try {
    if (!('BroadcastChannel' in window)) {
      console.error("BroadcastChannel not supported");
      return false;
    }
    
    // Create a unique test message
    const testMessage = {
      type: messageType,
      id: participantId,
      testId: `test-${Date.now()}`,
      timestamp: Date.now()
    };
    
    // Send via multiple channels
    const channels = [
      new BroadcastChannel(`live-session-${sessionId}`),
      new BroadcastChannel(`telao-session-${sessionId}`),
      new BroadcastChannel(`stream-info-${sessionId}`)
    ];
    
    console.log(`Sending test message of type ${messageType} for participant ${participantId}`);
    
    channels.forEach(channel => {
      channel.postMessage(testMessage);
      setTimeout(() => channel.close(), 500);
    });
    
    // Create a special channel to listen for acknowledgment
    const responseChannel = new BroadcastChannel(`response-${sessionId}`);
    
    const receivedPromise = new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        responseChannel.close();
        resolve(false);
      }, 3000);
      
      responseChannel.onmessage = (event) => {
        if (event.data.type === 'host-ack' && 
            event.data.testId === testMessage.testId) {
          clearTimeout(timeoutId);
          responseChannel.close();
          resolve(true);
        }
      };
    });
    
    return await receivedPromise;
  } catch (e) {
    console.error("Error testing broadcast reception:", e);
    return false;
  }
};
