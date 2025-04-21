
import { User, Check, Video, VideoOff } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

interface ParticipantGridProps {
  participants: Participant[];
  onSelectParticipant: (id: string) => void;
  onRemoveParticipant: (id: string) => void;
}

const ParticipantGrid = ({ participants, onSelectParticipant, onRemoveParticipant }: ParticipantGridProps) => {
  const activeParticipants = participants.filter(p => p.active);
  const inactiveParticipants = participants.filter(p => !p.active);
  
  // Sort participants by connection time (most recent first)
  const sortedActiveParticipants = [...activeParticipants].sort((a, b) => 
    (b.connectedAt || 0) - (a.connectedAt || 0)
  );
  
  return (
    <div className="space-y-4">
      {sortedActiveParticipants.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-white/70 mb-2">Participantes Ativos ({sortedActiveParticipants.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortedActiveParticipants.map((participant) => (
              <Card key={participant.id} className={`bg-secondary/60 border ${participant.selected ? 'border-accent' : 'border-white/10'}`}>
                <CardContent className="p-4 text-center">
                  <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2 relative">
                    <User className="h-8 w-8 text-white/30" />
                    {participant.hasVideo ? (
                      <div className="absolute top-2 right-2 bg-green-500/20 p-1 rounded-full">
                        <Video className="h-3 w-3 text-green-500" />
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2 bg-orange-500/20 p-1 rounded-full">
                        <VideoOff className="h-3 w-3 text-orange-500" />
                      </div>
                    )}
                    {participant.selected && (
                      <div className="absolute inset-0 bg-accent/10 flex items-center justify-center">
                        <span className="text-xs bg-accent text-white px-2 py-1 rounded-full">Na tela</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium truncate">
                      {participant.name || `Participante ${participant.id.slice(0, 4)}`}
                    </p>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-400/20 text-xs">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                      Online
                    </Badge>
                  </div>
                  <div className="flex justify-center gap-2 mt-2">
                    <Button 
                      variant={participant.selected ? "default" : "outline"} 
                      size="sm" 
                      className={`h-8 ${participant.selected ? 'bg-accent text-white' : 'border-white/20'}`}
                      onClick={() => onSelectParticipant(participant.id)}
                    >
                      {participant.selected ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Selecionado
                        </>
                      ) : 'Selecionar'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-white/60 hover:text-white"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {inactiveParticipants.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-white/70 mb-2">Participantes Inativos ({inactiveParticipants.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {inactiveParticipants.map((participant) => (
              <Card key={participant.id} className="bg-secondary/60 border border-white/10 opacity-60">
                <CardContent className="p-4 text-center">
                  <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                    <User className="h-8 w-8 text-white/30" />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium truncate">
                      {participant.name || `Participante ${participant.id.slice(0, 4)}`}
                    </p>
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-400/20 text-xs">
                      <span className="w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
                      Offline
                    </Badge>
                  </div>
                  <div className="flex justify-center gap-2 mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-white/60 hover:text-white"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {activeParticipants.length === 0 && inactiveParticipants.length === 0 && (
        <div className="bg-secondary/30 border border-white/10 rounded-lg p-8 text-center">
          <User className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/70 mb-2">Sem participantes</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            Compartilhe o QR Code para que os participantes possam entrar na sessão.
          </p>
        </div>
      )}
      
      <p className="text-sm text-white/60 mt-4">
        Participantes são adicionados automaticamente quando acessam o link do QR Code.
      </p>
    </div>
  );
};

export default ParticipantGrid;
