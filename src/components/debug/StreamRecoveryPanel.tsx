
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Activity, Zap } from 'lucide-react';
import { streamTracker } from '@/utils/debug/streamTracker';

interface StreamStatus {
  participantId: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  missingStep: string | null;
  lastActivity: number;
}

interface StreamRecoveryPanelProps {
  onForceReconnect: (participantId: string) => Promise<void>;
  onForceStreamCapture: () => Promise<void>;
  onDiagnosticReset: () => void;
}

export const StreamRecoveryPanel: React.FC<StreamRecoveryPanelProps> = ({
  onForceReconnect,
  onForceStreamCapture,
  onDiagnosticReset
}) => {
  const [streamStatuses, setStreamStatuses] = useState<StreamStatus[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);

  useEffect(() => {
    const updateStatuses = () => {
      // Get unique participant IDs from stream tracker
      const participantIds = Array.from(new Set(
        streamTracker.getEventsForParticipant('').map(() => {
          // This is a simplified version - in real implementation, 
          // we'd get all participant IDs from the tracker
          return 'mobile-participant';
        })
      ));

      const statuses = participantIds.map(participantId => {
        const missingStep = streamTracker.findMissingStep(participantId);
        const events = streamTracker.getEventsForParticipant(participantId);
        const lastActivity = Math.max(...events.map(e => e.timestamp), 0);
        
        let health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
        if (missingStep) {
          health = 'unhealthy';
        } else if (streamTracker.hasCompletePath(participantId)) {
          health = 'healthy';
        }

        return {
          participantId,
          health,
          missingStep,
          lastActivity
        };
      });

      setStreamStatuses(statuses);
      
      // Show panel if there are unhealthy streams
      const hasUnhealthy = statuses.some(s => s.health === 'unhealthy');
      setIsVisible(hasUnhealthy || statuses.length === 0);
    };

    // Update on stream tracker events
    const handleStreamUpdate = () => updateStatuses();
    window.addEventListener('streamTrackerUpdate', handleStreamUpdate);
    
    // Update on stream health events
    const handleStreamUnhealthy = (event: CustomEvent) => {
      console.log('🚨 RECOVERY PANEL: Unhealthy stream detected:', event.detail);
      updateStatuses();
      setIsVisible(true);
    };
    window.addEventListener('streamUnhealthy', handleStreamUnhealthy as EventListener);

    // Initial update
    updateStatuses();
    
    // Periodic updates
    const interval = setInterval(updateStatuses, 3000);

    return () => {
      window.removeEventListener('streamTrackerUpdate', handleStreamUpdate);
      window.removeEventListener('streamUnhealthy', handleStreamUnhealthy as EventListener);
      clearInterval(interval);
    };
  }, []);

  // Auto-recovery logic
  useEffect(() => {
    if (!autoRecoveryEnabled) return;

    const unhealthyStreams = streamStatuses.filter(s => s.health === 'unhealthy');
    
    unhealthyStreams.forEach(status => {
      const timeSinceActivity = Date.now() - status.lastActivity;
      
      // Auto-recover if no activity for 15 seconds
      if (timeSinceActivity > 15000) {
        console.log('🔄 AUTO RECOVERY: Triggering recovery for:', status.participantId);
        onForceReconnect(status.participantId).catch(err => {
          console.error('❌ AUTO RECOVERY: Failed:', err);
        });
      }
    });
  }, [streamStatuses, autoRecoveryEnabled, onForceReconnect]);

  if (!isVisible && streamStatuses.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Stream Recovery Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-600" />
            <span>Healthy: {streamStatuses.filter(s => s.health === 'healthy').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>Unhealthy: {streamStatuses.filter(s => s.health === 'unhealthy').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gray-400 rounded-full"></span>
            <span>Unknown: {streamStatuses.filter(s => s.health === 'unknown').length}</span>
          </div>
        </div>

        {/* Stream Details */}
        {streamStatuses.length === 0 && (
          <div className="text-center py-4 text-orange-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-medium">No streams detected</p>
            <p className="text-sm text-orange-500">Waiting for mobile device to connect...</p>
          </div>
        )}

        {streamStatuses.map(status => (
          <div key={status.participantId} className="border rounded-lg p-3 bg-white/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {status.participantId.substring(0, 12)}...
                </span>
                <Badge variant={
                  status.health === 'healthy' ? 'default' : 
                  status.health === 'unhealthy' ? 'destructive' : 'secondary'
                }>
                  {status.health}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onForceReconnect(status.participantId)}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            </div>
            
            {status.missingStep && (
              <p className="text-xs text-red-600 mb-2">
                <strong>Issue:</strong> {status.missingStep}
              </p>
            )}
            
            <p className="text-xs text-gray-600">
              Last activity: {status.lastActivity > 0 ? 
                `${Math.round((Date.now() - status.lastActivity) / 1000)}s ago` : 
                'Never'
              }
            </p>
          </div>
        ))}

        {/* Recovery Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={onForceStreamCapture}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Force Stream Capture
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onDiagnosticReset}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset Diagnostics
          </Button>
          
          <Button
            size="sm"
            variant={autoRecoveryEnabled ? "default" : "outline"}
            onClick={() => setAutoRecoveryEnabled(!autoRecoveryEnabled)}
            className="text-xs"
          >
            <Activity className="h-3 w-3 mr-1" />
            Auto Recovery: {autoRecoveryEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {/* Debug Export */}
        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const report = streamTracker.exportDebugReport();
              console.log('📊 STREAM REPORT:', report);
              navigator.clipboard?.writeText(report);
            }}
            className="text-xs"
          >
            Export Debug Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
