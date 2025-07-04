
export class ParticipantManager {
  private participants: Map<string, any> = new Map();
  private onParticipantJoinCallback: ((participantId: string) => void) | null = null;

  setOnParticipantJoinCallback(callback: (participantId: string) => void) {
    this.onParticipantJoinCallback = callback;
    console.log('👤 Participant join callback set');
  }

  addParticipant(participantId: string, data: any) {
    const participant = {
      id: participantId,
      name: data.userName || `Participante ${participantId.substring(0, 4)}`,
      joinedAt: data.timestamp || Date.now(),
      lastActive: Date.now(),
      active: true,
      hasVideo: false,
      selected: false,
      browserType: data.browserType || 'unknown'
    };
    
    console.log('➕ Adding participant:', participantId);
    this.participants.set(participantId, participant);
    this.notifyParticipantsChanged();
  }

  removeParticipant(participantId: string) {
    if (this.participants.has(participantId)) {
      this.participants.delete(participantId);
      this.notifyParticipantsChanged();
    }
  }

  updateParticipantsList(participants: any[]) {
    console.log('🔄 Updating participants list with:', participants);
    
    this.participants.clear();
    
    participants.forEach(participant => {
      const participantId = participant.userId || participant.id || participant.socketId;
      const participantData = {
        id: participantId,
        name: participant.userName || participant.name || `Participante ${participantId?.substring(0, 4) || 'Unknown'}`,
        joinedAt: participant.joinedAt || Date.now(),
        lastActive: participant.lastActive || Date.now(),
        active: participant.active !== false,
        hasVideo: participant.hasVideo || false,
        selected: false,
        browserType: participant.browserType || 'unknown'
      };
      
      this.participants.set(participantId, participantData);
      console.log(`📝 Updated participant: ${participantId}`);
      
      if (this.onParticipantJoinCallback) {
        this.onParticipantJoinCallback(participantId);
      }
    });
    
    this.notifyParticipantsChanged();
  }

  selectParticipant(participantId: string) {
    console.log(`👁️ Selecting participant: ${participantId}`);
    
    this.participants.forEach(participant => {
      participant.selected = false;
    });
    
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.selected = true;
      console.log(`✅ Participant ${participantId} selected`);
    }
    
    this.notifyParticipantsChanged();
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  private notifyParticipantsChanged() {
    const participantsList = Array.from(this.participants.values());
    console.log('📢 Notifying participants change:', participantsList.length);
    
    window.dispatchEvent(new CustomEvent('participants-updated', {
      detail: { participants: participantsList }
    }));
  }

  cleanup() {
    this.participants.clear();
  }
}
