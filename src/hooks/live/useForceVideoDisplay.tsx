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
    // Only run if we have participants and streams
    if (participantList.length === 0 || Object.keys(participantStreams).length === 0) {
      return;
    }

    const forceVideoDisplay = () => {
      try {
        // Check each participant with a stream
        Object.entries(participantStreams).forEach(([participantId, stream]) => {
          const participant = participantList.find(p => p.id === participantId);
          
          if (participant?.active && participant.hasVideo && stream?.active) {
            const containerId = `preview-participant-video-${participantId}`;
            const container = document.getElementById(containerId);
            
            // Only create video if container exists but no video element
            if (container && !container.querySelector('video') && stream.getVideoTracks().length > 0) {
              console.log(`🚨 EMERGENCY: Creating missing video for ${participantId}`);
              
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
              
              video.srcObject = stream;
              container.appendChild(video);
              
              video.play().catch(err => {
                console.warn(`⚠️ Video play failed for ${participantId}:`, err);
              });
            }
          }
        });
      } catch (error) {
        console.error('❌ Error in forceVideoDisplay:', error);
      }
    };

    // Run once after a short delay to ensure DOM is ready
    const timeout = setTimeout(forceVideoDisplay, 500);
    
    return () => clearTimeout(timeout);
  }, [participantList, participantStreams]);
};