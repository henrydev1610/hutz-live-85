import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MobileConnectionDebuggerProps {
  participantCount: number;
  mobileCount: number;
  streamsCount: number;
  connectionState: string;
  lastUpdate: number;
  mobileParticipants: string[];
}

export const MobileConnectionDebugger: React.FC<MobileConnectionDebuggerProps> = ({
  participantCount,
  mobileCount,
  streamsCount,
  connectionState,
  lastUpdate,
  mobileParticipants
}) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="mt-4 bg-black/20 border-white/20">
      <CardHeader>
        <CardTitle className="text-white text-sm">📱 Mobile Connection Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-300">
            Total Participants: <span className="text-white font-bold">{participantCount}</span>
          </div>
          <div className="text-gray-300">
            Mobile Count: <span className="text-green-400 font-bold">{mobileCount}</span>
          </div>
          <div className="text-gray-300">
            Active Streams: <span className="text-blue-400 font-bold">{streamsCount}</span>
          </div>
          <div className="text-gray-300">
            Connection: <Badge variant={connectionState === 'connected' ? 'default' : 'destructive'}>
              {connectionState}
            </Badge>
          </div>
        </div>
        
        <div className="text-xs text-gray-400">
          Last Update: {formatTime(lastUpdate)}
        </div>
        
        {mobileParticipants.length > 0 && (
          <div className="text-xs">
            <div className="text-gray-300 mb-1">Mobile Participants:</div>
            <div className="flex flex-wrap gap-1">
              {mobileParticipants.map(id => (
                <Badge key={id} variant="secondary" className="text-xs">
                  📱 {id.substring(0, 8)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};