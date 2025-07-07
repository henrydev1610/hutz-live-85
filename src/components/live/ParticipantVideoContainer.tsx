
import React from 'react';
import { Participant } from './ParticipantGrid';

interface ParticipantVideoContainerProps {
  participant: Participant;
  index: number;
}

const ParticipantVideoContainer: React.FC<ParticipantVideoContainerProps> = ({
  participant,
  index
}) => {
  const containerId = `preview-participant-video-${participant.id}`;

  return (
    <div 
      key={participant.id} 
      className="participant-video aspect-video bg-gray-800/60 rounded-md overflow-hidden relative"
      id={containerId}
      data-participant-id={participant.id}
      style={{ 
        minHeight: '120px', 
        minWidth: '160px',
        backgroundColor: participant.hasVideo ? 'transparent' : 'rgba(55, 65, 81, 0.6)'
      }}
    >
      {/* Video will be inserted here automatically by useVideoElementManagement */}
      {!participant.hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-xs">{participant.name || `P${index + 1}`}</p>
            {participant.active && (
              <p className="text-xs text-green-400 mt-1">Conectado</p>
            )}
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
        {participant.name || `P${index + 1}`}
      </div>
      
      {/* Video indicator */}
      {participant.hasVideo && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
        </div>
      )}
      
      {/* Connection status */}
      {participant.active && (
        <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-1 py-0.5 rounded z-20">
          ●
        </div>
      )}
    </div>
  );
};

export default ParticipantVideoContainer;
