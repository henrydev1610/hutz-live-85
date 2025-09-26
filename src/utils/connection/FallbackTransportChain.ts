import { getWebSocketURL } from '@/utils/connectionUtils';

export interface TransportAttempt {
  type: 'websocket' | 'polling' | 'longpolling';
  url: string;
  timeout: number;
  retries: number;
}

export class FallbackTransportChain {
  private attempts: TransportAttempt[] = [];
  private currentAttemptIndex = 0;
  private maxChainRetries = 3;
  private chainRetryCount = 0;

  constructor(private baseUrl?: string) {
    this.initializeChain();
  }

  private initializeChain(): void {
    const wsUrl = this.baseUrl || getWebSocketURL();
    
    this.attempts = [
      // Primary: WebSocket with extended timeout for Render.com
      {
        type: 'websocket',
        url: wsUrl,
        timeout: 120000, // 2 minutes for dormant servers
        retries: 2
      },
      // Fallback 1: HTTP Long-polling
      {
        type: 'longpolling',
        url: wsUrl.replace('wss://', 'https://').replace('ws://', 'http://'),
        timeout: 60000,
        retries: 3
      },
      // Fallback 2: Standard polling
      {
        type: 'polling',
        url: wsUrl.replace('wss://', 'https://').replace('ws://', 'http://'),
        timeout: 30000,
        retries: 5
      }
    ];
  }

  getCurrentAttempt(): TransportAttempt | null {
    if (this.currentAttemptIndex >= this.attempts.length) {
      return null;
    }
    return this.attempts[this.currentAttemptIndex];
  }

  moveToNextTransport(): TransportAttempt | null {
    this.currentAttemptIndex++;
    return this.getCurrentAttempt();
  }

  retryCurrentTransport(): boolean {
    const current = this.getCurrentAttempt();
    if (!current) return false;
    
    if (current.retries > 0) {
      current.retries--;
      return true;
    }
    
    return false;
  }

  resetChain(): void {
    if (this.chainRetryCount < this.maxChainRetries) {
      this.chainRetryCount++;
      this.currentAttemptIndex = 0;
      this.initializeChain();
      console.log(`🔄 [TRANSPORT] Chain retry ${this.chainRetryCount}/${this.maxChainRetries}`);
    }
  }

  isChainExhausted(): boolean {
    return this.currentAttemptIndex >= this.attempts.length && 
           this.chainRetryCount >= this.maxChainRetries;
  }

  getProgressInfo(): { current: number; total: number; type: string } {
    const current = this.getCurrentAttempt();
    return {
      current: this.currentAttemptIndex + 1,
      total: this.attempts.length,
      type: current?.type || 'exhausted'
    };
  }

  // Detect 502/504 errors as server warming indicators
  isServerWarmingError(error: any): boolean {
    if (typeof error === 'object' && error !== null) {
      const status = error.status || error.code;
      return status === 502 || status === 504 || 
             (typeof error.message === 'string' && 
              (error.message.includes('502') || error.message.includes('504')));
    }
    return false;
  }

  // Add jitter to prevent thundering herd
  getJitteredDelay(baseDelay: number): number {
    const jitter = Math.random() * 0.3; // 30% jitter
    return Math.floor(baseDelay * (1 + jitter));
  }
}

// Singleton instance for app-wide use
export const fallbackTransportChain = new FallbackTransportChain();