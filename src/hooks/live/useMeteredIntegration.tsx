import { useState, useEffect } from 'react';

interface MeteredConfig {
  useMetered: boolean;
  accountDomain: string;
  roomNamePrefix: string;
}

export const useMeteredIntegration = (): MeteredConfig => {
  const [config, setConfig] = useState<MeteredConfig>({
    useMetered: false,
    accountDomain: '',
    roomNamePrefix: ''
  });

  useEffect(() => {
    const useMeteredRooms = import.meta.env.VITE_USE_METERED_ROOMS === 'true';
    const accountDomain = import.meta.env.VITE_METERED_ACCOUNT_DOMAIN || '';
    const roomNamePrefix = import.meta.env.VITE_ROOM_NAME_PREFIX || '';

    setConfig({
      useMetered: useMeteredRooms,
      accountDomain,
      roomNamePrefix
    });

    console.log('Metered Integration Config:', {
      useMetered: useMeteredRooms,
      accountDomain,
      roomNamePrefix
    });
  }, []);

  return config;
};

// Função para carregar SDK da Metered dinamicamente
export const loadMeteredSDK = async (): Promise<any> => {
  try {
    // Carregar SDK oficial da Metered
    const { Metered } = await import('@metered/sdk');
    console.log('Official Metered SDK loaded');
    return Metered;
  } catch (error) {
    console.warn('Official Metered SDK not available, using fallback:', error);
    
    // Fallback para SDK simulado caso o oficial não esteja disponível
    const MeteredSDK = class {
      constructor(config: any) {
        console.log('Fallback Metered SDK initialized with:', config);
        this.config = config;
        this.eventHandlers = new Map();
      }

      config: any;
      eventHandlers: Map<string, Function>;

      on(event: string, handler: Function) {
        this.eventHandlers.set(event, handler);
      }

      async joinRoom() {
        console.log('Fallback: Joining room...');
        setTimeout(() => {
          const handler = this.eventHandlers.get('joinedRoom');
          if (handler) handler();
        }, 1000);
      }

      async leaveRoom() {
        console.log('Fallback: Leaving room...');
        const handler = this.eventHandlers.get('leftRoom');
        if (handler) handler();
      }

      async startVideo() {
        console.log('Fallback: Starting video...');
        setTimeout(() => {
          const handler = this.eventHandlers.get('localTrackUpdated');
          if (handler) handler({ kind: 'video' });
        }, 500);
      }
    };

    return MeteredSDK;
  }
};