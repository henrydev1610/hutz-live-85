
import { create } from 'zustand';

export interface Participant {
  id: string;
  hasVideo: boolean;
  active: boolean;
  selected: boolean;
  lastActive: number;
  streamUrl?: string;
}

interface ParticipantState {
  participants: Record<string, Participant>;
  selectedParticipants: string[];
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  toggleParticipantSelection: (id: string) => void;
  clearParticipants: () => void;
  getSelectedParticipants: () => Participant[];
}

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  participants: {},
  selectedParticipants: [],

  addParticipant: (participant: Participant) => set((state) => {
    // Only update if participant doesn't exist or has changes
    const existing = state.participants[participant.id];
    if (!existing || 
        existing.hasVideo !== participant.hasVideo || 
        existing.active !== participant.active) {
      return {
        participants: {
          ...state.participants,
          [participant.id]: {
            ...participant,
            // Preserve selection state if participant already exists
            selected: existing ? existing.selected : participant.selected
          }
        }
      };
    }
    return state;
  }),

  removeParticipant: (id: string) => set((state) => {
    const { [id]: removed, ...remainingParticipants } = state.participants;
    const selectedParticipants = state.selectedParticipants.filter(
      (participantId) => participantId !== id
    );
    return {
      participants: remainingParticipants,
      selectedParticipants
    };
  }),

  toggleParticipantSelection: (id: string) => set((state) => {
    const participant = state.participants[id];
    if (!participant) return state;

    const isSelected = participant.selected;
    const updatedParticipants = {
      ...state.participants,
      [id]: {
        ...participant,
        selected: !isSelected
      }
    };

    // Update selected participants list
    let selectedParticipants = [...state.selectedParticipants];
    if (!isSelected) {
      // Add to selected if not already there
      if (!selectedParticipants.includes(id)) {
        selectedParticipants.push(id);
      }
    } else {
      // Remove from selected
      selectedParticipants = selectedParticipants.filter(
        (participantId) => participantId !== id
      );
    }

    return {
      participants: updatedParticipants,
      selectedParticipants
    };
  }),

  clearParticipants: () => set({
    participants: {},
    selectedParticipants: []
  }),

  getSelectedParticipants: () => {
    const state = get();
    return state.selectedParticipants
      .filter(id => state.participants[id])
      .map(id => state.participants[id]);
  }
}));
