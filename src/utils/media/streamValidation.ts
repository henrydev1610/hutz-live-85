
// Stream validation and verification
import { streamLogger } from '../debug/StreamLogger';

// FASE 2: Enhanced stream validation with muted track support
import { EnhancedStreamValidation } from './EnhancedStreamValidation';

export const validateStream = (stream: MediaStream | null, participantId: string = 'unknown'): MediaStream => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  if (!stream) {
    const error = new Error('Stream é null/undefined');
    streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
    throw error;
  }
  
  if (!stream.getTracks || typeof stream.getTracks !== 'function') {
    const error = new Error('Stream não possui método getTracks');
    streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
    throw error;
  }
  
  const tracks = stream.getTracks();
  if (tracks.length === 0) {
    const error = new Error('Stream sem tracks');
    streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
    throw error;
  }
  
  // Log validação bem-sucedida
  streamLogger.logValidation(participantId, isMobile, deviceType, true, {
    streamId: stream.id,
    tracksCount: tracks.length,
    hasValidMethod: true
  });
  
  return stream;
};

// FASE 2: Enhanced WebRTC-specific validation
export const validateStreamForWebRTC = (stream: MediaStream | null, participantId: string = 'unknown'): boolean => {
  console.log(`🔍 FASE 2: Enhanced WebRTC validation for ${participantId}`);
  
  const validationResult = EnhancedStreamValidation.validateStreamForWebRTC(stream, participantId);
  
  // Accept stream if it can proceed to WebRTC (includes muted but valid tracks)
  const canProceed = EnhancedStreamValidation.canProceedWithWebRTC(validationResult);
  
  if (canProceed) {
    console.log(`✅ FASE 2: Stream validation passed - ready: ${validationResult.summary.ready}, muted but valid: ${validationResult.summary.mutedButValid}`);
  } else {
    console.error(`❌ FASE 2: Stream validation failed - invalid tracks: ${validationResult.summary.invalid}`);
  }
  
  return canProceed;
};

export const logStreamDetails = (stream: MediaStream, attempt: number, deviceType: string, participantId: string = 'unknown'): void => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const tracks = stream.getTracks();
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  const activeTracks = tracks.filter(t => t.readyState === 'live');
  
  console.log(`✅ STREAM: SUCCESS! Stream obtained:`, {
    streamId: stream.id,
    active: stream.active,
    totalTracks: tracks.length,
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    activeTracks: activeTracks.length,
    attempt,
    deviceType: deviceType.toUpperCase()
  });
  
  // Log detalhado via StreamLogger
  streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, 0);
};

export const verifyCameraType = (stream: MediaStream, isMobile: boolean, participantId: string = 'unknown'): { isValid: boolean; shouldRetry: boolean } => {
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const videoTracks = stream.getVideoTracks();
  
  if (videoTracks.length === 0) {
    streamLogger.logValidation(participantId, isMobile, deviceType, true, {
      reason: 'no_video_tracks',
      shouldRetry: false
    });
    return { isValid: true, shouldRetry: false };
  }
  
  const videoTrack = videoTracks[0];
  const settings = videoTrack.getSettings();
  
  if (isMobile) {
    console.log(`📱 MOBILE CAMERA VERIFICATION:`, {
      facingMode: settings.facingMode,
      deviceId: settings.deviceId,
      label: videoTrack.label,
      isExpectedMobile: !!settings.facingMode,
      width: settings.width,
      height: settings.height
    });
    
    if (!settings.facingMode) {
      console.error(`❌ MOBILE CRITICAL: No facingMode detected! Desktop camera on mobile device!`);
      console.error(`❌ MOBILE CRITICAL: Expected mobile camera with facingMode, but got settings:`, settings);
      
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: 'no_facing_mode',
        settings,
        shouldRetry: true,
        isCritical: true
      });
      
      // Show visual alert to user
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mobileDesktopCameraDetected', {
          detail: { settings, deviceId: settings.deviceId }
        }));
      }
      
      return { isValid: false, shouldRetry: true };
    } else {
      console.log(`✅ MOBILE SUCCESS: Got mobile camera with facingMode: ${settings.facingMode}`);
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: 'mobile_camera_confirmed',
        facingMode: settings.facingMode,
        settings
      });
      return { isValid: true, shouldRetry: false };
    }
  } else {
    console.log(`🖥️ DESKTOP CAMERA VERIFICATION:`, {
      facingMode: settings.facingMode,
      deviceId: settings.deviceId,
      label: videoTrack.label,
      isExpectedDesktop: !settings.facingMode,
      width: settings.width,
      height: settings.height
    });
    
    if (settings.facingMode) {
      console.warn(`⚠️ DESKTOP WARNING: Unexpected facingMode detected! This might be mobile camera logic being used.`);
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: 'unexpected_facing_mode',
        facingMode: settings.facingMode,
        warning: true
      });
    } else {
      console.log(`✅ DESKTOP SUCCESS: Got desktop webcam without facingMode`);
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: 'desktop_camera_confirmed',
        settings
      });
    }
    return { isValid: true, shouldRetry: false };
  }
};

export const rejectNonMobileStream = async (stream: MediaStream, isMobile: boolean, participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  if (!isMobile) {
    streamLogger.logValidation(participantId, isMobile, deviceType, true, {
      reason: 'desktop_stream_accepted',
      streamId: stream.id
    });
    return stream;
  }
  
  const verification = verifyCameraType(stream, isMobile, participantId);
  
  if (!verification.isValid && verification.shouldRetry) {
    console.error(`🚫 REJECTING: Desktop camera detected on mobile device, stopping stream`);
    
    streamLogger.logValidation(participantId, isMobile, deviceType, false, {
      reason: 'desktop_camera_on_mobile',
      streamId: stream.id,
      shouldRetry: true,
      action: 'stream_rejected'
    });
    
    // Dispatch event for UI alert
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mobileDesktopCameraDetected', {
        detail: { 
          reason: 'Desktop camera on mobile device',
          shouldRetry: true,
          timestamp: Date.now()
        }
      }));
    }
    
    stream.getTracks().forEach(track => {
      streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped', track);
      track.stop();
    });
    return null;
  }
  
  streamLogger.logValidation(participantId, isMobile, deviceType, true, {
    reason: 'mobile_stream_accepted',
    streamId: stream.id
  });
  
  return stream;
};

export const setupStreamMonitoring = (stream: MediaStream, participantId: string = 'unknown'): void => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const tracks = stream.getTracks();
  
  streamLogger.log(
    'VALIDATION' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'MONITORING',
    'Stream monitoring setup initiated'
  );
  
  tracks.forEach(track => {
    track.addEventListener('ended', () => {
      console.warn(`⚠️ STREAM: Track ${track.kind} ended unexpectedly`);
      streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_ended_unexpectedly', track);
    });
    
    track.addEventListener('mute', () => {
      console.warn(`🔇 STREAM: Track ${track.kind} muted`);
      streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_muted', track);
    });
    
    track.addEventListener('unmute', () => {
      console.log(`🔊 STREAM: Track ${track.kind} unmuted`);
      streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_unmuted', track);
    });
  });
};

export const stabilizeStream = async (stream: MediaStream, isMobile: boolean, participantId: string = 'unknown'): Promise<void> => {
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  if (isMobile) {
    console.log(`📱 STREAM: Waiting for stream stabilization...`);
    
    streamLogger.log(
      'VALIDATION' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 1000 },
      undefined,
      'STABILIZATION',
      'Stream stabilization initiated'
    );
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!stream.active) {
      console.warn('⚠️ STREAM: Stream became inactive, but continuing...');
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: 'stream_became_inactive',
        streamId: stream.id,
        action: 'continuing_anyway'
      });
    } else {
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: 'stream_stabilized',
        streamId: stream.id
      });
    }
  }
};
