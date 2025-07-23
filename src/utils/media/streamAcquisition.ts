
// Core stream acquisition logic
import { handleMediaError } from './mediaErrorHandling';
import { logMediaConstraintsAttempt, logStreamSuccess, logStreamError } from './deviceDebugger';
import { validateStream, logStreamDetails, verifyCameraType, setupStreamMonitoring, stabilizeStream } from './streamValidation';
import { requestMediaPermissions, checkMediaPermissions } from './permissions';
import { streamLogger } from '../debug/StreamLogger';

export const attemptStreamAcquisition = async (
  constraints: MediaStreamConstraints,
  attempt: number,
  totalAttempts: number,
  isMobile: boolean,
  deviceType: string,
  participantId: string = 'unknown'
): Promise<MediaStream> => {
  const startTime = Date.now();
  
  // Log início da tentativa
  streamLogger.logStreamStart(participantId, isMobile, deviceType, constraints);
  streamLogger.logConstraints(participantId, isMobile, deviceType, constraints, attempt);
  
  logMediaConstraintsAttempt(constraints, attempt, deviceType);
  
  console.log(`🎥 STREAM: === ATTEMPT ${attempt}/${totalAttempts} ===`);

  // Progressive delay between attempts
  if (attempt > 1) {
    const delay = isMobile ? Math.min(800 + ((attempt - 1) * 400), 3000) : Math.min(300 + ((attempt - 1) * 200), 1500);
    console.log(`⏳ STREAM: Waiting ${delay}ms before attempt ${attempt}...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Timeout configuration
  const timeoutMs = isMobile ? (attempt < 3 ? 15000 : 20000) : 12000;
  console.log(`⏰ STREAM: Using ${timeoutMs}ms timeout for attempt ${attempt}`);

  try {
    const stream = await Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`getUserMedia timeout (${timeoutMs}ms)`)), timeoutMs)
      )
    ]);
    
    // Validate the stream
    const validatedStream = validateStream(stream);
    
    const duration = Date.now() - startTime;
    
    // Log success com detalhes completos
    streamLogger.logStreamSuccess(participantId, isMobile, deviceType, validatedStream, duration);
    
    // Log success details
    logStreamDetails(validatedStream, attempt, deviceType);
    logStreamSuccess(validatedStream, deviceType);
    
    // Verify camera type
    verifyCameraType(validatedStream, isMobile);
    
    // Setup monitoring
    setupStreamMonitoring(validatedStream);
    
    // Stabilize stream
    await stabilizeStream(validatedStream, isMobile);
    
    // Log track events
    validatedStream.getTracks().forEach(track => {
      streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_added', track);
      
      track.addEventListener('ended', () => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_ended', track);
      });
      
      track.addEventListener('mute', () => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_muted', track);
      });
      
      track.addEventListener('unmute', () => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_unmuted', track);
      });
    });
    
    return validatedStream;
    
  } catch (error) {
    // Log erro detalhado
    streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, attempt);
    throw error;
  }
};

export const processStreamError = (
  error: any,
  attempt: number,
  constraintsList: MediaStreamConstraints[],
  isMobile: boolean,
  deviceType: string,
  participantId: string = 'unknown'
): number => {
  // Log erro processado
  streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, attempt);
  
  logStreamError(error as Error, attempt, deviceType);
  handleMediaError(error, isMobile, attempt, constraintsList.length);
  
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  let skipToIndex = -1;
  
  if (errorName === 'NotAllowedError') {
    console.warn('⚠️ STREAM: Permission denied - trying audio-only fallbacks');
    streamLogger.logPermission(participantId, isMobile, deviceType, 'denied');
    
    const audioOnlyIndex = constraintsList.findIndex(c => c.video === false);
    if (audioOnlyIndex > attempt - 1) {
      console.log(`⏭️ STREAM: Skipping to audio-only constraint at index ${audioOnlyIndex}`);
      skipToIndex = audioOnlyIndex;
    }
  } else if (errorName === 'NotFoundError') {
    console.warn('⚠️ STREAM: Device not found - trying more basic constraints');
  } else if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
    console.warn('⚠️ STREAM: Constraints too restrictive - trying simpler ones');
  } else if (error?.message?.includes('timeout')) {
    console.warn('⚠️ STREAM: Timeout - device may be slow, trying next constraint');
  }
  
  return skipToIndex;
};

export const emergencyFallback = async (
  participantId: string = 'unknown',
  isMobile: boolean = false,
  deviceType: string = 'unknown'
): Promise<MediaStream | null> => {
  console.log(`🏥 STREAM: Attempting EMERGENCY fallback...`);
  
  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'EMERGENCY_FALLBACK',
    'Emergency fallback initiated'
  );
  
  try {
    const emergencyStream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Emergency fallback timeout')), 10000)
      )
    ]);
    
    if (emergencyStream && emergencyStream.getTracks().length > 0) {
      console.log(`🚑 STREAM: EMERGENCY fallback succeeded!`);
      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, emergencyStream, 0);
      return emergencyStream;
    }
  } catch (emergencyError) {
    console.error(`🚨 STREAM: Emergency fallback also failed:`, emergencyError);
    streamLogger.logStreamError(participantId, isMobile, deviceType, emergencyError as Error, 0);
  }
  
  return null;
};

export const ensurePermissionsBeforeStream = async (
  isMobile: boolean,
  participantId: string = 'unknown',
  deviceType: string = 'unknown'
): Promise<boolean> => {
  console.log('🔐 PERMISSIONS: Ensuring permissions before stream acquisition...');
  
  streamLogger.log(
    'PERMISSION' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'PERMISSION_CHECK',
    'Checking permissions before stream acquisition'
  );
  
  try {
    // 1. Verificar permissões atuais
    const permissions = await checkMediaPermissions();
    console.log('🔐 PERMISSIONS: Current status:', permissions);
    
    streamLogger.logPermission(participantId, isMobile, deviceType, `camera:${permissions.camera}, microphone:${permissions.microphone}`);
    
    // 2. Se câmera já está permitida, não fazer nada
    if (permissions.camera === 'granted') {
      console.log('✅ PERMISSIONS: Camera already granted');
      return true;
    }
    
    // 3. Se câmera está negada, avisar o usuário
    if (permissions.camera === 'denied') {
      console.error('❌ PERMISSIONS: Camera denied - this will cause "NOT FOUND" error');
      streamLogger.logPermission(participantId, isMobile, deviceType, 'camera_denied');
      throw new Error('Câmera bloqueada - verifique as configurações do navegador');
    }
    
    // 4. Se status é desconhecido, solicitar permissões
    console.log('🔐 PERMISSIONS: Status unknown, requesting permissions...');
    const granted = await requestMediaPermissions(isMobile);
    
    if (!granted) {
      console.error('❌ PERMISSIONS: Permission request failed');
      streamLogger.logPermission(participantId, isMobile, deviceType, 'request_failed');
      return false;
    }
    
    console.log('✅ PERMISSIONS: All permissions ensured successfully');
    streamLogger.logPermission(participantId, isMobile, deviceType, 'granted');
    return true;
    
  } catch (error) {
    console.error('❌ PERMISSIONS: Failed to ensure permissions:', error);
    streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
    return false;
  }
};
