import { twilioWebRTCService } from '@/services/TwilioWebRTCService';
import { twilioVideoService } from '@/services/TwilioVideoService';

// Enhanced Twilio integration with WebRTC config
export class TwilioIntegration {
  
  // Get Twilio-enhanced WebRTC configuration
  static async getWebRTCConfig(): Promise<RTCConfiguration> {
    try {
      console.log('🔧 TWILIO INTEGRATION: Getting WebRTC config...');
      
      // Get ICE servers from Twilio service
      const iceServers = await twilioWebRTCService.getIceServers();
      
      const config: RTCConfiguration = {
        iceServers,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
      };
      
      console.log('✅ TWILIO INTEGRATION: WebRTC config ready:', {
        iceServerCount: iceServers.length,
        hasTurnServers: iceServers.some(server => 
          Array.isArray(server.urls) 
            ? server.urls.some(url => url.includes('turn:'))
            : server.urls.includes('turn:')
        )
      });
      
      return config;
    } catch (error) {
      console.error('❌ TWILIO INTEGRATION: Failed to get WebRTC config:', error);
      
      // Fallback configuration
      return {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };
    }
  }

  // Check if Twilio Video is available and connected
  static isTwilioVideoAvailable(): boolean {
    return twilioVideoService.isConnected();
  }

  // Get Twilio service stats
  static getTwilioStats() {
    return {
      webrtcService: twilioWebRTCService.getServiceStats(),
      videoService: twilioVideoService.getState(),
      isVideoConnected: twilioVideoService.isConnected()
    };
  }

  // Force refresh Twilio services
  static async refreshServices(identity?: string, roomName?: string) {
    console.log('🔄 TWILIO INTEGRATION: Refreshing services...');
    
    try {
      await twilioWebRTCService.refreshCache(identity, roomName);
      console.log('✅ TWILIO INTEGRATION: Services refreshed successfully');
    } catch (error) {
      console.error('❌ TWILIO INTEGRATION: Failed to refresh services:', error);
    }
  }

  // Connect to Twilio Video room
  static async connectToVideoRoom(identity: string, roomName: string) {
    console.log('🎥 TWILIO INTEGRATION: Connecting to video room...');
    
    try {
      const room = await twilioVideoService.connectToRoom(identity, roomName);
      
      if (room) {
        console.log('✅ TWILIO INTEGRATION: Successfully connected to video room');
        return room;
      } else {
        throw new Error('Failed to connect to Twilio Video room');
      }
    } catch (error) {
      console.error('❌ TWILIO INTEGRATION: Video room connection failed:', error);
      throw error;
    }
  }

  // Disconnect from Twilio services
  static disconnect() {
    console.log('🔌 TWILIO INTEGRATION: Disconnecting services...');
    twilioVideoService.disconnect();
  }
}

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).__twilioIntegration = TwilioIntegration;
}