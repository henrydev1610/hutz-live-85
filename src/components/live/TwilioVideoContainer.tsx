import React, { useRef, useEffect } from 'react';
import { RemoteVideoTrack, RemoteAudioTrack } from 'twilio-video';
import { TwilioParticipant } from '@/services/TwilioVideoService';

interface TwilioVideoContainerProps {
  participant: TwilioParticipant;
  isLocal?: boolean;
  className?: string;
}

export const TwilioVideoContainer: React.FC<TwilioVideoContainerProps> = ({
  participant,
  isLocal = false,
  className = ""
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Handle video tracks
    const videoTracks = Array.from(participant.videoTracks.values()) as RemoteVideoTrack[];
    const primaryVideoTrack = videoTracks[0];

    if (primaryVideoTrack && !isLocal) {
      console.log(`📺 TWILIO: Attaching video track for ${participant.identity}`);
      primaryVideoTrack.attach(videoRef.current);
      
      return () => {
        if (primaryVideoTrack && videoRef.current) {
          primaryVideoTrack.detach(videoRef.current);
        }
      };
    }
  }, [participant.videoTracks, participant.identity, isLocal]);

  useEffect(() => {
    if (!audioRef.current || isLocal) return;

    // Handle audio tracks
    const audioTracks = Array.from(participant.audioTracks.values()) as RemoteAudioTrack[];
    const primaryAudioTrack = audioTracks[0];

    if (primaryAudioTrack) {
      console.log(`🔊 TWILIO: Attaching audio track for ${participant.identity}`);
      primaryAudioTrack.attach(audioRef.current);
      
      return () => {
        if (primaryAudioTrack && audioRef.current) {
          primaryAudioTrack.detach(audioRef.current);
        }
      };
    }
  }, [participant.audioTracks, participant.identity, isLocal]);

  const hasVideo = participant.videoTracks.size > 0;
  const hasAudio = participant.audioTracks.size > 0;

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${!hasVideo ? 'hidden' : ''}`}
      />
      
      {/* Audio Element (for remote participants) */}
      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          className="hidden"
        />
      )}
      
      {/* Placeholder when no video */}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <div className="text-center text-white">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold">
                {participant.identity.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm">{participant.identity}</p>
          </div>
        </div>
      )}
      
      {/* Participant Info Overlay */}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
        {participant.identity}
        {!hasAudio && <span className="ml-1">🔇</span>}
      </div>
      
      {/* Connection Status */}
      <div className="absolute top-2 right-2">
        <div className={`w-3 h-3 rounded-full ${hasVideo || hasAudio ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
    </div>
  );
};