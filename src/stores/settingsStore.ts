
import { create } from 'zustand';

export interface QrCodeSettings {
  isVisible: boolean;
  position: { x: number; y: number };
  size: number;
  text: string;
  fontFamily: string;
  textColor: string;
}

export interface ActionSettings {
  type: 'image' | 'coupon' | 'none';
  imageUrl?: string;
  couponCode?: string;
  linkUrl?: string;
  text?: string;
}

interface SettingsState {
  layoutMaxParticipants: number;
  backgroundColor: string;
  backgroundImageUrl: string | null;
  qrCode: QrCodeSettings;
  actionSettings: ActionSettings;
  
  setMaxParticipants: (count: number) => void;
  setBackgroundColor: (color: string) => void;
  setBackgroundImage: (url: string | null) => void;
  
  updateQrCode: (settings: Partial<QrCodeSettings>) => void;
  toggleQrCodeVisibility: () => void;
  
  updateActionSettings: (settings: Partial<ActionSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  layoutMaxParticipants: 4,
  backgroundColor: '#121212',
  backgroundImageUrl: null,
  qrCode: {
    isVisible: false,
    position: { x: 50, y: 50 },
    size: 150,
    text: "Escaneie o QR Code para participar",
    fontFamily: "Arial",
    textColor: "#FFFFFF"
  },
  actionSettings: {
    type: 'none',
    imageUrl: '',
    couponCode: '',
    linkUrl: '',
    text: ''
  },

  // Add placeholder implementations for methods
  setMaxParticipants: () => {},
  setBackgroundColor: () => {},
  setBackgroundImage: () => {},
  updateQrCode: () => {},
  toggleQrCodeVisibility: () => {},
  updateActionSettings: () => {},
  resetSettings: () => {}
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,

  setMaxParticipants: (count: number) => set({
    layoutMaxParticipants: count
  }),

  setBackgroundColor: (color: string) => set({
    backgroundColor: color,
    backgroundImageUrl: null // Clear image when setting color
  }),

  setBackgroundImage: (url: string | null) => set({
    backgroundImageUrl: url,
    // Don't clear backgroundColor, as it can be used as a fallback
  }),

  updateQrCode: (settings: Partial<QrCodeSettings>) => set(state => ({
    qrCode: {
      ...state.qrCode,
      ...settings
    }
  })),

  toggleQrCodeVisibility: () => set(state => ({
    qrCode: {
      ...state.qrCode,
      isVisible: !state.qrCode.isVisible
    }
  })),

  updateActionSettings: (settings: Partial<ActionSettings>) => set(state => ({
    actionSettings: {
      ...state.actionSettings,
      ...settings
    }
  })),

  resetSettings: () => set(DEFAULT_SETTINGS)
}));
