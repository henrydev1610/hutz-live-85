import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

const TwilioLivePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [participantName] = useState(() => `Host-${Date.now()}`);
  
  const {
    room,
    participants,
    isConnecting,
    isConnected,
    connectionError,
    localVideoRef,
    localVideoTrack,
    localAudioTrack,
    connectToRoom,
    disconnectFromRoom,
    toggleVideo,
    toggleAudio
  } = useTwilioRoom({
    roomName: roomId || 'default-room',
    participantName
  });

  const handleLeaveRoom = () => {
    disconnectFromRoom();
    navigate('/dashboard');
  };

  const shareRoomLink = () => {
    const participantUrl = `${window.location.origin}/twilio-participant/${roomId}`;
    navigator.clipboard.writeText(participantUrl);
    // toast.success('Room link copied to clipboard!');
  };

  const isVideoEnabled = localVideoTrack?.isEnabled ?? false;
  const isAudioEnabled = localAudioTrack?.isEnabled ?? false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Live Room: {roomId}
              </h1>
              <div className="flex items-center gap-4">
                <Badge variant={isConnected ? "default" : "secondary"} className="bg-green-500">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                <div className="flex items-center gap-2 text-white">
                  <Users size={16} />
                  <span>{participants.length + (isConnected ? 1 : 0)} participants</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={shareRoomLink} variant="outline">
                Share Room
              </Button>
              <Button onClick={handleLeaveRoom} variant="destructive">
                <PhoneOff size={16} className="mr-2" />
                Leave Room
              </Button>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <Card className="p-6 mb-6 bg-white/10 backdrop-blur border-white/20">
            <div className="text-center">
              {connectionError ? (
                <div className="text-red-400 mb-4">
                  <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
                  <p>{connectionError}</p>
                </div>
              ) : (
                <div className="text-white mb-4">
                  <h3 className="text-lg font-semibold mb-2">Ready to Connect</h3>
                  <p>Click connect to start your live session</p>
                </div>
              )}
              
              <Button 
                onClick={connectToRoom} 
                disabled={isConnecting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect to Room'}
              </Button>
            </div>
          </Card>
        )}

        {/* Video Grid */}
        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Local Video */}
            <div className="relative">
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  You (Host)
                </div>
                <div className="absolute top-2 right-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              </div>
            </div>

            {/* Remote Participants */}
            {participants.map(participant => (
              <TwilioVideoContainer
                key={participant.sid}
                participant={participant}
                className="aspect-video"
              />
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 6 - participants.length - 1) }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="aspect-video bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600"
              >
                <div className="text-center text-gray-400">
                  <Users size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Waiting for participant...</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        {isConnected && (
          <Card className="p-4 bg-white/10 backdrop-blur border-white/20">
            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleVideo}
                variant={isVideoEnabled ? "default" : "destructive"}
                size="lg"
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </Button>
              
              <Button
                onClick={toggleAudio}
                variant={isAudioEnabled ? "default" : "destructive"}
                size="lg"
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TwilioLivePage;