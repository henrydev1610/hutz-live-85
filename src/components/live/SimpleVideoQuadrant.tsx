
import React from 'react';
import { Participant } from './ParticipantGrid';
import DirectVideoRenderer from './DirectVideoRenderer';
import { useDirectStreamURL } from '@/hooks/live/useDirectStreamURL';

interface SimpleVideoQuadrantProps {
  participant: Participant;
  index: number;
  sessionId: string;
  webrtcStream?: MediaStream | null;
}

const SimpleVideoQuadrant: React.FC<SimpleVideoQuadrantProps> = ({
  participant,
  index,
  sessionId,
  webrtcStream
}) => {
  const { streamURL, isLoading, error, refreshStream } = useDirectStreamURL({
    participantId: participant.id,
    sessionId,
    enabled: participant.active
  });

  console.log(`🎭 SIMPLE QUADRANT: ${participant.id}`, {
    hasWebRTC: !!webrtcStream,
    hasStreamURL: !!streamURL,
    isLoading,
    error
  });

  return (
    <div 
      className="participant-video aspect-video bg-gray-800/60 rounded-md overflow-hidden relative"
      style={{ minHeight: '120px', minWidth: '160px' }}
    >
      {/* Video Content */}
      {participant.active && (streamURL || webrtcStream) && (
        <DirectVideoRenderer
          streamURL={streamURL || ''}
          participantId={participant.id}
          fallbackStream={webrtcStream}
          className="w-full h-full object-cover absolute inset-0 z-10"
        />
      )}
      
      {/* Status Indicator */}
      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded z-30">
        {streamURL ? '🌐' : webrtcStream ? '🔗' : '⏳'} | {participant.isMobile ? '📱' : '💻'}
      </div>
      
      {/* Loading State */}
      {participant.active && isLoading && !webrtcStream && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-blue-500/20">
          <div className="text-center text-white">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div className="text-xs">Buscando stream...</div>
          </div>
        </div>
      )}
      
      {/* Error State with Retry */}
      {participant.active && error && !webrtcStream && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-500/20">
          <div className="text-center text-white">
            <div className="text-xs mb-1">❌ Stream indisponível</div>
            <button
              onClick={refreshStream}
              className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      
      {/* No Stream Available */}
      {participant.active && !streamURL && !webrtcStream && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-xs font-medium">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-green-400 mt-1">● Conectado</p>
            <p className="text-xs text-yellow-400 mt-1">Aguardando stream...</p>
          </div>
        </div>
      )}
      
      {/* Inactive Participant */}
      {!participant.active && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/60">
          <div className="text-center text-white/40">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-xs">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-gray-500 mt-1">Aguardando</p>
          </div>
        </div>
      )}
      
      {/* Participant Info */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
        {participant.name || `P${index + 1}`}
      </div>
      
      {/* Connection Status */}
      {participant.active && (
        <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-1 py-0.5 rounded z-20">
          ●
        </div>
      )}
    </div>
  );
};

export default SimpleVideoQuadrant;
