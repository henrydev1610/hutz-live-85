
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
    
    // Test broadcast channel communication
    const broadcastTest = await testBroadcastReception(sessionId, participantId);
    diagnostics.broadcastChannelWorking = broadcastTest;
    
    // Send diagnostic info over broadcast
    try {
      const diagnosticChannel = new BroadcastChannel(`diagnostic-${sessionId}`);
      diagnosticChannel.postMessage({
        type: 'connection-diagnostics',
        ...diagnostics
      });
      setTimeout(() => diagnosticChannel.close(), 500);
      
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
      
      // Create a response channel to listen for acknowledgments
      const responseChannel = new BroadcastChannel(`response-${sessionId}`);
      responseChannel.onmessage = (event) => {
        if (event.data.type === 'host-ack' && event.data.targetId === participantId) {
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
          resolve(false);
        }
      }, 2000);
    } catch (e) {
      console.error("BroadcastChannel test error:", e);
      resolve(false);
    }
  });
};
