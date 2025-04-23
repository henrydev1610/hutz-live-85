
interface ParticipantStatus {
  active?: boolean;
  hasVideo?: boolean;
  lastActive?: number;
}

interface SessionParticipant {
  id: string;
  active: boolean;
  hasVideo: boolean;
  lastActive: number;
}

const sessions: Record<string, {
  participants: Record<string, SessionParticipant>
}> = {};

export const createSession = (sessionId: string) => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      participants: {}
    };
  }
  return sessions[sessionId];
};

export const addParticipantToSession = (sessionId: string, participantId: string, status: ParticipantStatus = {}) => {
  if (!sessions[sessionId]) {
    createSession(sessionId);
  }
  
  sessions[sessionId].participants[participantId] = {
    id: participantId,
    active: status.active || true,
    hasVideo: status.hasVideo || false,
    lastActive: status.lastActive || Date.now()
  };
  
  return sessions[sessionId].participants[participantId];
};

export const updateParticipantStatus = (sessionId: string, participantId: string, status: ParticipantStatus) => {
  if (!sessions[sessionId] || !sessions[sessionId].participants[participantId]) {
    return addParticipantToSession(sessionId, participantId, status);
  }
  
  const participant = sessions[sessionId].participants[participantId];
  
  // Update only the fields that are provided
  if (status.active !== undefined) participant.active = status.active;
  if (status.hasVideo !== undefined) participant.hasVideo = status.hasVideo;
  if (status.lastActive !== undefined) participant.lastActive = status.lastActive;
  
  return participant;
};

export const removeParticipantFromSession = (sessionId: string, participantId: string) => {
  if (!sessions[sessionId] || !sessions[sessionId].participants[participantId]) {
    return false;
  }
  
  delete sessions[sessionId].participants[participantId];
  return true;
};

export const getSessionParticipants = (sessionId: string) => {
  if (!sessions[sessionId]) {
    return [];
  }
  
  return Object.values(sessions[sessionId].participants);
};

export const cleanupInactiveParticipants = (sessionId: string, maxAgeMs: number = 30000) => {
  if (!sessions[sessionId]) return 0;
  
  const now = Date.now();
  let removed = 0;
  
  Object.keys(sessions[sessionId].participants).forEach(participantId => {
    const participant = sessions[sessionId].participants[participantId];
    if (now - participant.lastActive > maxAgeMs) {
      delete sessions[sessionId].participants[participantId];
      removed++;
    }
  });
  
  return removed;
};

export const sessionExists = (sessionId: string) => {
  return !!sessions[sessionId];
};

export const destroySession = (sessionId: string) => {
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    return true;
  }
  return false;
};
