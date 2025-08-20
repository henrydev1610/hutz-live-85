
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
  console.log('🎮 TRANSMISSION CONTROLS: Estado atual:', { transmissionOpen, sessionId });

  const handleStartTransmission = () => {
    console.log('🎬 INICIAR: Clicou em iniciar transmissão');
    onStartTransmission();
  };

  const handleFinishTransmission = () => {
    console.log('🛑 FINALIZAR: Clicou em finalizar transmissão');
    onFinishTransmission();
  };

  return (
    <div className="flex gap-2">
      <Button 
        className="hutz-button-accent"
        onClick={handleStartTransmission}
        disabled={transmissionOpen || !sessionId}
      >
        <MonitorPlay className="h-4 w-4 mr-2" />
        Iniciar Transmissão
      </Button>
      
      <Button 
        variant="destructive"
        onClick={handleFinishTransmission}
        disabled={!transmissionOpen}
      >
        <StopCircle className="h-4 w-4 mr-2" />
        Finalizar Transmissão
      </Button>
    </div>
  );
};

export default TransmissionControls;
