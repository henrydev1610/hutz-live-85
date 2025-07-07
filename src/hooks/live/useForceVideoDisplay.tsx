import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseForceVideoDisplayProps {
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
}

export const useForceVideoDisplay = ({
  participantList,
  participantStreams
}: UseForceVideoDisplayProps) => {

  useEffect(() => {
    const forceVideoDisplay = () => {
      console.log('🚨 EMERGENCY: Forcing video display check');
      
      // Check each participant with a stream
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        const participant = participantList.find(p => p.id === participantId);
        
        if (participant && participant.active && participant.hasVideo) {
          const containerId = `preview-participant-video-${participantId}`;
          const container = document.getElementById(containerId);
          
          console.log(`🚨 EMERGENCY: Checking participant ${participantId}`, {
            containerExists: !!container,
            hasVideoElement: !!container?.querySelector('video'),
            streamActive: stream.active,
            videoTracks: stream.getVideoTracks().length
          });
          
          // If container exists but no video, FORCE create it
          if (container && !container.querySelector('video') && stream.active) {
            console.log(`🚨 EMERGENCY: FORCING video creation for ${participantId}`);
            
            // Clear container first
            container.innerHTML = '';
            
            // Create video element
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.controls = false;
            video.className = 'w-full h-full object-cover absolute inset-0 z-10';
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
            
            // Set stream
            video.srcObject = stream;
            
            // Add to container
            container.appendChild(video);
            
            // Force play
            video.play().then(() => {
              console.log(`✅ EMERGENCY: Video playing for ${participantId}`);
            }).catch(err => {
              console.log(`⚠️ EMERGENCY: Play failed for ${participantId}:`, err);
            });
            
            console.log(`✅ EMERGENCY: Video FORCED for ${participantId}`);
          }
        }
      });
    };

    // Run immediately
    forceVideoDisplay();
    
    // Run every 2 seconds to catch missed videos
    const interval = setInterval(forceVideoDisplay, 2000);
    
    return () => clearInterval(interval);
  }, [participantList, participantStreams]);
};