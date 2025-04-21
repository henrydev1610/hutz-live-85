
// Session storage and management utility functions

// Define session interface
export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
  participantCount: number; // Added for Dashboard component
  participants: {
    [participantId: string]: {
      name: string;
      active: boolean;
      lastActive: number;
    }
  }
  settings?: {
    finalAction?: {
      type: 'none' | 'image' | 'coupon';
      image?: string;
      link?: string;
      coupon?: string;
    }
  }
}

// Local storage keys
const SESSIONS_STORAGE_KEY = 'hutz-live-sessions';
const SESSION_ACTIVE_PREFIX = 'hutz-live-session-active-';

/**
 * Generate a session ID
 */
export const generateSessionId = (): string => {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

/**
 * Get all stored sessions
 */
export const getStoredSessions = (): Session[] => {
  try {
    const sessionsJson = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!sessionsJson) return [];
    
    const sessions = JSON.parse(sessionsJson);
    
    // Add participantCount property if it doesn't exist
    const processedSessions = Array.isArray(sessions) ? sessions.map(session => {
      if (!session.hasOwnProperty('participantCount')) {
        const participantCount = session.participants ? Object.keys(session.participants).length : 0;
        return {
          ...session,
          participantCount
        };
      }
      return session;
    }) : [];
    
    return processedSessions;
  } catch (error) {
    console.error('Error getting stored sessions:', error);
    return [];
  }
};

/**
 * Get a specific session by ID
 */
export const getSessionById = (sessionId: string): Session | null => {
  try {
    const sessions = getStoredSessions();
    return sessions.find(session => session.id === sessionId) || null;
  } catch (error) {
    console.error('Error getting session by ID:', error);
    return null;
  }
};

/**
 * Create a new session
 */
export const createSession = (name: string): string => {
  try {
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newSession: Session = {
      id: sessionId,
      name,
      createdAt: Date.now(),
      lastActive: Date.now(),
      participantCount: 0, // Add the missing participantCount property with initial value 0
      participants: {}
    };
    
    const sessions = getStoredSessions();
    sessions.push(newSession);
    
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`, JSON.stringify({
      active: true,
      timestamp: Date.now()
    }));
    
    // Also store in sessionStorage as a backup
    try {
      sessionStorage.setItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`, 'true');
    } catch (e) {
      console.warn('Error saving to sessionStorage:', e);
    }
    
    return sessionId;
  } catch (error) {
    console.error('Error creating session:', error);
    return '';
  }
};

/**
 * Check if a session is active
 */
export const isSessionActive = (sessionId: string): boolean => {
  try {
    // First check localStorage
    const sessionActiveJson = localStorage.getItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`);
    if (sessionActiveJson) {
      try {
        const sessionActive = JSON.parse(sessionActiveJson);
        // Check if active within the last 3 hours
        if (sessionActive.active && Date.now() - sessionActive.timestamp < 3 * 60 * 60 * 1000) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing session active JSON:', e);
      }
    }
    
    // If not found in localStorage, check sessionStorage as a backup
    try {
      const sessionActive = sessionStorage.getItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`);
      if (sessionActive === 'true') {
        return true;
      }
    } catch (e) {
      console.warn('Error checking sessionStorage:', e);
    }
    
    // If not found in either storage, check if session exists and was active recently
    const session = getSessionById(sessionId);
    if (session && Date.now() - session.lastActive < 3 * 60 * 60 * 1000) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if session is active:', error);
    return false;
  }
};

/**
 * Remove a session
 */
export const removeSession = (sessionId: string): boolean => {
  try {
    const sessions = getStoredSessions();
    const updatedSessions = sessions.filter(session => session.id !== sessionId);
    
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    localStorage.removeItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`);
    
    try {
      sessionStorage.removeItem(`${SESSION_ACTIVE_PREFIX}${sessionId}`);
    } catch (e) {
      console.warn('Error removing from sessionStorage:', e);
    }
    
    return true;
  } catch (error) {
    console.error('Error removing session:', error);
    return false;
  }
};

/**
 * Add a participant to a session
 */
export const addParticipantToSession = (sessionId: string, participantId: string, participantName: string): boolean => {
  try {
    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) return false;
    
    if (!sessions[sessionIndex].participants) {
      sessions[sessionIndex].participants = {};
    }
    
    sessions[sessionIndex].participants[participantId] = {
      name: participantName,
      active: true,
      lastActive: Date.now()
    };
    
    sessions[sessionIndex].lastActive = Date.now();
    
    // Update participant count
    sessions[sessionIndex].participantCount = Object.keys(sessions[sessionIndex].participants).length;
    
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error('Error adding participant to session:', error);
    return false;
  }
};

/**
 * Update a participant's status
 */
export const updateParticipantStatus = (
  sessionId: string, 
  participantId: string, 
  status: { active?: boolean; lastActive?: number }
): boolean => {
  try {
    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) return false;
    
    if (!sessions[sessionIndex].participants || !sessions[sessionIndex].participants[participantId]) {
      return false;
    }
    
    if (status.active !== undefined) {
      sessions[sessionIndex].participants[participantId].active = status.active;
    }
    
    if (status.lastActive !== undefined) {
      sessions[sessionIndex].participants[participantId].lastActive = status.lastActive;
    } else {
      sessions[sessionIndex].participants[participantId].lastActive = Date.now();
    }
    
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error('Error updating participant status:', error);
    return false;
  }
};

/**
 * Get participants for a session
 */
export const getSessionParticipants = (sessionId: string): { [participantId: string]: { name: string; active: boolean; lastActive: number } } => {
  try {
    const session = getSessionById(sessionId);
    if (!session || !session.participants) return {};
    
    // Clean up inactive participants (inactive for more than 2 minutes)
    const currentTime = Date.now();
    const activeParticipants: { [participantId: string]: { name: string; active: boolean; lastActive: number } } = {};
    
    Object.keys(session.participants).forEach(participantId => {
      const participant = session.participants[participantId];
      
      // If participant was active in the last 2 minutes, consider them still active
      const isStillActive = participant.active && (currentTime - participant.lastActive < 2 * 60 * 1000);
      
      activeParticipants[participantId] = {
        ...participant,
        active: isStillActive
      };
    });
    
    return activeParticipants;
  } catch (error) {
    console.error('Error getting session participants:', error);
    return {};
  }
};

/**
 * Set the final action for a session (what to show users when session ends)
 */
export const setSessionFinalAction = (
  sessionId: string,
  finalAction: {
    type: 'none' | 'image' | 'coupon';
    image?: string;
    link?: string;
    coupon?: string;
  }
): boolean => {
  try {
    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) return false;
    
    if (!sessions[sessionIndex].settings) {
      sessions[sessionIndex].settings = {};
    }
    
    sessions[sessionIndex].settings.finalAction = finalAction;
    
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error('Error setting session final action:', error);
    return false;
  }
};

/**
 * Get the final action for a session
 */
export const getSessionFinalAction = (sessionId: string): {
  type: 'none' | 'image' | 'coupon';
  image?: string;
  link?: string;
  coupon?: string;
} | null => {
  try {
    const session = getSessionById(sessionId);
    if (!session || !session.settings || !session.settings.finalAction) {
      return { type: 'none' };
    }
    
    return session.settings.finalAction;
  } catch (error) {
    console.error('Error getting session final action:', error);
    return { type: 'none' };
  }
};
