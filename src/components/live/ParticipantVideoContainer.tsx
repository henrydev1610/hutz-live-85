
import React, { useCallback } from 'react';
import { Participant } from './ParticipantGrid';
import { useDirectVideoCreation } from '@/hooks/live/useDirectVideoCreation';
import { useVideoHeartbeat } from '@/hooks/live/useVideoHeartbeat';
import MobileCameraStreamProcessor from './MobileCameraStreamProcessor';

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
  const { tryCreateVideo } = useDirectVideoCreation({
    participantId: participant.id,
    stream: stream || null,
    containerId
  });

  // Video health monitoring callbacks
  const handleVideoLost = useCallback((participantId: string) => {
    console.error('💔 Video lost detected for:', participantId);
    // Try to recreate video
    setTimeout(() => {
      tryCreateVideo();
    }, 1000);
  }, [tryCreateVideo]);

  const handleVideoRestored = useCallback((participantId: string) => {
    console.log('💚 Video restored for:', participantId);
  }, []);

  // Use video heartbeat for health monitoring
  const { isHealthy } = useVideoHeartbeat({
    participantId: participant.id,
    stream: stream || null,
    onVideoLost: handleVideoLost,
    onVideoRestored: handleVideoRestored
  });

  // Manual video creation as fallback with mobile optimizations
  const createVideoManually = () => {
    if (!stream) {
      console.log(`🚫 MANUAL: No stream to create video for ${participant.id}`);
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.log(`🚫 MANUAL: Container not found for ${participant.id}`);
      return;
    }

    console.log(`🎬 MANUAL: Creating video manually for ${participant.id}`);
    
    // Remove existing video
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      existingVideo.remove();
    }

    // Create video element with mobile optimizations
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.className = 'w-full h-full object-cover absolute inset-0 z-10';
    
    // MOBILE-CRITICAL: Additional mobile attributes
    const isMobileParticipant = participant.isMobile || participant.id.includes('mobile-');
    if (isMobileParticipant) {
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.preload = 'auto';
    }
    
    video.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
    `;

    video.srcObject = stream;
    container.appendChild(video);

    // Enhanced event listeners with mobile-specific handling
    video.addEventListener('loadedmetadata', () => {
      console.log(`📹 MANUAL: Video metadata loaded for ${participant.id} (mobile: ${isMobileParticipant})`);
      if (isMobileParticipant) {
        // Force play immediately for mobile
        video.play().catch(error => {
          console.warn(`⚠️ MANUAL: Initial play failed for mobile ${participant.id}, retrying muted:`, error);
          video.muted = true;
          video.play();
        });
      }
    });

    video.addEventListener('playing', () => {
      console.log(`✅ MANUAL: Video is now playing for ${participant.id} (mobile: ${isMobileParticipant})`);
    });

    // Force play with mobile fallback
    video.play().then(() => {
      console.log(`✅ MANUAL: Video playing for ${participant.id} (mobile: ${isMobileParticipant})`);
    }).catch(err => {
      console.log(`⚠️ MANUAL: Play failed for ${participant.id}:`, err);
      // Mobile fallback: ensure muted playback
      if (isMobileParticipant) {
        video.muted = true;
        video.play();
      }
    });
    
    // MOBILE-CRITICAL: Force play after DOM insertion
    if (isMobileParticipant) {
      setTimeout(() => {
        video.play().catch(error => {
          console.warn(`⚠️ MANUAL: Delayed play failed for mobile ${participant.id}:`, error);
        });
      }, 100);
    }
  };

  // Check if video is playing
  const hasPlayingVideo = () => {
    const container = document.getElementById(containerId);
    if (!container) return false;
    
    const video = container.querySelector('video') as HTMLVideoElement;
    return video && video.srcObject === stream && !video.paused;
  };

  // MOBILE-CRITICAL: Aggressive video creation for mobile streams
  React.useEffect(() => {
    const isMobileParticipant = participant.isMobile || 
                               participant.id.includes('mobile-') ||
                               participant.id.includes('Mobile');
    
    if (stream && participant.active && !hasPlayingVideo()) {
      console.log(`🎥 CONTAINER: Forcing video creation for ${participant.id} (mobile: ${isMobileParticipant}) with aggressive retry`);
      
      let attempts = 0;
      const maxAttempts = isMobileParticipant ? 10 : 5; // More attempts for mobile
      
      const forceVideoCreation = () => {
        attempts++;
        console.log(`🔄 Attempt ${attempts}/${maxAttempts} to create video for ${participant.id} (mobile: ${isMobileParticipant})`);
        
        try {
          // MOBILE-CRITICAL: Multiple creation strategies
          if (isMobileParticipant) {
            // Strategy 1: Direct creation
            tryCreateVideo();
            
            // Strategy 2: Manual creation as backup
            setTimeout(() => {
              if (!hasPlayingVideo()) {
                console.log(`📱 MOBILE: Trying manual video creation for ${participant.id}`);
                createVideoManually();
              }
            }, 500);
            
            // Strategy 3: Force direct video creation with stream
            setTimeout(() => {
              if (!hasPlayingVideo()) {
                console.log(`📱 MOBILE: Triggering direct video creation for ${participant.id}`);
                tryCreateVideo();
              }
            }, 1000);
          } else {
            tryCreateVideo();
          }
          
          // Check and retry
          const retryDelay = isMobileParticipant ? 800 : 1000;
          setTimeout(() => {
            if (!hasPlayingVideo() && attempts < maxAttempts) {
              console.log(`🔄 Video still not playing for ${participant.id} (mobile: ${isMobileParticipant}), retrying...`);
              forceVideoCreation();
            } else if (hasPlayingVideo()) {
              console.log(`✅ Video successfully created for ${participant.id} after ${attempts} attempts`);
            }
          }, retryDelay);
          
        } catch (error) {
          console.error(`❌ Force video creation failed for ${participant.id}:`, error);
          
          if (attempts < maxAttempts) {
            const backoffDelay = isMobileParticipant ? 1500 : 2000;
            setTimeout(forceVideoCreation, backoffDelay);
          }
        }
      };
      
      // Start immediately for mobile, small delay for others
      const initialDelay = isMobileParticipant ? 0 : 100;
      setTimeout(forceVideoCreation, initialDelay);
    }
  }, [stream, participant.active, participant.id, participant.isMobile]);

  // Debug info
  console.log(`🎭 RENDER: ParticipantVideoContainer for ${participant.id}`, {
    containerId,
    active: participant.active,
    hasVideo: participant.hasVideo,
    selected: participant.selected,
    name: participant.name,
    hasStream: !!stream,
    streamId: stream?.id,
    streamTracks: stream?.getTracks()?.length || 0,
    streamVideoTracks: stream?.getVideoTracks()?.length || 0,
    hasPlayingVideo: hasPlayingVideo()
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
      {/* MOBILE-CRITICAL: Force mobile processing for all mobile participants */}
      {participant.isMobile && stream && (
        <MobileCameraStreamProcessor
          participantId={participant.id}
          stream={stream}
          onStreamReady={(participantId, videoElement) => {
            console.log(`📱 MOBILE-CRITICAL: Mobile video ready for ${participantId}`);
            // Force video to be visible immediately
            videoElement.style.display = 'block';
            videoElement.style.visibility = 'visible';
          }}
        />
      )}

      {/* DEBUG: Informações de debug SEMPRE visíveis */}
      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded z-30">
        {participant.hasVideo ? 'HAS_VIDEO' : 'NO_VIDEO'} | {participant.active ? 'ACTIVE' : 'INACTIVE'} | {participant.isMobile ? '📱' : '💻'} | {isHealthy ? '💚' : '💔'}
      </div>
      
      {/* Show placeholder when participant is active but no video is playing or unhealthy */}
      {participant.active && stream && (!hasPlayingVideo() || !isHealthy) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className={`w-8 h-8 mx-auto mb-1 ${!isHealthy ? 'text-red-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {!isHealthy ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )}
            </svg>
            <p className="text-xs font-medium">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-green-400 mt-1">● Conectado</p>
            <p className={`text-xs mt-1 ${!isHealthy ? 'text-red-400' : 'text-yellow-400'}`}>
              {!isHealthy ? 'Vídeo perdido' : 'Processando vídeo...'}
            </p>
            <button 
              onClick={createVideoManually}
              className={`mt-2 px-2 py-1 text-white text-xs rounded hover:opacity-80 ${!isHealthy ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {!isHealthy ? 'Recuperar Vídeo' : 'Forçar Vídeo'}
            </button>
          </div>
        </div>
      )}
      
      {/* Show waiting message when no stream */}
      {participant.active && !stream && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-800/60">
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
