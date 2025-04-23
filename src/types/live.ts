
export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
}

export interface LiveSessionOptions {
  maxParticipants: number;
  layout: number;
  backgroundColor: string;
  backgroundImage: string | null;
}

export interface QRCodeOptions {
  image: string;
  visible: boolean;
  position: { x: number; y: number };
  size: number;
  text: string;
  textPosition: { x: number; y: number };
  font: string;
  color: string;
}

export interface CallToAction {
  type: 'image' | 'coupon';
  image: string | null;
  text: string | null;
  link: string | null;
}
