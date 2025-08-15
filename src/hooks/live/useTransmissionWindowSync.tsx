// TRANSMISSION WINDOW SYNCHRONIZATION: Wait for iframe onload before applying streams
import { useEffect, useRef } from 'react';

interface UseTransmissionWindowSyncProps {
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  participantStreams: {[id: string]: MediaStream};
  participantList: any[];
}

export const useTransmissionWindowSync = ({
  transmissionWindowRef,
  participantStreams,
  participantList
}: UseTransmissionWindowSyncProps) => {
  const isWindowLoaded = useRef(false);
  const pendingUpdates = useRef<any[]>([]);

  // Monitor iframe load state
  useEffect(() => {
    if (!transmissionWindowRef.current) return;

    const handleWindowLoad = () => {
      console.log('🚀 TRANSMISSION-SYNC: Iframe loaded, applying pending updates');
      isWindowLoaded.current = true;
      
      // Apply all pending updates
      pendingUpdates.current.forEach(update => {
        try {
          transmissionWindowRef.current?.postMessage(update, '*');
          console.log('✅ TRANSMISSION-SYNC: Applied pending update:', update.type);
        } catch (error) {
          console.error('❌ TRANSMISSION-SYNC: Failed to apply pending update:', error);
        }
      });
      
      // Clear pending updates
      pendingUpdates.current = [];
    };

    const handleWindowError = (error: any) => {
      console.error('❌ TRANSMISSION-SYNC: Iframe load error:', error);
      isWindowLoaded.current = false;
    };

    // Check if window is already loaded
    try {
      if (transmissionWindowRef.current.document?.readyState === 'complete') {
        console.log('🔄 TRANSMISSION-SYNC: Window already loaded');
        handleWindowLoad();
      } else {
        // Listen for load event
        transmissionWindowRef.current.addEventListener('load', handleWindowLoad);
        transmissionWindowRef.current.addEventListener('error', handleWindowError);
      }
    } catch (error) {
      console.warn('⚠️ TRANSMISSION-SYNC: Unable to check window state:', error);
      // Fallback: assume loaded after delay
      setTimeout(() => {
        console.log('🔄 TRANSMISSION-SYNC: Fallback - assuming window loaded');
        handleWindowLoad();
      }, 2000);
    }

    return () => {
      if (transmissionWindowRef.current) {
        transmissionWindowRef.current.removeEventListener('load', handleWindowLoad);
        transmissionWindowRef.current.removeEventListener('error', handleWindowError);
      }
    };
  }, [transmissionWindowRef.current]);

  // Synchronized update function
  const syncUpdate = (updateData: any) => {
    if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) {
      console.warn('⚠️ TRANSMISSION-SYNC: Window not available for update');
      return;
    }

    if (isWindowLoaded.current) {
      try {
        transmissionWindowRef.current.postMessage(updateData, '*');
        console.log('✅ TRANSMISSION-SYNC: Immediate update sent:', updateData.type);
      } catch (error) {
        console.error('❌ TRANSMISSION-SYNC: Failed to send immediate update:', error);
      }
    } else {
      console.log('📦 TRANSMISSION-SYNC: Queueing update for after load:', updateData.type);
      pendingUpdates.current.push(updateData);
    }
  };

  // Sync participants when they change
  useEffect(() => {
    if (participantList.length > 0) {
      console.log('👥 TRANSMISSION-SYNC: Syncing participants:', participantList.length);
      
      syncUpdate({
        type: 'update-participants',
        participants: participantList.map(p => ({
          ...p,
          hasStream: !!participantStreams[p.id]
        })),
        timestamp: Date.now(),
        streamCount: Object.keys(participantStreams).length
      });
    }
  }, [participantList, participantStreams]);

  // Sync streams when they change
  useEffect(() => {
    const streamIds = Object.keys(participantStreams);
    if (streamIds.length > 0) {
      console.log('🎥 TRANSMISSION-SYNC: Syncing streams:', streamIds);
      
      syncUpdate({
        type: 'update-streams',
        streamIds,
        timestamp: Date.now()
      });
    }
  }, [participantStreams]);

  return {
    syncUpdate,
    isWindowLoaded: isWindowLoaded.current,
    hasPendingUpdates: pendingUpdates.current.length > 0
  };
};