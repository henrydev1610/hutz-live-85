import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ParticipantErrorDisplayProps {
  error: string | null;
  isConnecting: boolean;
  onRetryConnect: () => void;
}

const ParticipantErrorDisplay: React.FC<ParticipantErrorDisplayProps> = ({
  error,
  isConnecting,
  onRetryConnect
}) => {
  if (!error) return null;

  return (
    <Card className="mb-6 border-red-500/50 bg-red-500/10">
      <CardContent className="p-4">
        <p className="text-red-400">{error}</p>
        <Button 
          onClick={onRetryConnect}
          className="mt-2"
          disabled={isConnecting}
        >
          Tentar Reconectar
        </Button>
      </CardContent>
    </Card>
  );
};

export default ParticipantErrorDisplay;