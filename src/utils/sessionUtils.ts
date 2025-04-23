
import type { Participant } from '@/stores/participantStore';

export interface SessionParticipant {
  id: string;
  hasVideo: boolean;
  active: boolean;
  lastActive: number;
}

// Convert SessionParticipant to store Participant format
export const formatParticipantForStore = (
  participant: SessionParticipant
): Participant => {
  return {
    id: participant.id,
    hasVideo: participant.hasVideo,
    active: true,
    selected: false,
    lastActive: Date.now()
  };
};

// Helper function to safely handle participant updates
export const getUpdatedParticipant = (
  currentParticipant: Participant | undefined,
  updates: Partial<SessionParticipant>
): Participant => {
  if (!currentParticipant) {
    // Create new participant if it doesn't exist
    return {
      id: updates.id || '',
      hasVideo: updates.hasVideo || false,
      active: updates.active || false,
      selected: false,
      lastActive: Date.now()
    };
  }

  // Update existing participant
  return {
    ...currentParticipant,
    ...updates,
    id: currentParticipant.id, // Always preserve the original ID
    lastActive: Date.now()
  };
};
