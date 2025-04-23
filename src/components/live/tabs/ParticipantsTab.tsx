
import { useState, useEffect } from "react";
import { useParticipantStore } from "@/stores/participantStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionManager } from "@/hooks/useSessionManager";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, UserX } from "lucide-react";

const ParticipantsTab = () => {
  const { isSessionActive } = useSessionManager();
  const { participants, toggleParticipantSelection } = useParticipantStore();
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    setConnectedCount(Object.keys(participants).length);
  }, [participants]);

  if (!isSessionActive) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">
          Inicie uma sessão para visualizar os participantes
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Participantes Conectados</h3>
        <Badge variant="outline">{connectedCount}/100</Badge>
      </div>

      {connectedCount === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground mb-2">
            Nenhum participante conectado
          </p>
          <p className="text-sm text-muted-foreground">
            Os participantes aparecerão aqui quando se conectarem via QR Code
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.values(participants).map((participant) => (
              <Card 
                key={participant.id} 
                className={`overflow-hidden ${participant.selected ? 'border-accent' : ''}`}
              >
                <CardContent className="p-3">
                  <div className="relative aspect-video mb-2 bg-black rounded overflow-hidden">
                    <video
                      id={`participant-video-${participant.id}`}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <div className="absolute bottom-2 right-2">
                      <Badge 
                        variant={participant.active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {participant.active ? "Conectado" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium truncate">
                      Participante {participant.id.substring(0, 4)}
                    </span>
                    <Button
                      variant={participant.selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleParticipantSelection(participant.id)}
                    >
                      {participant.selected ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" /> Remover
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" /> Selecionar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default ParticipantsTab;
