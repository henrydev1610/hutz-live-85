import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTwilioRoom } from '@/contexts/TwilioRoomContext';
import { Mic, MicOff, Video, VideoOff, Phone, Monitor } from 'lucide-react';
import { toast } from 'sonner';

export const TwilioVideoControls: React.FC = () => {
  const { room, localParticipant, disconnect } = useTwilioRoom();
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Update states based on actual track states
  useEffect(() => {
    if (!localParticipant) return;

    const updateTrackStates = () => {
      const audioTrack = Array.from(localParticipant.audioTracks.values())[0];
      const videoTrack = Array.from(localParticipant.videoTracks.values())[0];

      if (audioTrack) {
        setIsAudioMuted(!audioTrack.track?.isEnabled);
      }

      if (videoTrack) {
        setIsVideoMuted(!videoTrack.track?.isEnabled);
        setIsScreenSharing(videoTrack.trackName.includes('screen'));
      }
    };

    updateTrackStates();

    // Listen for track events
    localParticipant.on('trackEnabled', updateTrackStates);
    localParticipant.on('trackDisabled', updateTrackStates);
    localParticipant.on('trackPublished', updateTrackStates);
    localParticipant.on('trackUnpublished', updateTrackStates);

    return () => {
      localParticipant.off('trackEnabled', updateTrackStates);
      localParticipant.off('trackDisabled', updateTrackStates);
      localParticipant.off('trackPublished', updateTrackStates);
      localParticipant.off('trackUnpublished', updateTrackStates);
    };
  }, [localParticipant]);

  // Toggle audio mute
  const toggleAudio = async () => {
    if (!localParticipant) return;

    try {
      const audioTrack = Array.from(localParticipant.audioTracks.values())[0];
      
      if (audioTrack && audioTrack.track) {
        if (isAudioMuted) {
          audioTrack.track.enable();
          toast.success('🎤 Microfone ativado');
        } else {
          audioTrack.track.disable();
          toast.info('🎤 Microfone desativado');
        }
        setIsAudioMuted(!isAudioMuted);
      }
    } catch (error) {
      console.error('❌ CONTROLS: Failed to toggle audio:', error);
      toast.error('❌ Erro ao alterar microfone');
    }
  };

  // Toggle video mute
  const toggleVideo = async () => {
    if (!localParticipant) return;

    try {
      const videoTrack = Array.from(localParticipant.videoTracks.values())[0];
      
      if (videoTrack && videoTrack.track) {
        if (isVideoMuted) {
          videoTrack.track.enable();
          toast.success('📹 Câmera ativada');
        } else {
          videoTrack.track.disable();
          toast.info('📹 Câmera desativada');
        }
        setIsVideoMuted(!isVideoMuted);
      }
    } catch (error) {
      console.error('❌ CONTROLS: Failed to toggle video:', error);
      toast.error('❌ Erro ao alterar câmera');
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (!localParticipant || !room) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing - unpublish screen track and republish camera
        const screenTrack = Array.from(localParticipant.videoTracks.values())
          .find(pub => pub.trackName.includes('screen'));
        
        if (screenTrack) {
          await localParticipant.unpublishTrack(screenTrack.track!);
        }

        // Create and publish camera track
        const { createLocalVideoTrack } = await import('twilio-video');
        const cameraTrack = await createLocalVideoTrack({
          width: 1280,
          height: 720,
          frameRate: 30
        });
        
        await localParticipant.publishTrack(cameraTrack);
        toast.success('📹 Voltou para câmera');

      } else {
        // Start screen sharing
        const screenTrack = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        // Unpublish camera track
        const cameraTrack = Array.from(localParticipant.videoTracks.values())
          .find(pub => !pub.trackName.includes('screen'));
        
        if (cameraTrack) {
          await localParticipant.unpublishTrack(cameraTrack.track!);
        }

        // Create Twilio screen track and publish
        const { createLocalVideoTrack } = await import('twilio-video');
        const twilioScreenTrack = await createLocalVideoTrack({
          // @ts-ignore - Twilio accepts MediaStreamTrack
          mediaStreamTrack: screenTrack.getVideoTracks()[0]
        });
        
        await localParticipant.publishTrack(twilioScreenTrack);
        toast.success('🖥️ Compartilhamento iniciado');
      }

      setIsScreenSharing(!isScreenSharing);

    } catch (error) {
      console.error('❌ CONTROLS: Failed to toggle screen share:', error);
      toast.error('❌ Erro no compartilhamento de tela');
    }
  };

  // Leave room
  const leaveRoom = () => {
    disconnect();
    toast.info('👋 Você saiu da sala');
  };

  if (!room || !localParticipant) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-background border-t">
      {/* Audio control */}
      <Button
        variant={isAudioMuted ? "destructive" : "secondary"}
        size="icon"
        onClick={toggleAudio}
        title={isAudioMuted ? "Ativar microfone" : "Desativar microfone"}
      >
        {isAudioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

      {/* Video control */}
      <Button
        variant={isVideoMuted ? "destructive" : "secondary"}
        size="icon"
        onClick={toggleVideo}
        title={isVideoMuted ? "Ativar câmera" : "Desativar câmera"}
      >
        {isVideoMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </Button>

      {/* Screen share control */}
      <Button
        variant={isScreenSharing ? "default" : "secondary"}
        size="icon"
        onClick={toggleScreenShare}
        title={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
      >
        <Monitor className="h-4 w-4" />
      </Button>

      {/* Leave room */}
      <Button
        variant="destructive"
        size="icon"
        onClick={leaveRoom}
        title="Sair da sala"
        className="ml-auto"
      >
        <Phone className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default TwilioVideoControls;