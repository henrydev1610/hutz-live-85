import React from 'react';
import { useTwilioRoom } from '@/contexts/TwilioRoomContext';
import { RemoteParticipant } from 'twilio-video';

interface RemoteParticipantGridProps {
  className?: string;
  maxParticipants?: number;
  showIdentity?: boolean;
}

interface ParticipantCardProps {
  participant: RemoteParticipant;
  showIdentity?: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ participant, showIdentity = true }) => {
  return (
    <div className="relative bg-background rounded-lg overflow-hidden border shadow-sm">
      {/* Video container with participant data attribute for auto-attachment */}
      <div 
        className="w-full h-full min-h-[200px] bg-muted flex items-center justify-center"
        data-participant-id={participant.sid}
      >
        {/* Video will be auto-attached by TwilioRoomContext */}
        <div className="text-muted-foreground text-sm">
          📹 {participant.identity}
        </div>
      </div>
      
      {/* Participant info overlay */}
      {showIdentity && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium truncate">
              {participant.identity}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const RemoteParticipantGrid: React.FC<RemoteParticipantGridProps> = ({
  className = "",
  maxParticipants = 9,
  showIdentity = true
}) => {
  const { remoteParticipants } = useTwilioRoom();
  
  const participants = Array.from(remoteParticipants.values()).slice(0, maxParticipants);
  const participantCount = participants.length;

  // Dynamic grid layout based on participant count
  const getGridClass = () => {
    if (participantCount <= 1) return "grid-cols-1";
    if (participantCount <= 4) return "grid-cols-2";
    if (participantCount <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  if (participantCount === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg p-8 ${className}`}>
        <div className="text-center text-muted-foreground">
          <div className="text-2xl mb-2">👥</div>
          <p>Aguardando participantes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${getGridClass()} ${className}`}>
      {participants.map((participant) => (
        <ParticipantCard
          key={participant.sid}
          participant={participant}
          showIdentity={showIdentity}
        />
      ))}
    </div>
  );
};

export default RemoteParticipantGrid;