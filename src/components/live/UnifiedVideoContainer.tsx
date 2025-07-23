
import React, { useEffect, useRef, useState } from 'react';
import { Participant } from './ParticipantGrid';
import { useUnifiedVideoCreation } from '@/hooks/live/useUnifiedVideoCreation';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';

interface UnifiedVideoContainerProps {
  participant: Participant;
  index: number;
  stream?: MediaStream | null;
}

const UnifiedVideoContainer: React.FC<UnifiedVideoContainerProps> = ({
  participant,
  index,
  stream
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createVideoElementUnified } = useUnifiedVideoCreation();
  
  const containerId = `unified-video-${participant.id}`;
  const isMobile = participant.isMobile ?? detectMobileAggressively();

  // Main video creation effect
  useEffect(() => {
    if (!stream || !containerRef.current) {
      setIsVideoReady(false);
      return;
    }

    console.log(`🎯 UNIFIED CONTAINER: Creating video for ${participant.id}`, {
      isMobile,
      hasStream: !!stream,
      streamId: stream.id,
      active: participant.active
    });

    const createVideo = async () => {
      try {
        setError(null);
        setIsVideoReady(false);

        const videoElement = await createVideoElementUnified(
          containerRef.current!,
          stream,
          participant.id
        );

        if (videoElement) {
          setIsVideoReady(true);
          console.log(`✅ UNIFIED CONTAINER: Video ready for ${participant.id}`);
        } else {
          throw new Error('Failed to create video element');
        }
      } catch (err) {
        console.error(`❌ UNIFIED CONTAINER: Error creating video for ${participant.id}:`, err);
        setError(err instanceof Error ? err.message : 'Video creation failed');
      }
    };

    createVideo();
  }, [participant.id, stream, createVideoElementUnified, isMobile]);

  return (
    <div 
      className="participant-video aspect-video bg-gray-800/60 rounded-md overflow-hidden relative"
      id={containerId}
      data-participant-id={participant.id}
      style={{ 
        minHeight: '120px', 
        minWidth: '160px',
        backgroundColor: participant.hasVideo ? 'transparent' : 'rgba(55, 65, 81, 0.6)'
      }}
    >
      {/* Main video container */}
      <div ref={containerRef} className="w-full h-full relative" />
      
      {/* Unified status indicator */}
      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded z-30">
        {isMobile ? '📱' : '💻'} | {participant.hasVideo ? 'VIDEO' : 'NO_VIDEO'} | {isVideoReady ? '✅' : '⏳'}
      </div>
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-500/20">
          <div className="text-center text-white">
            <div className="text-xs">❌ Erro</div>
            <div className="text-xs opacity-75">{error}</div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {participant.active && stream && !isVideoReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-blue-500/20">
          <div className="text-center text-white">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div className="text-xs">
              {isMobile ? '📱 Conectando móvel...' : '💻 Conectando desktop...'}
            </div>
          </div>
        </div>
      )}
      
      {/* No stream state */}
      {participant.active && !stream && (
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
      
      {/* Inactive participant */}
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
      
      {/* Participant info overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
        {participant.name || `P${index + 1}`}
      </div>
      
      {/* Video indicator */}
      {participant.hasVideo && isVideoReady && (
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

export default UnifiedVideoContainer;
