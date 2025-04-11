
export interface FlashlightPattern {
  intensity: number;  // 0-100%
  blinkRate: number;  // Hz
  color: string;      // Color value
}

export interface TimelineItem {
  id: string;
  type: 'image' | 'flashlight';
  startTime: number;  // Seconds from start
  duration: number;   // Seconds
  imageUrl?: string;  // For image items
  backgroundColor?: string; // For color background items
  pattern?: FlashlightPattern;  // For flashlight items
}

export interface WaveformRegion {
  id: string;
  start: number;
  end: number;
  color: string;
  content: string;  // JSON stringified metadata
}
