import { Participant } from '@/types/live';

/**
 * Helper function to merge participants with existing streams
 * 
 * @param newParticipants - The incoming participant data
 * @param currentParticipants - The current participants with their streams
 * @returns - Merged participants with preserved streams
 */
export const mergeParticipantsWithStreams = (
  newParticipants: Partial<Participant>[],
  currentParticipants: Participant[]
): Participant[] => {
  // Create a map of existing participants with their streams for reference
  const existingParticipantMap = new Map<string, MediaStream | null>();
  
  currentParticipants.forEach(p => {
    if (p.stream) {
      existingParticipantMap.set(p.id, p.stream);
    }
  });
  
  // Merge incoming participants with existing stream data
  return newParticipants.map(newP => {
    if (!newP.id) {
      console.warn('[participantUtils] Participant without ID detected', newP);
      return {
        id: `unknown-${Date.now()}`,
        name: newP.name || 'Unknown',
        stream: newP.stream || null,
        isVisible: newP.isVisible !== undefined ? newP.isVisible : true
      };
    }
    
    // Keep the stream if we already have it
    const existingStream = existingParticipantMap.get(newP.id);
    
    return {
      id: newP.id,
      name: newP.name || `Participant ${newP.id.substring(0, 5)}`,
      stream: newP.stream || existingStream || null,
      isVisible: newP.isVisible !== undefined ? newP.isVisible : true
    };
  });
};

/**
 * Debounce function to limit how often a function is called
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Check if a stream is valid and has active tracks
 */
export const isValidStream = (stream: MediaStream | null): boolean => {
  if (!stream) return false;
  
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  return (videoTracks.length > 0 || audioTracks.length > 0) && 
         videoTracks.some(track => track.readyState === 'live');
};
