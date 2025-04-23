
import { useParticipantStore } from '@/stores/participantStore';

export interface SessionParticipant {
  id: string;
  hasVideo: boolean;
  active: boolean;
  lastActive: number;
}

// Add a participant to the session
export const addParticipantToSession = (
  sessionId: string,
  participant: SessionParticipant
): void => {
  try {
    const { addParticipant } = useParticipantStore.getState();
    
    addParticipant({
      id: participant.id,
      hasVideo: participant.hasVideo,
      active: true,
      selected: false,
      lastActive: Date.now()
    });
    
  } catch (error) {
    console.error('Error adding participant to session:', error);
  }
};

// Update a participant's status
export const updateParticipantStatus = (
  sessionId: string,
  participantId: string,
  updates: Partial<SessionParticipant>
): void => {
  try {
    const { participants, addParticipant } = useParticipantStore.getState();
    
    if (participants[participantId]) {
      addParticipant({
        ...participants[participantId],
        ...updates,
        id: participantId,
        lastActive: Date.now()
      });
    }
  } catch (error) {
    console.error('Error updating participant status:', error);
  }
};
