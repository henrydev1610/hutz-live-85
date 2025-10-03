import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

interface ConnectionStep {
  name: string;
  status: 'pending' | 'inProgress' | 'completed' | 'failed';
  timestamp?: number;
}

interface ParticipantConnectionFlowProps {
  steps: ConnectionStep[];
}

export const ParticipantConnectionFlow: React.FC<ParticipantConnectionFlowProps> = ({ steps }) => {
  const getIcon = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'inProgress':
        return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: ConnectionStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'inProgress':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Status da Conexão</h3>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {getIcon(step.status)}
              <div className="flex-1">
                <p className={`text-sm ${getStatusText(step.status)}`}>
                  {step.name}
                </p>
                {step.timestamp && step.status === 'completed' && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round((Date.now() - step.timestamp) / 1000)}s atrás
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
