import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { twilioWebRTCService } from '@/services/TwilioWebRTCService';
import { twilioVideoService } from '@/services/TwilioVideoService';
import { TwilioIntegration } from '@/utils/webrtc/TwilioIntegration';

interface TwilioConnectionStatusProps {
  className?: string;
}

export const TwilioConnectionStatus: React.FC<TwilioConnectionStatusProps> = ({ className }) => {
  const [stats, setStats] = React.useState<any>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const updateStats = React.useCallback(() => {
    const twilioStats = TwilioIntegration.getTwilioStats();
    setStats(twilioStats);
  }, []);

  React.useEffect(() => {
    updateStats();
    
    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);
    
    return () => clearInterval(interval);
  }, [updateStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await TwilioIntegration.refreshServices();
      updateStats();
    } catch (error) {
      console.error('Failed to refresh Twilio services:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm">Twilio Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const { webrtcService, videoService, isVideoConnected } = stats;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Twilio Status
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs h-6"
          >
            {refreshing ? '🔄' : '🔄'} Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* WebRTC Service Status */}
        <div className="space-y-1">
          <div className="text-xs font-medium">WebRTC Service</div>
          <div className="flex items-center gap-2">
            <Badge variant={webrtcService.enabled ? 'default' : 'destructive'}>
              {webrtcService.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {webrtcService.featureFlag && (
              <Badge variant="secondary">Feature ON</Badge>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            Token: {webrtcService.tokenCached ? '✅ Cached' : '❌ No cache'}
            {' • '}
            ICE: {webrtcService.iceServersCached ? '✅ Cached' : '❌ No cache'}
          </div>
        </div>

        {/* Video Service Status */}
        <div className="space-y-1">
          <div className="text-xs font-medium">Video Service</div>
          <div className="flex items-center gap-2">
            <Badge variant={isVideoConnected ? 'default' : 'secondary'}>
              {isVideoConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {videoService.participantCount > 0 && (
              <Badge variant="outline">
                {videoService.participantCount} participants
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              console.log('🔍 Twilio Stats:', TwilioIntegration.getTwilioStats());
            }}
            className="text-xs h-6"
          >
            📊 Log Stats
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              const connectivity = twilioWebRTCService.runConnectivityDiagnostic();
              console.log('🔍 Connectivity Test:', connectivity);
            }}
            className="text-xs h-6"
          >
            🔍 Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};