import { create } from 'zustand';

export interface Participant {
  id: string;
  hasVideo: boolean;
  active: boolean;
  selected: boolean;
  lastActive: number;
}

interface ParticipantStore {
  participants: Record<string, Participant>;
  selectedCount: number;
  queue: string[];
  maxSelected: number;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearParticipants: () => void;
  setMaxSelected: (count: number) => void;
}

export const useParticipantStore = create<ParticipantStore>((set) => ({
  participants: {},
  selectedCount: 0,
  queue: [],
  maxSelected: 4,
  
  addParticipant: (participant) => {
    set((state) => {
      // If participant already exists, just update it
      if (state.participants[participant.id]) {
        return {
          participants: {
            ...state.participants,
            [participant.id]: {
              ...state.participants[participant.id],
              ...participant,
              selected: state.participants[participant.id].selected
            }
          }
        };
      }
      
      // Check if we should add to queue
      const totalParticipants = Object.keys(state.participants).length;
      if (totalParticipants >= 50) {
        return {
          queue: [...state.queue, participant.id]
        };
      }
      
      // Add new participant
      return {
        participants: {
          ...state.participants,
          [participant.id]: participant
        }
      };
    });
  },
  
  removeParticipant: (id) => {
    set((state) => {
      const newParticipants = { ...state.participants };
      const wasSelected = newParticipants[id]?.selected || false;
      delete newParticipants[id];
      
      // Pull from queue if someone was removed
      let newQueue = [...state.queue];
      let addedFromQueue = null;
      
      if (newQueue.length > 0) {
        addedFromQueue = newQueue.shift();
      }
      
      // Update selected count if needed
      const newSelectedCount = wasSelected 
        ? state.selectedCount - 1 
        : state.selectedCount;
      
      return {
        participants: newParticipants,
        selectedCount: newSelectedCount,
        queue: newQueue
      };
    });
  },
  
  toggleSelection: (id) => {
    set((state) => {
      if (!state.participants[id]) return state;
      
      const isCurrentlySelected = state.participants[id].selected;
      
      // If already selected, deselect
      if (isCurrentlySelected) {
        return {
          participants: {
            ...state.participants,
            [id]: {
              ...state.participants[id],
              selected: false
            }
          },
          selectedCount: state.selectedCount - 1
        };
      }
      
      // If trying to select more than max, don't select
      if (state.selectedCount >= state.maxSelected && !isCurrentlySelected) {
        return state;
      }
      
      // Select the participant
      return {
        participants: {
          ...state.participants,
          [id]: {
            ...state.participants[id],
            selected: true
          }
        },
        selectedCount: state.selectedCount + 1
      };
    });
  },
  
  clearParticipants: () => {
    set({ participants: {}, selectedCount: 0, queue: [] });
  },
  
  setMaxSelected: (count) => {
    set((state) => {
      // If new max is less than current selected, deselect participants
      if (count < state.selectedCount) {
        let remaining = count;
        const newParticipants = { ...state.participants };
        
        // Keep the most recently selected participants
        Object.keys(state.participants)
          .filter(id => state.participants[id].selected)
          .sort((a, b) => state.participants[b].lastActive - state.participants[a].lastActive)
          .forEach(id => {
            if (remaining > 0) {
              remaining--;
            } else {
              newParticipants[id] = {
                ...newParticipants[id],
                selected: false
              };
            }
          });
        
        return {
          maxSelected: count,
          participants: newParticipants,
          selectedCount: count
        };
      }
      
      return { maxSelected: count };
    });
  }
}));
