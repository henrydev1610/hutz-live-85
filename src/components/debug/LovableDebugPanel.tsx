// FASE 5: Painel de debug específico para limitações do Lovable

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { environmentDetector } from '@/utils/LovableEnvironmentDetector';

interface DebugInfo {
  environment: string;
  capabilities: any;
  webrtcWorks: boolean;
  mediaStreamWorks: boolean;
  userMediaWorks: boolean;
  activeStreams: number;
  events: string[];
}

export const LovableDebugPanel: React.FC<{ sessionId?: string | null }> = ({ sessionId }) => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    environment: 'unknown',
    capabilities: null,
    webrtcWorks: false,
    mediaStreamWorks: false,
    userMediaWorks: false,
    activeStreams: 0,
    events: []
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateDebugInfo = () => {
      const capabilities = environmentDetector.getCapabilities();
      
      setDebugInfo(prev => ({
        ...prev,
        environment: capabilities.environment,
        capabilities: capabilities
      }));
    };

    // Executar testes e atualizar info
    environmentDetector.runAllTests().then(() => {
      updateDebugInfo();
    });

    // Listener para eventos WebRTC
    const handleWebRTCEvent = (event: CustomEvent) => {
      setDebugInfo(prev => ({
        ...prev,
        events: [...prev.events.slice(-9), `${new Date().toLocaleTimeString()}: ${event.type} - ${JSON.stringify(event.detail)}`]
      }));
    };

    // Registrar listeners para debug
    const eventTypes = [
      'webrtc-state-change',
      'stream-received',
      'participant-stream-connected',
      'lovable-frame'
    ];

    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleWebRTCEvent as EventListener);
    });

    // Atualizar contador de streams ativas
    const updateActiveStreams = () => {
      const videoElements = document.querySelectorAll('video[srcObject], canvas[data-stream]');
      setDebugInfo(prev => ({ ...prev, activeStreams: videoElements.length }));
    };

    const interval = setInterval(updateActiveStreams, 1000);

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleWebRTCEvent as EventListener);
      });
      clearInterval(interval);
    };
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
        >
          🔧 Debug Lovable
        </button>
      </div>
    );
  }

  const getEnvironmentColor = () => {
    switch (debugInfo.environment) {
      case 'lovable': return 'bg-orange-500';
      case 'vercel': return 'bg-green-500';
      case 'local': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getCapabilityBadge = (works: boolean, label: string) => (
    <Badge variant={works ? "default" : "destructive"} className="text-xs">
      {works ? '✅' : '❌'} {label}
    </Badge>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="p-4 bg-black/80 text-white text-xs">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm">Lovable Debug Panel</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Ambiente */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${getEnvironmentColor()}`} />
            <span className="font-semibold">Ambiente: {debugInfo.environment.toUpperCase()}</span>
          </div>
          {debugInfo.capabilities?.isLovable && (
            <div className="text-yellow-400 text-xs">
              ⚠️ Limitações detectadas no Lovable
            </div>
          )}
        </div>

        {/* Capacidades */}
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1">Capacidades:</div>
          <div className="flex flex-wrap gap-1">
            {getCapabilityBadge(debugInfo.webrtcWorks, 'WebRTC')}
            {getCapabilityBadge(debugInfo.mediaStreamWorks, 'MediaStream')}
            {getCapabilityBadge(debugInfo.userMediaWorks, 'UserMedia')}
          </div>
        </div>

        {/* Status da Sessão */}
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1">Sessão:</div>
          <div className="text-xs text-gray-300">
            ID: {sessionId || 'N/A'}
          </div>
          <div className="text-xs text-gray-300">
            Streams Ativas: {debugInfo.activeStreams}
          </div>
        </div>

        {/* Limitações */}
        {debugInfo.capabilities?.limitations?.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold mb-1 text-red-400">Limitações:</div>
            <div className="text-xs text-red-300">
              {debugInfo.capabilities.limitations.map((limitation: string, index: number) => (
                <div key={index}>• {limitation}</div>
              ))}
            </div>
          </div>
        )}

        {/* Eventos Recentes */}
        <div>
          <div className="text-xs font-semibold mb-1">Eventos Recentes:</div>
          <div className="max-h-24 overflow-y-auto text-xs text-gray-300">
            {debugInfo.events.length === 0 ? (
              <div>Nenhum evento ainda...</div>
            ) : (
              debugInfo.events.map((event, index) => (
                <div key={index} className="text-xs break-all">
                  {event}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="mt-3 pt-2 border-t border-gray-600">
          <button
            onClick={() => environmentDetector.runAllTests()}
            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 mr-2"
          >
            🔄 Testar Novamente
          </button>
          <button
            onClick={() => setDebugInfo(prev => ({ ...prev, events: [] }))}
            className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
          >
            🗑️ Limpar Logs
          </button>
        </div>
      </Card>
    </div>
  );
};