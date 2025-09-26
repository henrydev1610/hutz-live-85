import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const ParticipantInstructions: React.FC = () => {
  return (
    <Card className="mt-6 bg-black/20 border-white/10">
      <CardContent className="p-4">
        <h3 className="text-white font-semibold mb-2">Instruções:</h3>
        <ul className="text-white/70 text-sm space-y-1">
          <li>• O servidor de sinalização conecta automaticamente ao ambiente apropriado</li>
          <li>• A câmera e microfone são inicializados automaticamente com fallback</li>
          <li>• Use os controles para ajustar vídeo, áudio e compartilhamento de tela</li>
          <li>• Se houver problemas de conexão, use o botão de reconexão</li>
          <li>• O status do WebSocket deve mostrar "connected" para funcionar corretamente</li>
          <li>• Permita acesso à câmera/microfone quando solicitado pelo navegador</li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default ParticipantInstructions;