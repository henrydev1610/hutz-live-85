import { useEffect, useCallback } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseHostRemoteStreamManagerProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useHostRemoteStreamManager = ({
  participantStreams,
  participantList,
  transmissionWindowRef
}: UseHostRemoteStreamManagerProps) => {

  // Function to create video element for main display
  const createMainVideoElement = useCallback((stream: MediaStream, participantId: string) => {
    console.log('🎯 HOST: Creating main video element for:', participantId);
    
    // Find existing or create new video container
    let videoContainer = document.getElementById('main-video-container');
    if (!videoContainer) {
      videoContainer = document.createElement('div');
      videoContainer.id = 'main-video-container';
      videoContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: black;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      document.body.appendChild(videoContainer);
    }
    
    // Remove existing video
    videoContainer.innerHTML = '';
    
    // Create video element
    const video = document.createElement('video');
    video.id = 'main-remote-video';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false; // Allow audio from remote participant
    video.controls = false;
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: black;
    `;
    
    // Set stream
    video.srcObject = stream;
    videoContainer.appendChild(video);
    
    // Add participant info overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-size: 14px;
    `;
    const participant = participantList.find(p => p.id === participantId);
    overlay.textContent = `${participant?.name || participantId} - ${participant?.isMobile ? 'Mobile' : 'Desktop'}`;
    videoContainer.appendChild(overlay);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255,255,255,0.2);
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      z-index: 10000;
    `;
    closeButton.onclick = () => {
      videoContainer?.remove();
    };
    videoContainer.appendChild(closeButton);
    
    // Auto-play video
    video.play().then(() => {
      console.log('✅ HOST: Main video playing for:', participantId);
    }).catch(err => {
      console.error('❌ HOST: Video play failed:', err);
    });
    
    return video;
  }, [participantList]);

  // Monitor for new mobile streams and display them prominently
  useEffect(() => {
    const mobileStreams = Object.entries(participantStreams).filter(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      return participant?.isMobile && stream.active && stream.getVideoTracks().length > 0;
    });
    
    if (mobileStreams.length > 0) {
      // Prioritize first mobile stream
      const [firstMobileId, firstMobileStream] = mobileStreams[0];
      console.log('📱 HOST: Displaying mobile stream prominently:', firstMobileId);
      
      // Create main video display
      createMainVideoElement(firstMobileStream, firstMobileId);
      
      // Also update transmission window if open
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'mobile-stream-priority',
          participantId: firstMobileId,
          streamInfo: {
            id: firstMobileStream.id,
            active: firstMobileStream.active,
            videoTracks: firstMobileStream.getVideoTracks().length,
            audioTracks: firstMobileStream.getAudioTracks().length
          }
        }, '*');
      }
    }
  }, [participantStreams, participantList, createMainVideoElement, transmissionWindowRef]);

  // Remove main video when no streams
  useEffect(() => {
    const hasActiveStreams = Object.values(participantStreams).some(stream => 
      stream.active && stream.getVideoTracks().length > 0
    );
    
    if (!hasActiveStreams) {
      const mainVideoContainer = document.getElementById('main-video-container');
      if (mainVideoContainer) {
        mainVideoContainer.remove();
        console.log('🧹 HOST: Removed main video container (no active streams)');
      }
    }
  }, [participantStreams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const mainVideoContainer = document.getElementById('main-video-container');
      if (mainVideoContainer) {
        mainVideoContainer.remove();
        console.log('🧹 HOST: Cleanup - removed main video container');
      }
    };
  }, []);

  return {
    createMainVideoElement
  };
};