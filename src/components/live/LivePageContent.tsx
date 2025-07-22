import React from 'react';
import LiveControlTabs from './LiveControlTabs';
import UnifiedVideoContainer from './UnifiedVideoContainer';
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
  isTransmissionActive
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

      {/* Right Column - Stream Preview */}
      <div className="space-y-4">
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">Preview da Transmissão</div>
            <div className="text-sm text-muted-foreground">
              {isTransmissionActive ? 'Transmissão ativa' : 'Transmissão parada'}
            </div>
            {selectedStream && (
              <div className="mt-2 text-xs text-green-600">
                Stream detectado: {selectedStream.id}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
