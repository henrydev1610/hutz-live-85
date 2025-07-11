// Core stream acquisition logic
import { handleMediaError } from './mediaErrorHandling';
import { logMediaConstraintsAttempt, logStreamSuccess, logStreamError } from './deviceDebugger';
import { validateStream, logStreamDetails, verifyCameraType, setupStreamMonitoring, stabilizeStream } from './streamValidation';

export const attemptStreamAcquisition = async (
  constraints: MediaStreamConstraints,
  attempt: number,
  totalAttempts: number,
  isMobile: boolean,
  deviceType: string
): Promise<MediaStream> => {
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

  const stream = await Promise.race([
    navigator.mediaDevices.getUserMedia(constraints),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`getUserMedia timeout (${timeoutMs}ms)`)), timeoutMs)
    )
  ]);
  
  // Validate the stream
  const validatedStream = validateStream(stream);
  
  // Log success details
  logStreamDetails(validatedStream, attempt, deviceType);
  logStreamSuccess(validatedStream, deviceType);
  
  // Verify camera type
  verifyCameraType(validatedStream, isMobile);
  
  // Setup monitoring
  setupStreamMonitoring(validatedStream);
  
  // Stabilize stream
  await stabilizeStream(validatedStream, isMobile);
  
  return validatedStream;
};

export const processStreamError = (
  error: any,
  attempt: number,
  constraintsList: MediaStreamConstraints[],
  isMobile: boolean,
  deviceType: string
): number => {
  logStreamError(error as Error, attempt, deviceType);
  handleMediaError(error, isMobile, attempt, constraintsList.length);
  
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  let skipToIndex = -1;
  
  if (errorName === 'NotAllowedError') {
    console.warn('⚠️ STREAM: Permission denied - trying audio-only fallbacks');
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

export const emergencyFallback = async (): Promise<MediaStream | null> => {
  console.log(`🏥 STREAM: Attempting EMERGENCY fallback...`);
  
  try {
    const emergencyStream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Emergency fallback timeout')), 10000)
      )
    ]);
    
    if (emergencyStream && emergencyStream.getTracks().length > 0) {
      console.log(`🚑 STREAM: EMERGENCY fallback succeeded!`);
      return emergencyStream;
    }
  } catch (emergencyError) {
    console.error(`🚨 STREAM: Emergency fallback also failed:`, emergencyError);
  }
  
  return null;
};