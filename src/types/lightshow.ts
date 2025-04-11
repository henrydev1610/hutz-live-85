
export interface FlashlightPattern {
  intensity: number;  // 0-100%
  blinkRate: number;  // Hz
  color: string;      // Color value
}

export type MediaTrackType = 'audio' | 'image' | 'flashlight' | 'background';

export interface TimelineItem {
  id: string;
  type: MediaTrackType;
  startTime: number;  // Seconds from start
  duration: number;   // Seconds
  imageUrl?: string;  // For image items
  pattern?: FlashlightPattern;  // For flashlight items
  backgroundColor?: string;  // For background items
}

export interface WaveformRegion {
  id: string;
  start: number;
  end: number;
  color: string;
  content: string;  // JSON stringified metadata
}

export interface TrackConfig {
  id: string;
  name: string;
  type: MediaTrackType;
  color: string;
  visible: boolean;
}
