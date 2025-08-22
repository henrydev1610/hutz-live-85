import React, { useEffect, useRef } from 'react';
import { useTwilioRoom } from '@/contexts/TwilioRoomContext';

interface LocalVideoTrackProps {
  className?: string;
  muted?: boolean;
  autoPlay?: boolean;
  playsInline?: boolean;
}

export const LocalVideoTrack: React.FC<LocalVideoTrackProps> = ({
  className = "w-full h-full object-cover",
  muted = true,
  autoPlay = true,
  playsInline = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant, getLocalVideoTrack } = useTwilioRoom();

  useEffect(() => {
    const attachLocalVideo = async () => {
      if (!localParticipant || !videoRef.current) return;

      try {
        console.log('📹 LOCAL VIDEO: Attaching local video track');

        // Get local video track
        const localVideoTrack = await getLocalVideoTrack();
        if (!localVideoTrack) {
          console.warn('⚠️ LOCAL VIDEO: No local video track available');
          return;
        }

        // Attach to video element
        localVideoTrack.attach(videoRef.current);
        console.log('✅ LOCAL VIDEO: Local video track attached successfully');

      } catch (error) {
        console.error('❌ LOCAL VIDEO: Failed to attach local video:', error);
      }
    };

    attachLocalVideo();

    // Cleanup function
    return () => {
      if (videoRef.current) {
        // Detach all tracks from the video element
        const tracks = videoRef.current.srcObject as MediaStream;
        if (tracks) {
          tracks.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
      }
    };
  }, [localParticipant, getLocalVideoTrack]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={autoPlay}
      playsInline={playsInline}
      muted={muted}
    />
  );
};

export default LocalVideoTrack;