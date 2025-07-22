import React from 'react';
import { LiveControlTabs } from './LiveControlTabs';
import { UnifiedVideoContainer } from './UnifiedVideoContainer';
import { ConnectionDiagnostics } from './ConnectionDiagnostics';
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
            <LiveControlTabs
              selectedParticipantId={selectedParticipantId}
              participantStreams={participantStreams}
              onParticipantSelect={onParticipantSelect}
              onParticipantRemove={onParticipantRemove}
              onRetryMedia={onRetryMedia}
              transmissionActive={transmissionActive}
              sessionId={sessionId}
              qrCodeURL={qrCodeURL}
              participantCount={participantCount}
              isTransmissionActive={isTransmissionActive}
            />
          </TabsContent>
          
          <TabsContent value="signaling" className="space-y-4">
            <SignalingDiagnostics />
          </TabsContent>
          
          <TabsContent value="connection" className="space-y-4">
            <ConnectionDiagnostics />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column - Stream Preview */}
      <div className="space-y-4">
        <UnifiedVideoContainer
          selectedStream={selectedStream}
          participantId={selectedParticipantId || 'none'}
          isTransmissionActive={isTransmissionActive}
          onStreamError={(error) => {
            console.error('Stream error in video container:', error);
          }}
        />
      </div>
    </div>
  );
};
