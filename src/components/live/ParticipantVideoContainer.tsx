
import React from 'react';
import { Participant } from './ParticipantGrid';
import { useDirectVideoCreation } from '@/hooks/live/useDirectVideoCreation';

interface ParticipantVideoContainerProps {
  participant: Participant;
  index: number;
  stream?: MediaStream | null;
}

const ParticipantVideoContainer: React.FC<ParticipantVideoContainerProps> = ({
  participant,
  index,
  stream
}) => {
  const containerId = `preview-participant-video-${participant.id}`;

  // Use direct video creation hook
  useDirectVideoCreation({
    participantId: participant.id,
    stream: stream || null,
    containerId
  });

  // FORCE: Log de debug agressivo
  console.log(`🎭 RENDER: ParticipantVideoContainer for ${participant.id}`, {
    containerId,
    active: participant.active,
    hasVideo: participant.hasVideo,
    selected: participant.selected,
    name: participant.name,
    hasStream: !!stream,
    streamId: stream?.id
  });

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
      {/* DEBUG: Informações de debug SEMPRE visíveis */}
      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded z-30">
        {participant.hasVideo ? 'HAS_VIDEO' : 'NO_VIDEO'} | {participant.active ? 'ACTIVE' : 'INACTIVE'}
      </div>
      
      {/* Video will be inserted here automatically by useVideoElementManagement */}
      {/* Show placeholder for connected participants even without video stream yet */}
      {participant.active && !document.querySelector(`#${containerId} video`) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-xs font-medium">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-green-400 mt-1">● Conectado</p>
            <p className="text-xs text-yellow-400 mt-1">Carregando vídeo...</p>
          </div>
        </div>
      )}
      
      {/* Show placeholder for inactive participants */}
      {!participant.active && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-800/60">
          <div className="text-center text-white/40">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-xs">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-gray-500 mt-1">Aguardando</p>
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
