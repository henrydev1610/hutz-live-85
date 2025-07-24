
import React, { useEffect, useState } from 'react';
import { StreamLogEntry, StreamLogLevel, streamLogger } from './StreamLogger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StreamDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const StreamDebugPanel: React.FC<StreamDebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<StreamLogLevel | 'ALL'>('ALL');
  const [selectedParticipant, setSelectedParticipant] = useState<string | 'ALL'>('ALL');

  useEffect(() => {
    if (!isOpen) return;

    const updateLogs = () => {
      setLogs(streamLogger.getLogs());
    };

    updateLogs();
    const listener = () => updateLogs();
    streamLogger.addListener(listener);

    return () => {
      streamLogger.removeListener(listener);
    };
  }, [isOpen]);

  const filteredLogs = logs.filter(log => {
    const levelMatch = selectedLevel === 'ALL' || log.context.level === selectedLevel;
    const participantMatch = selectedParticipant === 'ALL' || log.context.participantId === selectedParticipant;
    return levelMatch && participantMatch;
  });

  const participants = [...new Set(logs.map(log => log.context.participantId))];
  const performanceAnalysis = streamLogger.getPerformanceAnalysis();

  const exportLogs = () => {
    const logsData = streamLogger.exportLogs();
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stream-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Stream Debug Panel</h2>
          <div className="flex gap-2">
            <Button onClick={exportLogs} variant="outline" size="sm">
              Export Logs
            </Button>
            <Button onClick={() => streamLogger.clearLogs()} variant="outline" size="sm">
              Clear Logs
            </Button>
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </div>

        <Tabs defaultValue="logs" className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="h-full">
            <div className="p-4">
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium">Level:</label>
                  <select 
                    value={selectedLevel} 
                    onChange={(e) => setSelectedLevel(e.target.value as StreamLogLevel | 'ALL')}
                    className="ml-2 p-1 border rounded"
                  >
                    <option value="ALL">All Levels</option>
                    {Object.values(StreamLogLevel).map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Participant:</label>
                  <select 
                    value={selectedParticipant} 
                    onChange={(e) => setSelectedParticipant(e.target.value)}
                    className="ml-2 p-1 border rounded"
                  >
                    <option value="ALL">All Participants</option>
                    {participants.map(participant => (
                      <option key={participant} value={participant}>{participant}</option>
                    ))}
                  </select>
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="border rounded p-3 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{log.icon}</span>
                        <Badge variant="outline" style={{ color: log.colorCode }}>
                          {log.context.level}
                        </Badge>
                        <Badge variant="secondary">{log.context.phase}</Badge>
                        <Badge variant="outline">{log.context.deviceType}</Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(log.context.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="text-sm mb-2">
                        <strong>Participant:</strong> {log.context.participantId}
                      </div>
                      
                      <div className="text-sm mb-2">
                        <strong>Message:</strong> {log.context.message}
                      </div>

                      {log.context.streamDetails && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium">Stream Details</summary>
                          <pre className="mt-2 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.context.streamDetails, null, 2)}
                          </pre>
                        </details>
                      )}

                      {log.context.additionalData && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium">Additional Data</summary>
                          <pre className="mt-2 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.context.additionalData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="h-full">
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {performanceAnalysis.successfulAttempts}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {performanceAnalysis.failedAttempts}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {performanceAnalysis.successRate}
                  </div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {performanceAnalysis.avgDuration}
                  </div>
                  <div className="text-sm text-gray-600">Avg Duration</div>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-medium mb-3">Error Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(performanceAnalysis.errorsByType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm">{type}</span>
                      <Badge variant="destructive">{count as React.ReactNode}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="h-full">
            <div className="p-4">
              <Card className="p-4">
                <h3 className="font-medium mb-3">Session Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div>Total Logs: {performanceAnalysis.totalLogs}</div>
                  <div>Total Attempts: {performanceAnalysis.totalAttempts}</div>
                  <div>Active Participants: {participants.length}</div>
                  <div>Session Duration: {((Date.now() - streamLogger['sessionStartTime']) / 1000 / 60).toFixed(2)} minutes</div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default StreamDebugPanel;
