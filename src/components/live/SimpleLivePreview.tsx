import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Video, VideoOff } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  status: 'waiting' | 'connecting' | 'active';
  hasVideo: boolean;
}

interface SimpleLivePreviewProps {
  participants: Participant[];
  backgroundColor: string;
  backgroundImage: string | null;
  qrCodeVisible: boolean;
  qrCodeSvg: string;
  transmissionActive: boolean;
}

const SimpleLivePreview: React.FC<SimpleLivePreviewProps> = ({
  participants,
  backgroundColor,
  backgroundImage,
  qrCodeVisible,
  qrCodeSvg,
  transmissionActive
}) => {
  const getParticipantBackground = (participant: Participant) => {
    if (participant.hasVideo && participant.status === 'active') {
      return 'bg-gray-800';
    }
    return 'bg-gray-100 dark:bg-gray-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Preview da Transmissão</h3>
        <Badge variant={transmissionActive ? "destructive" : "secondary"}>
          {transmissionActive ? '● AO VIVO' : '○ OFFLINE'}
        </Badge>
      </div>
      
      {/* Live Preview Container */}
      <div 
        className="relative aspect-video rounded-lg border-2 border-dashed border-gray-300 overflow-hidden"
        style={{
          backgroundColor: backgroundColor,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Participant Grid - 2x2 Layout */}
        <div className="absolute inset-4 grid grid-cols-2 gap-2">
          {participants.map((participant, index) => (
            <div
              key={participant.id}
              className={`
                relative rounded-lg border-2 border-gray-400/50 overflow-hidden
                ${getParticipantBackground(participant)}
                flex flex-col items-center justify-center
                transition-all duration-300
              `}
            >
              {/* Video/User Icon */}
              <div className="flex flex-col items-center justify-center h-full">
                {participant.hasVideo && participant.status === 'active' ? (
                  <div className="flex flex-col items-center gap-2">
                    <Video className="w-8 h-8 text-white" />
                    <span className="text-white text-sm font-medium">
                      {participant.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <User className={`w-12 h-12 ${getStatusColor(participant.status)}`} />
                    <span className={`text-sm font-medium ${getStatusColor(participant.status)}`}>
                      {participant.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div className="absolute top-2 right-2">
                <div className={`w-3 h-3 rounded-full ${
                  participant.status === 'active' ? 'bg-green-500' :
                  participant.status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-400'
                }`} />
              </div>

              {/* Video Status Icon */}
              <div className="absolute bottom-2 left-2">
                {participant.hasVideo ? (
                  <Video className="w-4 h-4 text-green-500" />
                ) : (
                  <VideoOff className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {/* Participant ID */}
              <div className="absolute bottom-2 right-2">
                <span className="text-xs text-gray-500 bg-white/80 px-1 rounded">
                  {participant.id}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* QR Code Overlay */}
        {qrCodeVisible && qrCodeSvg && (
          <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow-lg">
            <div 
              className="w-20 h-20"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
            />
          </div>
        )}

        {/* Live Indicator */}
        {transmissionActive && (
          <div className="absolute top-4 left-4">
            <Badge variant="destructive" className="animate-pulse">
              ● AO VIVO
            </Badge>
          </div>
        )}
      </div>

      {/* Preview Info */}
      <div className="mt-4 text-sm text-muted-foreground">
        <p>Grid 2x2 • {participants.length} participantes • Session: {Date.now().toString().slice(-6)}</p>
      </div>
    </Card>
  );
};

export default SimpleLivePreview;