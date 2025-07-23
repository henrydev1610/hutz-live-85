
// Sistema central de logs para debug de stream
export enum StreamLogLevel {
  STREAM_START = 'STREAM_START',
  STREAM_SUCCESS = 'STREAM_SUCCESS', 
  STREAM_ERROR = 'STREAM_ERROR',
  WEBRTC_SEND = 'WEBRTC_SEND',
  WEBRTC_RECEIVE = 'WEBRTC_RECEIVE',
  DOM_UPDATE = 'DOM_UPDATE',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  DEVICE_ENUM = 'DEVICE_ENUM',
  CONSTRAINTS = 'CONSTRAINTS',
  TRACK_EVENT = 'TRACK_EVENT'
}

export interface StreamDetails {
  streamId?: string;
  active?: boolean;
  videoTracks?: number;
  audioTracks?: number;
  totalTracks?: number;
  facingMode?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  deviceId?: string;
  label?: string;
  kind?: string;
  readyState?: string;
  enabled?: boolean;
}

export interface PerformanceMetrics {
  timestamp: number;
  duration?: number;
  attempt?: number;
  totalAttempts?: number;
  retryCount?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkLatency?: number;
  constraintsUsed?: string;
  errorType?: string;
  stackTrace?: string;
}

export interface StreamLogContext {
  sessionId?: string;
  participantId: string;
  isMobile: boolean;
  deviceType: string;
  timestamp: number;
  performance: PerformanceMetrics;
  streamDetails?: StreamDetails;
  message: string;
  level: StreamLogLevel;
  phase: string;
  additionalData?: any;
}

export interface StreamLogEntry {
  id: string;
  context: StreamLogContext;
  consoleOutput: string;
  colorCode: string;
  icon: string;
}

class StreamLogger {
  private logs: StreamLogEntry[] = [];
  private maxLogs = 1000;
  private enabledLevels: Set<StreamLogLevel> = new Set(Object.values(StreamLogLevel));
  private listeners: ((log: StreamLogEntry) => void)[] = [];
  private sessionStartTime = Date.now();

  constructor() {
    this.startPerformanceMonitoring();
  }

  private startPerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        this.logPerformanceMetrics();
      }, 5000);
    }
  }

  private logPerformanceMetrics(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory;
      if (memory) {
        this.log(StreamLogLevel.VALIDATION, 'system', false, 'desktop', {
          timestamp: Date.now(),
          duration: 0,
          memoryUsage: memory.usedJSHeapSize,
        }, undefined, 'PERFORMANCE', 'Performance metrics captured');
      }
    }
  }

  private generateId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogColor(level: StreamLogLevel): string {
    const colors = {
      [StreamLogLevel.STREAM_START]: '#3B82F6',
      [StreamLogLevel.STREAM_SUCCESS]: '#10B981',
      [StreamLogLevel.STREAM_ERROR]: '#EF4444',
      [StreamLogLevel.WEBRTC_SEND]: '#8B5CF6',
      [StreamLogLevel.WEBRTC_RECEIVE]: '#F59E0B',
      [StreamLogLevel.DOM_UPDATE]: '#06B6D4',
      [StreamLogLevel.VALIDATION]: '#84CC16',
      [StreamLogLevel.PERMISSION]: '#F97316',
      [StreamLogLevel.DEVICE_ENUM]: '#EC4899',
      [StreamLogLevel.CONSTRAINTS]: '#6366F1',
      [StreamLogLevel.TRACK_EVENT]: '#14B8A6'
    };
    return colors[level] || '#6B7280';
  }

  private getLogIcon(level: StreamLogLevel): string {
    const icons = {
      [StreamLogLevel.STREAM_START]: '🎬',
      [StreamLogLevel.STREAM_SUCCESS]: '✅',
      [StreamLogLevel.STREAM_ERROR]: '❌',
      [StreamLogLevel.WEBRTC_SEND]: '📤',
      [StreamLogLevel.WEBRTC_RECEIVE]: '📥',
      [StreamLogLevel.DOM_UPDATE]: '🖥️',
      [StreamLogLevel.VALIDATION]: '🔍',
      [StreamLogLevel.PERMISSION]: '🔐',
      [StreamLogLevel.DEVICE_ENUM]: '📱',
      [StreamLogLevel.CONSTRAINTS]: '⚙️',
      [StreamLogLevel.TRACK_EVENT]: '🎥'
    };
    return icons[level] || '📋';
  }

  log(
    level: StreamLogLevel,
    participantId: string,
    isMobile: boolean,
    deviceType: string,
    performance: PerformanceMetrics,
    streamDetails?: StreamDetails,
    phase: string = 'UNKNOWN',
    message: string = '',
    additionalData?: any
  ): void {
    if (!this.enabledLevels.has(level)) {
      return;
    }

    const context: StreamLogContext = {
      sessionId: sessionStorage.getItem('currentSessionId') || undefined,
      participantId,
      isMobile,
      deviceType,
      timestamp: Date.now(),
      performance,
      streamDetails,
      message,
      level,
      phase,
      additionalData
    };

    const icon = this.getLogIcon(level);
    const colorCode = this.getLogColor(level);
    const elapsedTime = ((Date.now() - this.sessionStartTime) / 1000).toFixed(2);
    
    const consoleOutput = `${icon} [${elapsedTime}s] ${level} | ${phase} | ${participantId} | ${deviceType} | ${message}`;

    const logEntry: StreamLogEntry = {
      id: this.generateId(),
      context,
      consoleOutput,
      colorCode,
      icon
    };

    this.logs.push(logEntry);
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output no console com cor
    if (typeof window !== 'undefined' && window.console) {
      const style = `color: ${colorCode}; font-weight: bold;`;
      console.log(`%c${consoleOutput}`, style);
      
      // Log detalhado se houver dados adicionais
      if (streamDetails || additionalData) {
        console.log(`%c${icon} DETAILS:`, style, {
          context,
          streamDetails,
          additionalData
        });
      }
    }

    // Notificar listeners
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (error) {
        console.error('Error in stream logger listener:', error);
      }
    });
  }

  // Métodos de conveniência para diferentes fases
  logStreamStart(participantId: string, isMobile: boolean, deviceType: string, constraints: any): void {
    this.log(
      StreamLogLevel.STREAM_START,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'ACQUISITION',
      'Starting stream acquisition',
      { constraints }
    );
  }

  logStreamSuccess(participantId: string, isMobile: boolean, deviceType: string, stream: MediaStream, duration: number): void {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    const settings = videoTrack?.getSettings();

    this.log(
      StreamLogLevel.STREAM_SUCCESS,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration },
      {
        streamId: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        totalTracks: stream.getTracks().length,
        facingMode: settings?.facingMode,
        width: settings?.width,
        height: settings?.height,
        frameRate: settings?.frameRate,
        deviceId: settings?.deviceId,
        label: videoTrack?.label
      },
      'ACQUISITION',
      'Stream acquired successfully'
    );
  }

  logStreamError(participantId: string, isMobile: boolean, deviceType: string, error: Error, attempt: number): void {
    this.log(
      StreamLogLevel.STREAM_ERROR,
      participantId,
      isMobile,
      deviceType,
      { 
        timestamp: Date.now(), 
        duration: 0,
        attempt,
        errorType: error.name,
        stackTrace: error.stack
      },
      undefined,
      'ACQUISITION',
      `Stream acquisition failed: ${error.message}`,
      { error: error.toString() }
    );
  }

  logWebRTCSend(participantId: string, isMobile: boolean, deviceType: string, stream: MediaStream): void {
    this.log(
      StreamLogLevel.WEBRTC_SEND,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      {
        streamId: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      },
      'WEBRTC',
      'Stream sent via WebRTC'
    );
  }

  logWebRTCReceive(participantId: string, isMobile: boolean, deviceType: string, stream: MediaStream): void {
    this.log(
      StreamLogLevel.WEBRTC_RECEIVE,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      {
        streamId: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      },
      'WEBRTC',
      'Stream received via WebRTC'
    );
  }

  logDOMUpdate(participantId: string, isMobile: boolean, deviceType: string, videoElement: HTMLVideoElement): void {
    this.log(
      StreamLogLevel.DOM_UPDATE,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        readyState: videoElement.readyState.toString()
      },
      'DOM',
      'Video element updated'
    );
  }

  logValidation(participantId: string, isMobile: boolean, deviceType: string, result: boolean, details: any): void {
    this.log(
      StreamLogLevel.VALIDATION,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'VALIDATION',
      `Stream validation ${result ? 'passed' : 'failed'}`,
      details
    );
  }

  logPermission(participantId: string, isMobile: boolean, deviceType: string, status: string): void {
    this.log(
      StreamLogLevel.PERMISSION,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'PERMISSION',
      `Permission status: ${status}`
    );
  }

  logDeviceEnumeration(participantId: string, isMobile: boolean, deviceType: string, devices: MediaDeviceInfo[]): void {
    this.log(
      StreamLogLevel.DEVICE_ENUM,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'DEVICE',
      `Found ${devices.length} devices`,
      { devices: devices.map(d => ({ kind: d.kind, label: d.label })) }
    );
  }

  logConstraints(participantId: string, isMobile: boolean, deviceType: string, constraints: MediaStreamConstraints, attempt: number): void {
    this.log(
      StreamLogLevel.CONSTRAINTS,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0, attempt },
      undefined,
      'CONSTRAINTS',
      `Applying constraints (attempt ${attempt})`,
      { constraints }
    );
  }

  logTrackEvent(participantId: string, isMobile: boolean, deviceType: string, event: string, track: MediaStreamTrack): void {
    this.log(
      StreamLogLevel.TRACK_EVENT,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      {
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
        label: track.label
      },
      'TRACK',
      `Track event: ${event}`
    );
  }

  // Métodos de controle
  setEnabledLevels(levels: StreamLogLevel[]): void {
    this.enabledLevels = new Set(levels);
  }

  addListener(listener: (log: StreamLogEntry) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (log: StreamLogEntry) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  getLogs(): StreamLogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: StreamLogLevel): StreamLogEntry[] {
    return this.logs.filter(log => log.context.level === level);
  }

  getLogsByParticipant(participantId: string): StreamLogEntry[] {
    return this.logs.filter(log => log.context.participantId === participantId);
  }

  getLogsByPhase(phase: string): StreamLogEntry[] {
    return this.logs.filter(log => log.context.phase === phase);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Análise de performance
  getPerformanceAnalysis(): any {
    const streamStartLogs = this.getLogsByLevel(StreamLogLevel.STREAM_START);
    const streamSuccessLogs = this.getLogsByLevel(StreamLogLevel.STREAM_SUCCESS);
    const streamErrorLogs = this.getLogsByLevel(StreamLogLevel.STREAM_ERROR);

    const avgDuration = streamSuccessLogs.length > 0 
      ? streamSuccessLogs.reduce((sum, log) => sum + (log.context.performance.duration || 0), 0) / streamSuccessLogs.length
      : 0;

    const successRate = streamStartLogs.length > 0
      ? (streamSuccessLogs.length / streamStartLogs.length) * 100
      : 0;

    const errorsByType = streamErrorLogs.reduce((acc, log) => {
      const errorType = log.context.performance.errorType || 'Unknown';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAttempts: streamStartLogs.length,
      successfulAttempts: streamSuccessLogs.length,
      failedAttempts: streamErrorLogs.length,
      successRate: successRate.toFixed(2) + '%',
      avgDuration: avgDuration.toFixed(2) + 'ms',
      errorsByType,
      totalLogs: this.logs.length
    };
  }
}

// Instância singleton
export const streamLogger = new StreamLogger();

// Função de conveniência para uso rápido
export const logStream = streamLogger.log.bind(streamLogger);

export default streamLogger;
