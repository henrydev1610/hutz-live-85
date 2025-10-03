import { detectMobileAggressively, getCameraPreference, validateMobileCameraCapabilities } from './deviceDetection';
import { streamLogger } from '../debug/StreamLogger';
import { createSyntheticStream } from './syntheticStream';

// Simplified getUserMedia for automatic initialization (Teams/Meet style)
export const getUserMediaWithFallback = async (participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const isParticipant = window.location.pathname.includes('/participant/');
  
  console.log(`🎬 AUTOMATIC MEDIA: Starting ${isMobile ? 'mobile' : 'desktop'} capture`);
  console.log(`📱 Mobile: ${isMobile}, Participant: ${isParticipant}`);
  console.log(`🔐 Permission API available: ${!!navigator?.permissions}`);
  console.log(`📹 getUserMedia available: ${!!navigator?.mediaDevices?.getUserMedia}`);
  
  // PROACTIVE PERMISSION CHECK
  try {
    if (navigator.permissions) {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      console.log(`🔐 CURRENT PERMISSIONS - Camera: ${cameraPermission.state}, Micro: ${micPermission.state}`);
      
      if (cameraPermission.state === 'denied') {
        console.error(`❌ CRITICAL - Camera DENIED by user`);
        streamLogger.log('STREAM_ERROR' as any, participantId, isMobile, deviceType, 
          { timestamp: Date.now(), duration: 0, errorType: 'CAMERA_PERMISSION_DENIED' },
          undefined, 'PERMISSION_CRITICAL', 'Camera permission denied by user');
        return null;
      }
    }
  } catch (permError) {
    console.warn(`⚠️ Could not check permissions:`, permError);
  }

  // SIMPLE AUTOMATIC CONSTRAINTS (Teams/Meet style)
  const constraints: MediaStreamConstraints[] = [
    // Priority 1: Basic video + audio (most compatible)
    { video: true, audio: true },
    // Priority 2: Lower quality with audio
    { video: { width: 640, height: 480 }, audio: true },
    // Priority 3: Video only (fallback)
    { video: true, audio: false },
    // Priority 3: Mobile specific (if mobile device)
    ...(isMobile ? [{
      video: { facingMode: 'environment' },
      audio: true
    }] : []),
    // Priority 4: Mobile front camera
    ...(isMobile ? [{
      video: { facingMode: 'user' },
      audio: true
    }] : [])
  ];

  for (let i = 0; i < constraints.length; i++) {
    const startTime = Date.now();
    
    try {
      console.log(`📱 Automatic attempt ${i + 1}/${constraints.length}:`, constraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
      
      if (stream) {
        const duration = Date.now() - startTime;
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        
        console.log('✅ AUTOMATIC SUCCESS:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          cameraSettings: settings
        });
        
        // Log success
        streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);
        
        return stream;
      }
    } catch (error) {
      console.error(`❌ Automatic attempt ${i + 1} failed:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);
      
      // If permission error, stop trying
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ Permission denied - cannot continue');
        break;
      }
      
      // If NotFoundError (no devices), try synthetic stream as fallback
      if (error instanceof Error && error.name === 'NotFoundError') {
        console.warn('⚠️ No media devices found - switching to SYNTHETIC STREAM');
        
        try {
          const syntheticStream = createSyntheticStream({
            participantId,
            width: 640,
            height: 480,
            frameRate: 30,
            includeAudio: true
          });
          
          console.log('✅ SYNTHETIC STREAM created successfully:', {
            streamId: syntheticStream.id,
            videoTracks: syntheticStream.getVideoTracks().length,
            audioTracks: syntheticStream.getAudioTracks().length
          });
          
          streamLogger.log('STREAM_SUCCESS' as any, participantId, isMobile, deviceType, 
            { timestamp: Date.now(), duration: Date.now() - startTime },
            syntheticStream, 'SYNTHETIC', 'Using synthetic stream fallback');
          
          return syntheticStream;
        } catch (syntheticError) {
          console.error('❌ Failed to create synthetic stream:', syntheticError);
        }
      }
    }
  }
  
  console.error('❌ All automatic attempts failed');
  
  // Final fallback: Try synthetic stream one more time
  console.warn('🎨 Attempting FINAL FALLBACK to synthetic stream');
  try {
    const syntheticStream = createSyntheticStream({
      participantId,
      width: 640,
      height: 480,
      frameRate: 30,
      includeAudio: true
    });
    
    console.log('✅ FINAL FALLBACK successful - synthetic stream created');
    
    streamLogger.log('STREAM_SUCCESS' as any, participantId, isMobile, deviceType, 
      { timestamp: Date.now(), duration: 0 },
      syntheticStream, 'SYNTHETIC_FALLBACK', 'Final fallback to synthetic stream');
    
    return syntheticStream;
  } catch (syntheticError) {
    console.error('❌ Final synthetic stream fallback failed:', syntheticError);
    return null;
  }
};

// Keep existing complex implementation for fallback
export const getUserMediaWithComplexFallback = async (participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const isParticipant = window.location.pathname.includes('/participant/');
  
  console.log(`🎬 COMPLEX MEDIA: Starting ${isMobile ? 'mobile' : 'desktop'} capture with enhanced validation`);
  
  // Enhanced mobile camera validation
  if (isMobile && isParticipant) {
    const hasValidCamera = await validateMobileCameraCapabilities();
    if (!hasValidCamera) {
      console.warn('⚠️ Mobile camera validation failed - proceeding anyway');
    }
  }
  
  // Get camera preference
  const cameraPreference = getCameraPreference();
  console.log(`📱 Camera preference: ${cameraPreference}`);
  
  // Complex constraints with fallbacks
  const complexConstraints: MediaStreamConstraints[] = [
    // Mobile-specific constraints
    ...(isMobile ? [
      {
        video: {
          facingMode: { exact: cameraPreference },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      },
      {
        video: { facingMode: cameraPreference },
        audio: true
      },
      {
        video: { facingMode: 'environment' },
        audio: true
      },
      {
        video: { facingMode: 'user' },
        audio: true
      }
    ] : []),
    // Desktop constraints
    ...(!isMobile ? [
      {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }
    ] : []),
    // Fallback constraints
    { video: true, audio: true },
    { video: true, audio: false },
    { video: false, audio: true }
  ];

  for (let i = 0; i < complexConstraints.length; i++) {
    const startTime = Date.now();
    
    try {
      console.log(`📱 Complex attempt ${i + 1}/${complexConstraints.length}:`, complexConstraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(complexConstraints[i]);
      
      if (stream) {
        const duration = Date.now() - startTime;
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        const videoSettings = videoTrack?.getSettings();
        const audioSettings = audioTrack?.getSettings();
        
        console.log('✅ COMPLEX SUCCESS:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoSettings,
          audioSettings
        });
        
        // Validate mobile camera if applicable
        if (isMobile && videoSettings?.facingMode) {
          console.log(`✅ Mobile camera confirmed: ${videoSettings.facingMode}`);
          sessionStorage.setItem('confirmedMobileCamera', videoSettings.facingMode);
        }
        
        streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);
        
        return stream;
      }
    } catch (error) {
      console.error(`❌ Complex attempt ${i + 1} failed:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);
      
      // If permission error, stop trying
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ Permission denied - cannot continue');
        break;
      }
      
      // If NotFoundError (no devices), try synthetic stream
      if (error instanceof Error && error.name === 'NotFoundError') {
        console.warn('⚠️ No media devices found - switching to SYNTHETIC STREAM (complex)');
        
        try {
          const syntheticStream = createSyntheticStream({
            participantId,
            width: 1280,
            height: 720,
            frameRate: 30,
            includeAudio: true
          });
          
          console.log('✅ SYNTHETIC STREAM created successfully (complex):', {
            streamId: syntheticStream.id,
            videoTracks: syntheticStream.getVideoTracks().length,
            audioTracks: syntheticStream.getAudioTracks().length
          });
          
          streamLogger.log('STREAM_SUCCESS' as any, participantId, isMobile, deviceType, 
            { timestamp: Date.now(), duration: Date.now() - startTime },
            syntheticStream, 'SYNTHETIC', 'Using synthetic stream fallback (complex)');
          
          return syntheticStream;
        } catch (syntheticError) {
          console.error('❌ Failed to create synthetic stream:', syntheticError);
        }
      }
    }
  }
  
  console.error('❌ All complex attempts failed');
  
  // Final fallback: Try synthetic stream
  console.warn('🎨 Attempting FINAL FALLBACK to synthetic stream (complex)');
  try {
    const syntheticStream = createSyntheticStream({
      participantId,
      width: 1280,
      height: 720,
      frameRate: 30,
      includeAudio: true
    });
    
    console.log('✅ FINAL FALLBACK successful - synthetic stream created (complex)');
    
    streamLogger.log('STREAM_SUCCESS' as any, participantId, isMobile, deviceType, 
      { timestamp: Date.now(), duration: 0 },
      syntheticStream, 'SYNTHETIC_FALLBACK', 'Final fallback to synthetic stream (complex)');
    
    return syntheticStream;
  } catch (syntheticError) {
    console.error('❌ Final synthetic stream fallback failed:', syntheticError);
    return null;
  }
};
