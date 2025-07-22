import React from 'react';
import LiveControlTabs from './LiveControlTabs';
import SimplifiedParticipantGrid from './SimplifiedParticipantGrid';
import ConnectionDiagnostics from './ConnectionDiagnostics';
import { SignalingDiagnostics } from './SignalingDiagnostics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LivePageContentProps {
  // Stream state
  selectedParticipantId: string | null;
  participantStreams: { [id: string]: MediaStream };
  
  // Callbacks
  onParticipantSelect: (id: string) => void;
  onParticipantRemove: (id: string) => void;
  onRetryMedia: () => Promise<void>;
  
  // Stream management
  transmissionActive: boolean;
  selectedStream: MediaStream | null;
  
  // Other props
  sessionId: string;
  qrCodeURL: string;
  participantCount: number;
  isTransmissionActive: boolean;
  participantList?: any[];
}

export const LivePageContent: React.FC<LivePageContentProps> = ({
  selectedParticipantId,
  participantStreams,
  onParticipantSelect,
  onParticipantRemove,
  onRetryMedia,
  transmissionActive,
  selectedStream,
  sessionId,
  qrCodeURL,
  participantCount,
  isTransmissionActive,
  participantList = []
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Column - Controls and Diagnostics */}
      <div className="space-y-6">
        <Tabs defaultValue="controls" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="controls">Controles</TabsTrigger>
            <TabsTrigger value="signaling">Signaling</TabsTrigger>
            <TabsTrigger value="connection">Conexão</TabsTrigger>
          </TabsList>
          
          <TabsContent value="controls" className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Controles de Transmissão</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Status: {transmissionActive ? 'Ativo' : 'Inativo'}</span>
                  <div className={`w-3 h-3 rounded-full ${transmissionActive ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <div>Participantes conectados: {participantCount}</div>
                {qrCodeURL && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">QR Code para participação:</p>
                    <div className="bg-muted p-2 rounded text-xs break-all">{qrCodeURL}</div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="signaling" className="space-y-4">
            <SignalingDiagnostics />
          </TabsContent>
          
          <TabsContent value="connection" className="space-y-4">
            <ConnectionDiagnostics 
              sessionId={sessionId}
              participantCount={participantCount}
              activeStreams={Object.keys(participantStreams).length}
              onTestConnection={() => {
                console.log('Testing connection...');
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column - Simplified Stream Preview */}
      <div className="space-y-4">
        <div className="aspect-video bg-muted rounded-lg relative overflow-hidden">
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
            Preview da Transmissão
          </div>
          
          <SimplifiedParticipantGrid
            participantList={participantList}
            participantCount={participantCount}
            participantStreams={participantStreams}
            sessionId={sessionId}
          />
          
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
            {isTransmissionActive ? '🔴 AO VIVO' : '⏸️ PARADO'}
          </div>
        </div>
        
        {selectedStream && (
          <div className="text-center text-sm text-muted-foreground">
            Stream Host: {selectedStream.id.substring(0, 8)}...
          </div>
        )}
      </div>
    </div>
  );
};
