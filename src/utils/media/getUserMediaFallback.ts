import { detectMobile, checkMediaDevicesSupport, waitForStableConditions } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA CRITICAL: Starting media initialization for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

  // Check basic support
  if (!checkMediaDevicesSupport()) {
    console.error('❌ MEDIA CRITICAL: getUserMedia not supported');
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // Check device permissions first
  try {
    const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
    console.log(`🔒 MEDIA CRITICAL: Camera permission status: ${permissions.state}`);
  } catch (e) {
    console.warn('⚠️ MEDIA: Could not check camera permissions');
  }

  // Wait for stable conditions on mobile
  if (isMobile) {
    console.log('⏳ MEDIA: Waiting for stable mobile conditions...');
    await waitForStableConditions(500);
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();
  console.log(`📋 MEDIA CRITICAL: Will try ${constraintsList.length} constraint configurations`);

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    console.log(`🎥 MEDIA CRITICAL: Attempt ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, JSON.stringify(constraints, null, 2));

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(`🎯 MEDIA CRITICAL: Stream obtained:`, {
        streamId: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length
      });
      
      // Validate stream has active tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`📊 MEDIA CRITICAL: Track analysis:`, {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoDetails: videoTracks.map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        })),
        audioDetails: audioTracks.map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      });
      
      if (videoTracks.length === 0 && audioTracks.length === 0) {
        console.warn(`⚠️ MEDIA CRITICAL: Empty stream received, trying next constraint`);
        stream.getTracks().forEach(track => track.stop());
        continue;
      }
      
      console.log(`✅ MEDIA CRITICAL: Successfully obtained media with ${videoTracks.length} video and ${audioTracks.length} audio tracks`);
      return stream;
      
    } catch (error) {
      console.error(`❌ MEDIA CRITICAL: Constraint ${i + 1} failed:`, error);
      
      // Don't use handleMediaError for critical debugging - handle inline
      if (error instanceof Error) {
        console.error(`❌ MEDIA CRITICAL: Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      // Only throw on last attempt
      if (i === constraintsList.length - 1) {
        console.error(`❌ MEDIA CRITICAL: All ${constraintsList.length} constraints failed`);
        throw error;
      }
      
      // Add delay between attempts
      console.log(`⏳ MEDIA CRITICAL: Waiting before next attempt...`);
      await waitForStableConditions(300);
    }
  }

  console.error('❌ MEDIA CRITICAL: Fallback exhausted');
  throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
};