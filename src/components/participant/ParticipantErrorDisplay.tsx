import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ParticipantErrorDisplayProps {
  error: string | null;
  isConnecting: boolean;
  onRetryConnect: () => void;
  onRetryMedia?: () => void;
}

const ParticipantErrorDisplay: React.FC<ParticipantErrorDisplayProps> = ({
  error,
  isConnecting,
  onRetryConnect,
  onRetryMedia
}) => {
  if (!error) return null;

  return (
    <Card className="mb-6 border-red-500/50 bg-red-500/10">
      <CardContent className="p-4">
        <p className="text-red-400">{error}</p>
        <div className="flex gap-2 mt-2">
          <Button 
            onClick={onRetryConnect}
            disabled={isConnecting}
            size="sm"
          >
            Reconectar
          </Button>
          {onRetryMedia && (
            <Button 
              onClick={onRetryMedia}
              disabled={isConnecting}
              variant="outline"
              size="sm"
            >
              Tentar Câmera
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantErrorDisplay;