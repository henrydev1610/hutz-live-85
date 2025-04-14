
export interface FlashlightPattern {
  intensity: number;  // 0-100%
  blinkRate: number;  // Hz
  color: string;      // Color value
}

export type CallToActionType = 'image' | 'imageWithButton' | 'coupon';

export interface TimelineItem {
  id: string;
  type: 'image' | 'flashlight' | 'callToAction';
  startTime: number;  // Seconds from start
  duration: number;   // Seconds
  imageUrl?: string;  // For image items
  backgroundColor?: string; // For color background items
  pattern?: FlashlightPattern;  // For flashlight items
  content?: {         // For callToAction items
    type: CallToActionType;
    imageUrl?: string;
    buttonText?: string;
    externalUrl?: string;
    couponCode?: string;
  };
}

export interface WaveformRegion {
  id: string;
  start: number;
  end: number;
  color: string;
  content: string;  // JSON stringified metadata
}
