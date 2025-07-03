
interface ParticipantInfo {
  id: string;
  name: string;
  joinedAt: number;
  lastActive: number;
  active: boolean;
  hasVideo?: boolean;
  browserType?: string;
}

interface RoomInfo {
  roomId: string;
  participants: ParticipantInfo[];
  lastUpdated: number;
}

class HttpFallbackService {
  private baseUrl: string;
  private pollingInterval: number | null = null;
  private callbacks: {
    onParticipantsUpdate?: (participants: ParticipantInfo[]) => void;
    onError?: (error: string) => void;
  } = {};

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  async getRoomInfo(roomId: string): Promise<RoomInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/rooms/${roomId}/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 HTTP Fallback: Room info received:', data);
      
      return {
        roomId,
        participants: data.participants || [],
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('❌ HTTP Fallback: Error getting room info:', error);
      this.callbacks.onError?.(`Erro ao buscar informações da sala: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return null;
    }
  }

  async updateParticipantStatus(roomId: string, participantId: string, status: Partial<ParticipantInfo>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/rooms/${roomId}/participants/${participantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(status),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ HTTP Fallback: Participant status updated');
      return true;
    } catch (error) {
      console.error('❌ HTTP Fallback: Error updating participant status:', error);
      return false;
    }
  }

  startPolling(roomId: string, intervalMs: number = 3000) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    console.log(`🔄 HTTP Fallback: Starting polling for room ${roomId} every ${intervalMs}ms`);

    this.pollingInterval = window.setInterval(async () => {
      const roomInfo = await this.getRoomInfo(roomId);
      if (roomInfo && this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(roomInfo.participants);
      }
    }, intervalMs);

    // Get initial data
    this.getRoomInfo(roomId).then(roomInfo => {
      if (roomInfo && this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(roomInfo.participants);
      }
    });
  }

  stopPolling() {
    if (this.pollingInterval) {
      console.log('🛑 HTTP Fallback: Stopping polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  setCallbacks(callbacks: typeof this.callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  isPolling(): boolean {
    return this.pollingInterval !== null;
  }
}

export const httpFallbackService = new HttpFallbackService();
export default httpFallbackService;
