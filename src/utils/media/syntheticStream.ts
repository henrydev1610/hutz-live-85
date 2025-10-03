/**
 * Synthetic Media Stream Generator for Development/Sandbox Environments
 * Creates animated video and audio streams when real devices are unavailable
 */

export interface SyntheticStreamOptions {
  participantId?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  includeAudio?: boolean;
}

/**
 * Creates a synthetic MediaStream with animated video and optional audio
 * @param options - Configuration options for the synthetic stream
 * @returns A valid MediaStream compatible with WebRTC
 */
export const createSyntheticStream = (options: SyntheticStreamOptions = {}): MediaStream => {
  const {
    participantId = 'synthetic-participant',
    width = 640,
    height = 480,
    frameRate = 30,
    includeAudio = true
  } = options;

  console.log('🎨 [SYNTHETIC STREAM] Creating synthetic media stream:', {
    participantId,
    dimensions: `${width}x${height}`,
    frameRate,
    includeAudio
  });

  // Create canvas for video generation
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Animation state
  let hue = 0;
  let frame = 0;

  // Animation loop
  const animate = () => {
    // Animated gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
    gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 70%, 40%)`);
    gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 70%, 30%)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add animated circle
    const centerX = width / 2 + Math.cos(frame / 50) * 100;
    const centerY = height / 2 + Math.sin(frame / 50) * 100;
    const radius = 30 + Math.sin(frame / 20) * 10;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Add text overlay
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎨 Development Mode', width / 2, 50);
    
    ctx.font = '16px Arial';
    ctx.fillText('Synthetic Stream Active', width / 2, 85);
    
    ctx.font = '14px monospace';
    ctx.fillText(participantId.substring(0, 20), width / 2, height - 50);
    
    ctx.font = '12px Arial';
    ctx.fillText(`Frame: ${frame}`, width / 2, height - 25);

    // Update animation state
    hue = (hue + 1) % 360;
    frame++;
  };

  // Start animation
  const animationInterval = setInterval(animate, 1000 / frameRate);
  
  // Cleanup function attached to stream
  const cleanup = () => {
    clearInterval(animationInterval);
    console.log('🎨 [SYNTHETIC STREAM] Animation stopped');
  };

  // Get video stream from canvas
  const videoStream = canvas.captureStream(frameRate);
  const videoTrack = videoStream.getVideoTracks()[0];
  
  if (!videoTrack) {
    cleanup();
    throw new Error('Failed to capture video track from canvas');
  }

  console.log('✅ [SYNTHETIC STREAM] Video track created:', {
    id: videoTrack.id,
    kind: videoTrack.kind,
    label: videoTrack.label,
    enabled: videoTrack.enabled,
    readyState: videoTrack.readyState
  });

  // Create synthetic audio if requested
  let audioTrack: MediaStreamTrack | null = null;
  
  if (includeAudio) {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Create a subtle test tone (440Hz at low volume)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.connect(gainNode);
      const destination = audioContext.createMediaStreamDestination();
      gainNode.connect(destination);
      oscillator.start();
      
      audioTrack = destination.stream.getAudioTracks()[0];
      
      if (audioTrack) {
        console.log('✅ [SYNTHETIC STREAM] Audio track created:', {
          id: audioTrack.id,
          kind: audioTrack.kind,
          label: audioTrack.label,
          enabled: audioTrack.enabled,
          readyState: audioTrack.readyState
        });
      }
      
      // Cleanup audio on stream end
      const originalCleanup = cleanup;
      const cleanupWithAudio = () => {
        originalCleanup();
        oscillator.stop();
        audioContext.close();
        console.log('🎨 [SYNTHETIC STREAM] Audio oscillator stopped');
      };
      
      // Replace cleanup function
      (videoStream as any).__syntheticCleanup = cleanupWithAudio;
    } catch (audioError) {
      console.warn('⚠️ [SYNTHETIC STREAM] Failed to create audio track:', audioError);
    }
  } else {
    (videoStream as any).__syntheticCleanup = cleanup;
  }

  // Combine video and audio tracks
  const syntheticStream = new MediaStream();
  syntheticStream.addTrack(videoTrack);
  
  if (audioTrack) {
    syntheticStream.addTrack(audioTrack);
  }

  // Mark as synthetic for identification
  (syntheticStream as any).__isSynthetic = true;
  (syntheticStream as any).__participantId = participantId;

  console.log('✅ [SYNTHETIC STREAM] Complete stream created:', {
    id: syntheticStream.id,
    videoTracks: syntheticStream.getVideoTracks().length,
    audioTracks: syntheticStream.getAudioTracks().length,
    active: syntheticStream.active,
    isSynthetic: true
  });

  return syntheticStream;
};

/**
 * Check if a stream is synthetic
 */
export const isSyntheticStream = (stream: MediaStream | null | undefined): boolean => {
  return !!(stream && (stream as any).__isSynthetic);
};

/**
 * Cleanup synthetic stream resources
 */
export const cleanupSyntheticStream = (stream: MediaStream): void => {
  if (isSyntheticStream(stream)) {
    const cleanup = (stream as any).__syntheticCleanup;
    if (cleanup) {
      cleanup();
      console.log('🎨 [SYNTHETIC STREAM] Cleanup executed');
    }
  }
  
  // Stop all tracks
  stream.getTracks().forEach(track => {
    track.stop();
    console.log(`🎨 [SYNTHETIC STREAM] Track stopped: ${track.kind}`);
  });
};
