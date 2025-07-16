import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { streamSynchronizer } from '@/utils/StreamSynchronizer';
import { Participant } from './ParticipantGrid';

interface StreamDebugPanelProps {
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
  onForceRefresh?: () => void;
  transmissionWindowRef?: React.MutableRefObject<Window | null>;
  onForceStreamUpdate?: () => void;
}

const StreamDebugPanel: React.FC<StreamDebugPanelProps> = ({
  participantList,
  participantStreams,
  onForceRefresh,
  transmissionWindowRef,
  onForceStreamUpdate
}) => {
  const [debugInfo, setDebugInfo] = useState(streamSynchronizer.getDebugInfo());
  const [isVisible, setIsVisible] = useState(false);
  const [transmissionStatus, setTransmissionStatus] = useState({
    connected: false,
    sharedStreams: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo(streamSynchronizer.getDebugInfo());
      
      // Check transmission window status
      if (transmissionWindowRef?.current) {
        const connected = !transmissionWindowRef.current.closed;
        const sharedStreams = (window as any).sharedParticipantStreams ? 
          Object.keys((window as any).sharedParticipantStreams).length : 0;
        
        setTransmissionStatus({
          connected,
          sharedStreams
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [transmissionWindowRef]);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline" 
          size="sm"
          className="bg-blue-500/20 border-blue-500 text-blue-300 hover:bg-blue-500/30"
        >
          📊 Debug Streams
        </Button>
      </div>
    );
  }

  const totalParticipants = participantList.length;
  const participantsWithStreams = Object.keys(participantStreams).length;
  const mobileParticipants = participantList.filter(p => p.isMobile).length;
  const activeParticipants = participantList.filter(p => p.active).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-black/80 border-blue-500/50 text-white">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Stream Debug Panel</CardTitle>
            <Button 
              onClick={() => setIsVisible(false)} 
              variant="ghost" 
              size="sm"
              className="text-white hover:bg-white/10"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Participant Stats */}
          <div>
            <h4 className="font-semibold text-blue-300 mb-1">Participantes:</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>Total: <Badge variant="outline">{totalParticipants}</Badge></div>
              <div>Ativos: <Badge variant="outline" className="bg-green-500/20">{activeParticipants}</Badge></div>
              <div>Móveis: <Badge variant="outline" className="bg-blue-500/20">{mobileParticipants}</Badge></div>
              <div>C/ Stream: <Badge variant="outline" className="bg-yellow-500/20">{participantsWithStreams}</Badge></div>
            </div>
          </div>

          {/* Transmission Window Status */}
          {transmissionWindowRef && (
            <div>
              <h4 className="font-semibold text-cyan-300 mb-1">Transmissão:</h4>
              <div className="space-y-1">
                <div>Status: <Badge variant={transmissionStatus.connected ? "default" : "destructive"}>
                  {transmissionStatus.connected ? "Conectado" : "Desconectado"}
                </Badge></div>
                <div>Streams Compartilhados: <Badge variant="outline" className="bg-purple-500/20">{transmissionStatus.sharedStreams}</Badge></div>
              </div>
            </div>
          )}

          {/* Stream Synchronizer Stats */}
          <div>
            <h4 className="font-semibold text-purple-300 mb-1">Sincronização:</h4>
            <div className="space-y-1">
              <div>Streams Ativos: <Badge variant="outline">{debugInfo.activeStreams.length}</Badge></div>
              <div>Aguardando: <Badge variant="outline" className="bg-orange-500/20">{debugInfo.waitingCallbacks.length}</Badge></div>
              <div>Heartbeats: <Badge variant="outline" className="bg-red-500/20">{debugInfo.heartbeats.length}</Badge></div>
            </div>
          </div>

          {/* Participant List */}
          <div>
            <h4 className="font-semibold text-green-300 mb-1">Lista de Participantes:</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {participantList.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
                  <div className="truncate flex-1">
                    <span className="text-xs">{p.name || p.id.substring(0, 8)}</span>
                    {p.isMobile && <span className="ml-1">📱</span>}
                  </div>
                  <div className="flex gap-1">
                    {p.active && <span className="text-green-400">●</span>}
                    {p.hasVideo && <span className="text-blue-400">📹</span>}
                    {participantStreams[p.id] && <span className="text-yellow-400">🎬</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={onForceRefresh}
              size="sm" 
              variant="outline"
              className="flex-1 bg-blue-500/20 border-blue-500 text-blue-300 hover:bg-blue-500/30"
            >
              🔄 Refresh
            </Button>
            <Button 
              onClick={() => {
                participantList.forEach(p => {
                  if (p.isMobile || p.hasVideo) {
                    streamSynchronizer.forceSynchronization(p.id);
                  }
                });
              }}
              size="sm" 
              variant="outline"
              className="flex-1 bg-green-500/20 border-green-500 text-green-300 hover:bg-green-500/30"
            >
              ⚡ Force Sync
            </Button>
          </div>

          {/* Transmission Actions */}
          {transmissionWindowRef && onForceStreamUpdate && (
            <div className="flex gap-2">
              <Button 
                onClick={onForceStreamUpdate}
                size="sm" 
                variant="outline"
                className="flex-1 bg-cyan-500/20 border-cyan-500 text-cyan-300 hover:bg-cyan-500/30"
              >
                📡 Force Transmission
              </Button>
              <Button 
                onClick={() => {
                  // Emergency recovery
                  if ((window as any).sharedParticipantStreams) {
                    (window as any).sharedParticipantStreams = {};
                  }
                  setTimeout(() => {
                    onForceStreamUpdate();
                  }, 500);
                }}
                size="sm" 
                variant="outline"
                className="flex-1 bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30"
              >
                🚨 Emergency Fix
              </Button>
            </div>
          )}

          {/* Recovery Attempts */}
          {Object.keys(debugInfo.recoveryAttempts).length > 0 && (
            <div>
              <h4 className="font-semibold text-red-300 mb-1">Tentativas de Recuperação:</h4>
              {Object.entries(debugInfo.recoveryAttempts).map(([id, attempts]) => (
                <div key={id} className="text-xs">
                  {id.substring(0, 8)}: {attempts} tentativas
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StreamDebugPanel;