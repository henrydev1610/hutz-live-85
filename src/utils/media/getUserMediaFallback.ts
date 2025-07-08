import { detectMobile, checkMediaDevicesSupport, waitForStableConditions } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

  if (!checkMediaDevicesSupport()) {
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // Wait for stable conditions on mobile
  if (isMobile) {
    await waitForStableConditions(500);
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    try {
      console.log(`🎥 MEDIA: Trying constraint ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Validate stream has active tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      if (videoTracks.length === 0 && audioTracks.length === 0) {
        console.warn(`⚠️ MEDIA: Empty stream received, trying next constraint`);
        stream.getTracks().forEach(track => track.stop());
        continue;
      }
      
      console.log(`✅ MEDIA: Successfully obtained media (Mobile: ${isMobile}):`, {
        streamId: stream.id,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        tracks: stream.getTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });

      return stream;
    } catch (error) {
      try {
        handleMediaError(error, isMobile, i + 1, constraintsList.length);
      } catch (finalError) {
        if (i === constraintsList.length - 1) {
          throw finalError;
        }
      }
      
      // Add delay between attempts
      if (i < constraintsList.length - 1) {
        await waitForStableConditions(300);
      }
    }
  }

  throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
};