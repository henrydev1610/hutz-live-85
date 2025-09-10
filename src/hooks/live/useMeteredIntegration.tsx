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

// Função para carregar SDK da Metered dinamicamente (simulação por enquanto)
export const loadMeteredSDK = async (): Promise<any> => {
  try {
    // Por enquanto, simulamos o SDK até instalar o pacote oficial
    const MeteredSDK = class {
      constructor(config: any) {
        console.log('Simulated Metered SDK initialized with:', config);
        this.config = config;
        this.eventHandlers = new Map();
      }

      config: any;
      eventHandlers: Map<string, Function>;

      on(event: string, handler: Function) {
        this.eventHandlers.set(event, handler);
      }

      async joinRoom() {
        console.log('Simulated: Joining room...');
        setTimeout(() => {
          const handler = this.eventHandlers.get('joinedRoom');
          if (handler) handler();
        }, 1000);
      }

      async leaveRoom() {
        console.log('Simulated: Leaving room...');
        const handler = this.eventHandlers.get('leftRoom');
        if (handler) handler();
      }

      async startVideo() {
        console.log('Simulated: Starting video...');
        setTimeout(() => {
          const handler = this.eventHandlers.get('localTrackUpdated');
          if (handler) handler({ kind: 'video' });
        }, 500);
      }
    };

    console.log('Simulated Metered SDK loaded');
    return MeteredSDK;
  } catch (error) {
    console.error('Failed to load Metered SDK:', error);
    throw error;
  }
};