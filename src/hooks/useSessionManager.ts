
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useParticipantStore } from '@/stores/participantStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { initHostWebRTC, endWebRTC, activeParticipants } from '@/utils/webrtc';

export const useSessionManager = () => {
  const [sessionId, setSessionId] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const { clearParticipants, addParticipant, removeParticipant } = useParticipantStore();
  const { resetSettings } = useSettingsStore();

  // Handle WebRTC participants update
  useEffect(() => {
    const checkParticipants = setInterval(() => {
      if (isSessionActive && sessionId) {
        const participantIds = Object.keys(activeParticipants);
        participantIds.forEach(id => {
          addParticipant({
            id,
            hasVideo: true,
            active: true,
            selected: false,
            lastActive: Date.now()
          });
        });
      }
    }, 2000);

    return () => clearInterval(checkParticipants);
  }, [isSessionActive, sessionId, addParticipant]);

  // Create a new session
  const createSession = useCallback(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setIsSessionActive(true);
    clearParticipants();
    resetSettings();
    
    // Initialize WebRTC as host
    initHostWebRTC(newSessionId, (participantId, track) => {
      console.log(`Track received from participant ${participantId}`);
      addParticipant({
        id: participantId,
        hasVideo: track.kind === 'video',
        active: true,
        selected: false,
        lastActive: Date.now()
      });
    });
    
    return newSessionId;
  }, [clearParticipants, resetSettings, addParticipant]);

  // Join an existing session (used by broadcast window)
  const joinExistingSession = useCallback((id: string) => {
    setSessionId(id);
    setIsSessionActive(true);
    return id;
  }, []);

  // End the current session
  const endSession = useCallback(() => {
    if (sessionId && isSessionActive) {
      endWebRTC(sessionId);
      setIsSessionActive(false);
      clearParticipants();
      resetSettings();
    }
  }, [sessionId, isSessionActive, clearParticipants, resetSettings]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sessionId && isSessionActive) {
        endWebRTC(sessionId);
      }
    };
  }, [sessionId, isSessionActive]);

  return {
    sessionId,
    isSessionActive,
    createSession,
    joinExistingSession,
    endSession
  };
};
