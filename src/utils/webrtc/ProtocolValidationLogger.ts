/**
 * FASE 3: Critical validation logs for WebRTC Protocol
 * 
 * Logs críticos para validar se o protocolo WebRTC está funcionando corretamente
 */

export class ProtocolValidationLogger {
  private static logPrefix = '🔍 PROTOCOL VALIDATION';

  static logProtocolConversion(operation: 'offer' | 'answer' | 'candidate', before: any, after: any): void {
    console.log(`${this.logPrefix}: ${operation.toUpperCase()} conversion:`, {
      operation,
      before: {
        format: before.to ? 'NEW' : 'LEGACY',
        to: before.to,
        roomId: before.roomId,
        targetUserId: before.targetUserId
      },
      after: {
        format: after.roomId ? 'LEGACY' : 'NEW',
        roomId: after.roomId,
        targetUserId: after.targetUserId,
        to: after.to
      },
      success: true,
      timestamp: Date.now()
    });
  }

  static logStreamRegistration(participantId: string, stream: MediaStream): void {
    console.log(`${this.logPrefix}: Stream registered in host:`, {
      participantId,
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      globalMapSize: (window as any).__mlStreams__?.size || 0,
      hasGetFunction: typeof (window as any).getParticipantStream === 'function',
      timestamp: Date.now()
    });
  }

  static logWebRTCConnection(participantId: string, connectionState: RTCPeerConnectionState): void {
    console.log(`${this.logPrefix}: WebRTC connection established:`, {
      participantId,
      connectionState,
      success: connectionState === 'connected',
      timestamp: Date.now()
    });
  }

  static logPopupStreamAccess(participantId: string, streamFound: boolean, availableStreams: string[]): void {
    console.log(`${this.logPrefix}: Popup stream access:`, {
      participantId,
      streamFound,
      availableStreams,
      mapSize: availableStreams.length,
      success: streamFound,
      timestamp: Date.now()
    });
  }

  static logHostCallbackRegistration(isRegistered: boolean): void {
    console.log(`${this.logPrefix}: Host callback registration:`, {
      isRegistered,
      callbackType: typeof (window as any).hostStreamCallback,
      success: isRegistered,
      timestamp: Date.now()
    });
  }

  static logCriticalSuccess(message: string, details?: any): void {
    console.log(`✅ ${this.logPrefix}: CRITICAL SUCCESS - ${message}`, details || {});
  }

  static logCriticalError(message: string, error?: any): void {
    console.error(`❌ ${this.logPrefix}: CRITICAL ERROR - ${message}`, error || {});
  }

  static runFullValidation(): void {
    console.log(`${this.logPrefix}: ===== FULL SYSTEM VALIDATION =====`);
    
    // 1. Check global stream map
    const streamMap = (window as any).__mlStreams__;
    const streamMapSize = streamMap?.size || 0;
    console.log(`${this.logPrefix}: Global stream map:`, {
      exists: !!streamMap,
      size: streamMapSize,
      streams: streamMap ? Array.from(streamMap.keys()) : []
    });

    // 2. Check getParticipantStream function
    const getStreamFn = (window as any).getParticipantStream;
    console.log(`${this.logPrefix}: getParticipantStream function:`, {
      exists: typeof getStreamFn === 'function',
      type: typeof getStreamFn
    });

    // 3. Check host callback
    const hostCallback = (window as any).hostStreamCallback;
    console.log(`${this.logPrefix}: hostStreamCallback:`, {
      exists: typeof hostCallback === 'function',
      type: typeof hostCallback
    });

    // 4. Check current page context
    console.log(`${this.logPrefix}: Page context:`, {
      pathname: window.location.pathname,
      isLivePage: window.location.pathname.includes('/live/'),
      search: window.location.search
    });

    console.log(`${this.logPrefix}: ===== VALIDATION COMPLETE =====`);
  }
}