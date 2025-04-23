
/**
 * Utility functions for managing session participants
 */

import { toast } from "sonner";

// Define interfaces for participant data
interface ParticipantStatus {
  active?: boolean;
  hasVideo?: boolean;
  lastActive?: number;
  [key: string]: any;
}

interface SessionParticipants {
  [participantId: string]: ParticipantStatus;
}

// Store session participants in memory
const sessions: { [sessionId: string]: SessionParticipants } = {};

/**
 * Adds a participant to a session
 */
export const addParticipantToSession = (
  sessionId: string,
  participantId: string,
  initialStatus: ParticipantStatus = {}
): void => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {};
  }

  // Only add if not already in session
  if (!sessions[sessionId][participantId]) {
    sessions[sessionId][participantId] = {
      active: true,
      hasVideo: false,
      lastActive: Date.now(),
      ...initialStatus
    };
    
    console.log(`Participant ${participantId} added to session ${sessionId}`);
    toast.success(`Novo participante conectado`);
  }
};

/**
 * Updates a participant's status in a session
 */
export const updateParticipantStatus = (
  sessionId: string,
  participantId: string,
  status: ParticipantStatus
): void => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {};
  }

  // Create participant if doesn't exist
  if (!sessions[sessionId][participantId]) {
    addParticipantToSession(sessionId, participantId, status);
    return;
  }

  // Update participant status
  sessions[sessionId][participantId] = {
    ...sessions[sessionId][participantId],
    ...status
  };
  
  console.log(`Participant ${participantId} status updated in session ${sessionId}:`, status);
};

/**
 * Gets all participants for a session
 */
export const getSessionParticipants = (sessionId: string): SessionParticipants => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {};
  }
  return sessions[sessionId];
};

/**
 * Removes a participant from a session
 */
export const removeParticipantFromSession = (
  sessionId: string,
  participantId: string
): void => {
  if (sessions[sessionId] && sessions[sessionId][participantId]) {
    delete sessions[sessionId][participantId];
    console.log(`Participant ${participantId} removed from session ${sessionId}`);
    toast.info(`Participante desconectado`);
  }
};

/**
 * Cleans up inactive participants in a session
 */
export const cleanupInactiveParticipants = (
  sessionId: string,
  maxInactiveTime: number = 30000 // Default 30 seconds
): void => {
  if (!sessions[sessionId]) return;
  
  const now = Date.now();
  let removed = 0;
  
  Object.keys(sessions[sessionId]).forEach(participantId => {
    const participant = sessions[sessionId][participantId];
    if (participant.lastActive && now - participant.lastActive > maxInactiveTime) {
      removeParticipantFromSession(sessionId, participantId);
      removed++;
    }
  });
  
  if (removed > 0) {
    console.log(`Cleaned up ${removed} inactive participants from session ${sessionId}`);
  }
};

/**
 * Clears a session completely
 */
export const clearSession = (sessionId: string): void => {
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    console.log(`Session ${sessionId} cleared`);
  }
};
