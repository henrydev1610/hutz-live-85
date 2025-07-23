import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

const TwilioParticipantPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [participantName, setParticipantName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
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
    participantName: participantName || `Participant-${Date.now()}`
  });

  const handleJoinRoom = async () => {
    if (!participantName.trim()) {
      // toast.error('Please enter your name');
      return;
    }
    
    setHasJoined(true);
    await connectToRoom();
  };

  const handleLeaveRoom = () => {
    disconnectFromRoom();
    setHasJoined(false);
  };

  const isVideoEnabled = localVideoTrack?.isEnabled ?? false;
  const isAudioEnabled = localAudioTrack?.isEnabled ?? false;

  // Name input screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-white/10 backdrop-blur border-white/20">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              Join Live Room
            </h1>
            <p className="text-gray-300">
              Room: <Badge variant="outline" className="text-white">{roomId}</Badge>
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Your Name
              </label>
              <Input
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            
            <Button 
              onClick={handleJoinRoom}
              disabled={!participantName.trim() || isConnecting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isConnecting ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Room: {roomId}
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
            
            <Button onClick={handleLeaveRoom} variant="destructive">
              <PhoneOff size={16} className="mr-2" />
              Leave Room
            </Button>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && connectionError && (
          <Card className="p-6 mb-6 bg-red-500/10 backdrop-blur border-red-500/20">
            <div className="text-center text-red-400">
              <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
              <p>{connectionError}</p>
              <Button 
                onClick={connectToRoom} 
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                Try Again
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
                  You ({participantName})
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

export default TwilioParticipantPage;