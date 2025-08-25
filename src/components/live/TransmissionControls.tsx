
import React from 'react';
import { Button } from "@/components/ui/button";
import { MonitorPlay, StopCircle } from "lucide-react";

interface TransmissionControlsProps {
  transmissionOpen: boolean;
  sessionId: string | null;
  onStartTransmission: () => void;
  onFinishTransmission: () => void;
}

const TransmissionControls: React.FC<TransmissionControlsProps> = ({
  transmissionOpen,
  sessionId,
  onStartTransmission,
  onFinishTransmission
}) => {
  return (
    <div className="flex gap-2">
      <Button 
        className="hutz-button-accent"
        onClick={onStartTransmission}
        disabled={transmissionOpen || !sessionId}
      >
        <MonitorPlay className="h-4 w-4 mr-2" />
        Iniciar Transmissão
      </Button>
      
      <Button 
        variant="destructive"
        onClick={onFinishTransmission}
        disabled={!transmissionOpen}
      >
        <StopCircle className="h-4 w-4 mr-2" />
        Finalizar Transmissão
      </Button>
    </div>
  );
};

export default TransmissionControls;
