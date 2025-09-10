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
    // Verifica se o SDK já está carregado
    if (typeof window !== 'undefined' && (window as any).Metered) {
      console.log('Metered SDK already loaded');
      return (window as any).Metered;
    }

    // Carrega o SDK oficial da Metered via CDN
    await loadMeteredScript();
    
    // Aguarda o SDK estar disponível
    return new Promise((resolve, reject) => {
      const checkSDK = () => {
        if ((window as any).Metered) {
          console.log('Metered SDK loaded successfully');
          resolve((window as any).Metered);
        } else {
          setTimeout(checkSDK, 100);
        }
      };
      checkSDK();
      
      // Timeout após 10 segundos
      setTimeout(() => {
        reject(new Error('Timeout loading Metered SDK'));
      }, 10000);
    });
  } catch (error) {
    console.error('Failed to load Metered SDK:', error);
    console.log('Using fallback Metered SDK implementation');
    
    // Implementação fallback que simula o SDK da Metered
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

      async startAudio() {
        console.log('Fallback: Starting audio...');
        setTimeout(() => {
          const handler = this.eventHandlers.get('localTrackUpdated');
          if (handler) handler({ kind: 'audio' });
        }, 500);
      }
    };

    return { Meeting: MeteredSDK };
  }
};

// Função para carregar o script do SDK via CDN
const loadMeteredScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Verifica se já existe um script carregado
    const existingScript = document.querySelector('script[src*="cdn.metered.ca"]');
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.metered.ca/sdk/video/1.4.6/sdk.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Metered SDK script'));
    
    document.head.appendChild(script);
  });
};