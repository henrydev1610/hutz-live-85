import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface StreamDebugMonitorProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: any[];
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  onForceUpdate?: () => void;
}

export const StreamDebugMonitor: React.FC<StreamDebugMonitorProps> = ({
  participantStreams,
  participantList,
  transmissionWindowRef,
  onForceUpdate
}) => {
  const [streamStatus, setStreamStatus] = useState<{[id: string]: any}>({});
  const [quadrantStatus, setQuadrantStatus] = useState<{[id: string]: boolean}>({});

  useEffect(() => {
    const checkStreams = () => {
      const status: {[id: string]: any} = {};
      
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        status[participantId] = {
          hasStream: true,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          activeVideoTracks: videoTracks.filter(t => t.readyState === 'live').length,
          streamActive: videoTracks.some(t => t.readyState === 'live'),
          participant: participantList.find(p => p.id === participantId)
        };
      });

      setStreamStatus(status);
    };

    checkStreams();
    const interval = setInterval(checkStreams, 2000);

    return () => clearInterval(interval);
  }, [participantStreams, participantList]);

  const handleCheckTransmission = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'debug-status-request',
        timestamp: Date.now()
      }, '*');
    }
  };

  const handleForceRecovery = () => {
    console.log('🔄 DEBUG: Forcing stream recovery...');
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      if (stream && stream.getTracks().length > 0) {
        // Force update shared streams
        if (!window.sharedParticipantStreams) {
          window.sharedParticipantStreams = {};
        }
        window.sharedParticipantStreams[participantId] = stream;
        
        // Notify transmission window
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          transmissionWindowRef.current.postMessage({
            type: 'force-stream-recovery',
            participantId: participantId,
            streamId: stream.id,
            timestamp: Date.now()
          }, '*');
        }
      }
    });
    
    onForceUpdate?.();
  };

  const activeStreams = Object.values(streamStatus).filter(s => s.streamActive);
  const selectedParticipants = participantList.filter(p => p.selected);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">Stream Debug Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Active Streams:</span>
            <Badge variant="outline" className="ml-2">
              {activeStreams.length}
            </Badge>
          </div>
          <div>
            <span className="font-medium">Selected Participants:</span>
            <Badge variant="outline" className="ml-2">
              {selectedParticipants.length}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Stream Status:</h4>
          {Object.entries(streamStatus).map(([participantId, status]) => (
            <div key={participantId} className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {status.participant?.name || participantId}
                </span>
                {status.participant?.isMobile && (
                  <Badge variant="secondary" className="text-xs">Mobile</Badge>
                )}
                {status.participant?.selected && (
                  <Badge variant="default" className="text-xs">Selected</Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={status.streamActive ? "default" : "destructive"} className="text-xs">
                  {status.streamActive ? "Active" : "Inactive"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  V:{status.activeVideoTracks} A:{status.audioTracks}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleCheckTransmission}>
            Check Transmission
          </Button>
          <Button variant="outline" size="sm" onClick={handleForceRecovery}>
            Force Recovery
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};