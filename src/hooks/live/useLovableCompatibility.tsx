// FASE 1+3: Hook para gerenciar compatibilidade com ambiente Lovable

import { useEffect, useRef, useState } from 'react';
import { environmentDetector } from '@/utils/LovableEnvironmentDetector';
import { lovableBridge } from '@/utils/LovableWebRTCBridge';

interface LovableCompatibilityState {
  isLovable: boolean;
  requiresFallback: boolean;
  capabilities: any;
  isInitialized: boolean;
  fallbackMode: 'none' | 'canvas' | 'http' | 'disabled';
}

export const useLovableCompatibility = () => {
  const [state, setState] = useState<LovableCompatibilityState>({
    isLovable: false,
    requiresFallback: false,
    capabilities: null,
    isInitialized: false,
    fallbackMode: 'none'
  });

  const initializationRef = useRef(false);

  // Inicialização assíncrona
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeCompatibility = async () => {
      console.log('🚀 LOVABLE COMPATIBILITY: Inicializando...');

      // Executar testes de capacidade
      await environmentDetector.runAllTests();
      const capabilities = environmentDetector.getCapabilities();

      // Determinar modo de fallback
      let fallbackMode: LovableCompatibilityState['fallbackMode'] = 'none';
      
      if (environmentDetector.isLovable()) {
        if (!capabilities.supportsMediaStream) {
          fallbackMode = 'canvas';  // Canvas frames
        } else if (!capabilities.supportsDirectWebRTC) {
          fallbackMode = 'http';    // HTTP streaming
        }
      }

      setState({
        isLovable: environmentDetector.isLovable(),
        requiresFallback: environmentDetector.requiresFallback(),
        capabilities,
        isInitialized: true,
        fallbackMode
      });

      console.log('✅ LOVABLE COMPATIBILITY: Inicializado', {
        isLovable: environmentDetector.isLovable(),
        fallbackMode,
        capabilities: capabilities.limitations
      });
    };

    initializeCompatibility();
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (state.isLovable) {
        lovableBridge.cleanupAll();
        console.log('🧹 LOVABLE COMPATIBILITY: Cleanup realizado');
      }
    };
  }, [state.isLovable]);

  // Função para processar stream baseado no ambiente
  const processStreamForEnvironment = async (participantId: string, stream: MediaStream) => {
    if (!state.isInitialized) {
      console.warn('⚠️ LOVABLE COMPATIBILITY: Não inicializado ainda');
      return;
    }

    console.log(`🔄 LOVABLE COMPATIBILITY: Processando stream para ${participantId}`, {
      fallbackMode: state.fallbackMode,
      isLovable: state.isLovable
    });

    switch (state.fallbackMode) {
      case 'canvas':
        console.log(`🎨 CANVAS MODE: Convertendo stream para canvas - ${participantId}`);
        await lovableBridge.convertStreamToTransferable(participantId, stream);
        break;
        
      case 'http':
        console.log(`🌐 HTTP MODE: Implementando HTTP streaming - ${participantId}`);
        // TODO: Implementar HTTP streaming fallback
        break;
        
      case 'none':
      default:
        console.log(`✅ DIRECT MODE: Usando WebRTC direto - ${participantId}`);
        // Modo padrão, sem processamento adicional
        break;
    }
  };

  // Função para criar elemento de vídeo compatível
  const createCompatibleVideoElement = (container: HTMLElement, participantId: string): HTMLElement | null => {
    if (!state.isInitialized) return null;

    switch (state.fallbackMode) {
      case 'canvas':
        console.log(`🎨 Criando canvas renderer para ${participantId}`);
        return lovableBridge.setupLovableVideoElement(container, participantId);
        
      case 'http':
        console.log(`🌐 Criando HTTP video element para ${participantId}`);
        // TODO: Implementar elemento HTTP
        return null;
        
      case 'none':
      default:
        console.log(`🎥 Criando video element padrão para ${participantId}`);
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.controls = false;
        video.className = 'w-full h-full object-cover absolute inset-0 z-10';
        container.appendChild(video);
        return video;
    }
  };

  // Função para cleanup de participante
  const cleanupParticipant = (participantId: string) => {
    if (state.isLovable) {
      lovableBridge.cleanup(participantId);
    }
  };

  return {
    ...state,
    processStreamForEnvironment,
    createCompatibleVideoElement,
    cleanupParticipant,
    
    // Helpers
    shouldUseFallback: state.requiresFallback,
    isCanvasMode: state.fallbackMode === 'canvas',
    isHttpMode: state.fallbackMode === 'http',
    isDirectMode: state.fallbackMode === 'none'
  };
};