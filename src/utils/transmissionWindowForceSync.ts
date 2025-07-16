// Enhanced transmission window force sync utilities
export const setupTransmissionForceSync = () => {
  console.log('🔥 TRANSMISSION: Setting up force sync handlers');

  // Force sync request handler
  const handleForceSyncRequest = () => {
    console.log('🔥 TRANSMISSION: Force sync requested - sending request to parent');
    
    if (window.opener) {
      window.opener.postMessage({
        type: 'force-sync-request',
        timestamp: Date.now()
      }, '*');
    }
  };

  // Enhanced stream access with multiple fallbacks
  const getStreamWithFallbacks = (participantId: string): MediaStream | null => {
    console.log(`🔍 TRANSMISSION: Searching for stream ${participantId} with fallbacks`);
    
    // 1. Try window.sharedParticipantStreams
    if (window.sharedParticipantStreams && window.sharedParticipantStreams[participantId]) {
      console.log(`✅ TRANSMISSION: Found stream in sharedParticipantStreams for ${participantId}`);
      return window.sharedParticipantStreams[participantId];
    }
    
    // 2. Try window.opener.sharedParticipantStreams
    if (window.opener && window.opener.sharedParticipantStreams && window.opener.sharedParticipantStreams[participantId]) {
      console.log(`✅ TRANSMISSION: Found stream in opener.sharedParticipantStreams for ${participantId}`);
      // Copy to local for future access
      if (!window.sharedParticipantStreams) {
        window.sharedParticipantStreams = {};
      }
      window.sharedParticipantStreams[participantId] = window.opener.sharedParticipantStreams[participantId];
      return window.opener.sharedParticipantStreams[participantId];
    }
    
    // 3. Try window.opener.streamBackup
    if (window.opener && window.opener.streamBackup && window.opener.streamBackup[participantId]) {
      console.log(`✅ TRANSMISSION: Found stream in opener.streamBackup for ${participantId}`);
      const stream = window.opener.streamBackup[participantId];
      // Copy to local
      if (!window.sharedParticipantStreams) {
        window.sharedParticipantStreams = {};
      }
      window.sharedParticipantStreams[participantId] = stream;
      return stream;
    }
    
    console.warn(`⚠️ TRANSMISSION: No stream found for ${participantId} in any fallback location`);
    return null;
  };

  // Force update all participant videos
  const forceUpdateAllVideos = () => {
    console.log('🔥 TRANSMISSION: Force updating all participant videos');
    
    const participants = document.querySelectorAll('.participant');
    
    participants.forEach((participantElement, index) => {
      const participantSlot = `participant-slot-${index}`;
      const videoElement = participantElement.querySelector('video') as HTMLVideoElement;
      
      if (videoElement && videoElement.id === participantSlot) {
        const participantId = videoElement.dataset.participantId;
        
        if (participantId) {
          console.log(`🔄 TRANSMISSION: Force updating video for ${participantId}`);
          
          const stream = getStreamWithFallbacks(participantId);
          
          if (stream && stream.getTracks().length > 0) {
            // Check if stream is different
            if (videoElement.srcObject !== stream) {
              console.log(`🔥 TRANSMISSION: Applying new stream to ${participantId}`);
              
              videoElement.srcObject = stream;
              videoElement.load();
              
              videoElement.play().then(() => {
                console.log(`✅ TRANSMISSION: Video playing for ${participantId}`);
              }).catch(error => {
                console.error(`❌ TRANSMISSION: Failed to play video for ${participantId}:`, error);
              });
            } else {
              console.log(`ℹ️ TRANSMISSION: Stream already assigned to ${participantId}, ensuring playback`);
              if (videoElement.paused) {
                videoElement.play();
              }
            }
          } else {
            console.warn(`⚠️ TRANSMISSION: No valid stream for ${participantId}, requesting from parent`);
            
            // Request stream from parent
            if (window.opener) {
              window.opener.postMessage({
                type: 'request-participant-stream',
                participantId: participantId,
                requestType: 'force-sync',
                timestamp: Date.now()
              }, '*');
            }
          }
        }
      }
    });
  };

  // Enhanced message handler for force sync
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window.opener) return;
    
    console.log('📨 TRANSMISSION FORCE SYNC:', event.data.type, event.data);
    
    switch (event.data.type) {
      case 'force-stream-sync':
      case 'participant-stream-force-sync':
        const { participantId, forceUpdate } = event.data;
        if (forceUpdate) {
          console.log(`🔥 TRANSMISSION: Force sync for ${participantId}`);
          
          // Find video element and update immediately
          const videoElement = document.querySelector(`video[data-participant-id="${participantId}"]`) as HTMLVideoElement;
          if (videoElement) {
            const stream = getStreamWithFallbacks(participantId);
            if (stream) {
              videoElement.srcObject = stream;
              videoElement.play();
            }
          }
        }
        break;
        
      case 'bulk-stream-force-sync':
        console.log('🔥 TRANSMISSION: Bulk force sync received');
        setTimeout(forceUpdateAllVideos, 100);
        break;
        
      case 'participant-stream-ready':
        if (event.data.forceUpdate) {
          console.log(`🔥 TRANSMISSION: Force ready for ${event.data.participantId}`);
          setTimeout(() => forceUpdateAllVideos(), 50);
        }
        break;
    }
  };

  // Set up message listener
  window.addEventListener('message', handleMessage);
  
  // Auto force sync every 3 seconds
  const autoSyncInterval = setInterval(() => {
    console.log('🕐 TRANSMISSION: Auto force sync check');
    
    // Check if we have participants but no videos playing
    const participants = document.querySelectorAll('.participant');
    const playingVideos = document.querySelectorAll('.participant video[src-object]:not([paused])');
    
    if (participants.length > 0 && playingVideos.length === 0) {
      console.log('🚨 TRANSMISSION: No videos playing but participants exist - triggering force sync');
      handleForceSyncRequest();
      setTimeout(forceUpdateAllVideos, 500);
    }
  }, 3000);
  
  // Cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
    clearInterval(autoSyncInterval);
  };
};