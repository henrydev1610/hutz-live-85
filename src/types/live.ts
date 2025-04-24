
export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  isVisible?: boolean;
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

export interface WebRTCConnection {
  id: string;
  peerConnection: RTCPeerConnection;
  stream: MediaStream | null;
}

export interface WebRTCSignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to?: string;
  sessionId: string;
  payload: any;
}
