import { WebRTCCallbacks } from './WebRTCCallbacks';

// Singleton instance of WebRTCCallbacks
let webRTCCallbacksInstance: WebRTCCallbacks | null = null;

export const getWebRTCCallbacksInstance = (): WebRTCCallbacks => {
  if (!webRTCCallbacksInstance) {
    webRTCCallbacksInstance = new WebRTCCallbacks();
    console.log('🔧 WebRTCCallbacks singleton instance created');
  }
  return webRTCCallbacksInstance;
};

// Export singleton instance for direct import
export const webRTCCallbacks = getWebRTCCallbacksInstance();