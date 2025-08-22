import React from 'react';
import { useTwilioRoom } from '@/contexts/TwilioRoomContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wifi, WifiOff, AlertCircle } from 'lucide-react';

export const TwilioConnectionStatus: React.FC = () => {
  const { isConnected, isConnecting, error, room, remoteParticipants } = useTwilioRoom();

  // Don't show anything if connected and no errors
  if (isConnected && !error) {
    return null;
  }

  // Show connecting state
  if (isConnecting) {
    return (
      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Conectando à sala de vídeo...
        </AlertDescription>
      </Alert>
    );
  }

  // Show error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Erro de conexão:</strong> {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Show not connected state
  if (!isConnected && !isConnecting) {
    return (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          Não conectado à sala de vídeo
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default TwilioConnectionStatus;