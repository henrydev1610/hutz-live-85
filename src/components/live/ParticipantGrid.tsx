
import { User, Check } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
}

interface ParticipantGridProps {
  participants: Participant[];
  onSelectParticipant: (id: string) => void;
  onRemoveParticipant: (id: string) => void;
}

const ParticipantGrid = ({ participants, onSelectParticipant, onRemoveParticipant }: ParticipantGridProps) => {
  const activeParticipants = participants.filter(p => p.active);
  const inactiveParticipants = participants.filter(p => !p.active);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {activeParticipants.map((participant) => (
          <Card key={participant.id} className={`bg-secondary/60 border ${participant.selected ? 'border-accent' : 'border-white/10'}`}>
            <CardContent className="p-4 text-center">
              <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                <User className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-sm font-medium truncate flex items-center justify-center gap-2">
                {participant.name}
                <span className={`w-2 h-2 rounded-full ${participant.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              </p>
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
        
        {inactiveParticipants.map((participant) => (
          <Card key={participant.id} className="bg-secondary/60 border border-white/10 opacity-60">
            <CardContent className="p-4 text-center">
              <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                <User className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-sm font-medium truncate flex items-center justify-center gap-2">
                {participant.name}
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                <span className="text-xs text-white/50">(Desconectado)</span>
              </p>
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
        
        {Array(Math.max(0, 12 - participants.length)).fill(0).map((_, i) => (
          <Card key={`empty-${i}`} className="bg-secondary/60 border border-white/10">
            <CardContent className="p-4 text-center">
              <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                <User className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-sm font-medium truncate">
                Aguardando...
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <p className="text-sm text-white/60 mt-2">
        Participantes são adicionados automaticamente quando acessam o link do QR Code.
      </p>
    </div>
  );
};

export default ParticipantGrid;
