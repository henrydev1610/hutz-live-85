
import { create } from 'zustand';

export type LayoutType = 'grid' | 'spotlight' | 'presentation';

export interface QRCodeSettings {
  visible: boolean;
  text: string;
  fontFamily: string;
  fontColor: string;
  position: { x: number; y: number };
  size: number;
}

export interface LayoutSettings {
  type: LayoutType;
  maxParticipants: number;
  backgroundColor: string;
  backgroundImage: string | null;
}

export type ActionType = 'none' | 'image' | 'coupon';

export interface ActionSettings {
  type: ActionType;
  imageUrl?: string;
  couponCode?: string;
  text?: string;
  linkUrl?: string;
}

interface SettingsStore {
  qrCodeSettings: QRCodeSettings;
  layoutSettings: LayoutSettings;
  actionSettings: ActionSettings;
  updateQRCodeSettings: (settings: Partial<QRCodeSettings>) => void;
  updateLayoutSettings: (settings: Partial<LayoutSettings>) => void;
  updateActionSettings: (settings: Partial<ActionSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  qrCodeSettings: {
    visible: false,
    text: 'Escaneie o QR Code para participar!',
    fontFamily: 'Inter',
    fontColor: '#ffffff',
    position: { x: 50, y: 50 },
    size: 200
  },
  
  layoutSettings: {
    type: 'grid',
    maxParticipants: 4,
    backgroundColor: '#000000',
    backgroundImage: null
  },
  
  actionSettings: {
    type: 'none'
  },
  
  updateQRCodeSettings: (settings) => {
    set((state) => ({
      qrCodeSettings: {
        ...state.qrCodeSettings,
        ...settings
      }
    }));
  },
  
  updateLayoutSettings: (settings) => {
    set((state) => ({
      layoutSettings: {
        ...state.layoutSettings,
        ...settings
      }
    }));
  },
  
  updateActionSettings: (settings) => {
    set((state) => ({
      actionSettings: {
        ...state.actionSettings,
        ...settings
      }
    }));
  },
  
  resetSettings: () => {
    set({
      qrCodeSettings: {
        visible: false,
        text: 'Escaneie o QR Code para participar!',
        fontFamily: 'Inter',
        fontColor: '#ffffff',
        position: { x: 50, y: 50 },
        size: 200
      },
      layoutSettings: {
        type: 'grid',
        maxParticipants: 4,
        backgroundColor: '#000000',
        backgroundImage: null
      },
      actionSettings: {
        type: 'none'
      }
    });
  }
}));
