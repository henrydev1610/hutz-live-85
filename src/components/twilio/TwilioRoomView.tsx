import React, { useEffect } from 'react';
import { useTwilioRoom } from '@/contexts/TwilioRoomContext';
import LocalVideoTrack from './LocalVideoTrack';
import RemoteParticipantGrid from './RemoteParticipantGrid';
import TwilioVideoControls from './TwilioVideoControls';
import TwilioConnectionStatus from './TwilioConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TwilioRoomViewProps {
  identity: string;
  roomName: string;
  autoConnect?: boolean;
  showLocalVideo?: boolean;
  className?: string;
}

export const TwilioRoomView: React.FC<TwilioRoomViewProps> = ({
  identity,
  roomName,
  autoConnect = true,
  showLocalVideo = true,
  className = ""
}) => {
  const { 
    isConnected, 
    isConnecting, 
    connectToRoom, 
    remoteParticipants,
    localParticipant 
  } = useTwilioRoom();

  // Auto-connect when component mounts
  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting && roomName && identity) {
      console.log('🎥 ROOM VIEW: Auto-connecting to Twilio room');
      connectToRoom(identity, roomName);
    }
  }, [autoConnect, isConnected, isConnecting, roomName, identity, connectToRoom]);

  // Manual connect button
  const handleConnect = () => {
    if (roomName && identity) {
      connectToRoom(identity, roomName);
    }
  };

  const participantCount = remoteParticipants.size;
  const totalParticipants = participantCount + (localParticipant ? 1 : 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <TwilioConnectionStatus />

      {/* Room Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>📹 Sala: {roomName}</span>
            <div className="text-sm font-normal text-muted-foreground">
              {totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Video Layout */}
      {isConnected ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Local Video */}
          {showLocalVideo && localParticipant && (
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">📹 Você ({identity})</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <LocalVideoTrack />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remote Participants */}
          <div className={showLocalVideo ? "lg:col-span-3" : "lg:col-span-4"}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  👥 Participantes ({participantCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <RemoteParticipantGrid />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Not Connected State */
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-6xl">📹</div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Sala de Vídeo</h3>
                <p className="text-muted-foreground mb-4">
                  {isConnecting 
                    ? 'Conectando à sala...' 
                    : 'Clique para entrar na sala de vídeo'
                  }
                </p>
                {!isConnecting && !autoConnect && (
                  <Button onClick={handleConnect} disabled={!roomName || !identity}>
                    📹 Entrar na Sala
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Controls */}
      {isConnected && <TwilioVideoControls />}
    </div>
  );
};

export default TwilioRoomView;