
import { getDeviceSpecificConstraints } from './mediaConstraints';
import { detectMobileAggressively } from './deviceDetection';
import { forceMobileCamera } from './mobileMediaDetector';
import { attemptStreamAcquisition, processStreamError, emergencyFallback, ensurePermissionsBeforeStream } from './streamAcquisition';
import { streamLogger } from '../debug/StreamLogger';
import { webRTCDebugger } from '../webrtc/WebRTCDebugger';

export const getUserMediaWithFallback = async (
  participantId: string = 'unknown'
): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const startTime = Date.now();
  
  console.log(`🎥 FALLBACK: Starting ${deviceType} camera acquisition for participant ${participantId}`);
  
  // CRITICAL: Log getUserMedia attempt
  webRTCDebugger.logEvent(
    'camera-session',
    participantId,
    false,
    isMobile,
    'STREAM',
    'GETUSERMEDIA_FALLBACK_START',
    { isMobile, deviceType, startTime }
  );
  
  // Log inicial via StreamLogger
  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'GETUSERMEDIA_FALLBACK',
    'Starting getUserMedia with fallback logic'
  );
  
  // CRITICAL: For mobile, try forced mobile camera first
  if (isMobile) {
    console.log('📱 MOBILE PRIORITY: Attempting forced mobile camera acquisition first');
    
    try {
      const mobileStream = await forceMobileCamera('user');
      
      if (mobileStream) {
        const duration = Date.now() - startTime;
        console.log(`✅ MOBILE SUCCESS: Forced mobile camera acquired in ${duration}ms`);
        
        // Log success
        streamLogger.logStreamSuccess(participantId, isMobile, deviceType, mobileStream, duration);
        webRTCDebugger.logEvent(
          'camera-session',
          participantId,
          false,
          isMobile,
          'STREAM',
          'FORCED_MOBILE_CAMERA_SUCCESS',
          { 
            streamId: mobileStream.id,
            duration,
            videoTracks: mobileStream.getVideoTracks().length,
            audioTracks: mobileStream.getAudioTracks().length,
            videoSettings: mobileStream.getVideoTracks()[0]?.getSettings()
          }
        );
        
        return mobileStream;
      }
    } catch (mobileError) {
      console.warn('⚠️ MOBILE FALLBACK: Forced mobile camera failed, trying standard fallback:', mobileError);
      
      // Log mobile failure
      streamLogger.logStreamError(participantId, isMobile, deviceType, mobileError as Error, 0);
      webRTCDebugger.logEvent(
        'camera-session',
        participantId,
        false,
        isMobile,
        'STREAM',
        'FORCED_MOBILE_CAMERA_FAILED',
        { 
          error: mobileError instanceof Error ? mobileError.message : String(mobileError)
        }
      );
    }
  }
  
  // FASE 1: Garantir permissões antes de tentar captura
  console.log('🔐 FALLBACK: Ensuring permissions before stream acquisition');
  
  try {
    const hasPermissions = await ensurePermissionsBeforeStream(isMobile, participantId, deviceType);
    if (!hasPermissions) {
      console.error('❌ FALLBACK: Permissions not granted, aborting');
      
      webRTCDebugger.logCriticalFailure(
        'camera-session',
        participantId,
        false,
        isMobile,
        'STREAM',
        new Error('Permissions not granted for camera access')
      );
      
      return null;
    }
  } catch (permissionError) {
    console.error('❌ FALLBACK: Permission check failed:', permissionError);
    
    webRTCDebugger.logCriticalFailure(
      'camera-session',
      participantId,
      false,
      isMobile,
      'STREAM',
      permissionError as Error
    );
    
    // Continue with fallback - some browsers don't support permission API
  }
  
  // FASE 2: Tentar constraints específicas do dispositivo
  const constraintsList = getDeviceSpecificConstraints();
  console.log(`🎯 FALLBACK: Trying ${constraintsList.length} ${deviceType} constraints`);
  
  // Log constraints list
  streamLogger.log(
    'CONSTRAINTS' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'CONSTRAINTS_LIST',
    `Prepared ${constraintsList.length} constraints for ${deviceType}`,
    { constraintsList }
  );
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < constraintsList.length; i++) {
    try {
      console.log(`🎥 FALLBACK: === ATTEMPT ${i + 1}/${constraintsList.length} ===`);
      
      const stream = await attemptStreamAcquisition(
        constraintsList[i],
        i + 1,
        constraintsList.length,
        isMobile,
        deviceType,
        participantId
      );
      
      if (stream) {
        const duration = Date.now() - startTime;
        console.log(`✅ FALLBACK: SUCCESS on attempt ${i + 1}/${constraintsList.length} in ${duration}ms`);
        
        // Log final success
        webRTCDebugger.logEvent(
          'camera-session',
          participantId,
          false,
          isMobile,
          'STREAM',
          'GETUSERMEDIA_FALLBACK_SUCCESS',
          { 
            attempt: i + 1,
            totalAttempts: constraintsList.length,
            duration,
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            finalConstraints: constraintsList[i]
          }
        );
        
        return stream;
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ FALLBACK: Attempt ${i + 1} failed:`, error);
      
      // Process error and check if we should skip to a specific constraint
      const skipToIndex = processStreamError(error, i + 1, constraintsList, isMobile, deviceType, participantId);
      
      if (skipToIndex > -1 && skipToIndex < constraintsList.length) {
        console.log(`⏭️ FALLBACK: Skipping to constraint ${skipToIndex + 1} due to error type`);
        i = skipToIndex - 1; // -1 because loop will increment
        continue;
      }
      
      // Continue to next constraint
      continue;
    }
  }
  
  // FASE 3: Todas as tentativas falharam - tentar fallback de emergência
  console.error(`❌ FALLBACK: All ${constraintsList.length} attempts failed`);
  
  webRTCDebugger.logEvent(
    'camera-session',
    participantId,
    false,
    isMobile,
    'STREAM',
    'ALL_CONSTRAINTS_FAILED',
    { 
      totalAttempts: constraintsList.length,
      lastError: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime
    }
  );
  
  try {
    console.log(`🚨 FALLBACK: Attempting emergency fallback...`);
    const emergencyStream = await emergencyFallback(participantId, isMobile, deviceType);
    
    if (emergencyStream) {
      const duration = Date.now() - startTime;
      console.log(`🚑 FALLBACK: Emergency fallback succeeded in ${duration}ms`);
      
      webRTCDebugger.logEvent(
        'camera-session',
        participantId,
        false,
        isMobile,
        'STREAM',
        'EMERGENCY_FALLBACK_SUCCESS',
        { 
          duration,
          streamId: emergencyStream.id,
          videoTracks: emergencyStream.getVideoTracks().length,
          audioTracks: emergencyStream.getAudioTracks().length
        }
      );
      
      return emergencyStream;
    }
  } catch (emergencyError) {
    console.error(`🚨 FALLBACK: Emergency fallback also failed:`, emergencyError);
    
    webRTCDebugger.logCriticalFailure(
      'camera-session',
      participantId,
      false,
      isMobile,
      'STREAM',
      emergencyError as Error
    );
  }
  
  // FASE 4: Falha total
  const totalDuration = Date.now() - startTime;
  console.error(`❌ FALLBACK: Complete failure after ${totalDuration}ms`);
  
  webRTCDebugger.logCriticalFailure(
    'camera-session',
    participantId,
    false,
    isMobile,
    'STREAM',
    new Error(`Complete getUserMedia failure after ${totalDuration}ms and ${constraintsList.length} attempts`)
  );
  
  streamLogger.log(
    'STREAM_ERROR' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: totalDuration },
    undefined,
    'COMPLETE_FAILURE',
    `Complete getUserMedia failure after ${totalDuration}ms`,
    { lastError: lastError?.message || 'Unknown error' }
  );
  
  return null;
};
