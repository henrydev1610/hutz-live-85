
import { useState, useEffect } from 'react';
import { useParticipantStore } from '@/stores/participantStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Users } from 'lucide-react';

const ParticipantCard = ({ id, hasVideo, active, selected, onSelect, onRemove }: {
  id: string;
  hasVideo: boolean;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) => {
  return (
    <Card className={`relative overflow-hidden ${selected ? 'border-2 border-accent' : 'border border-border'}`}>
      <CardContent className="p-0">
        <div className="aspect-square bg-gray-900 flex items-center justify-center">
          {hasVideo ? (
            <video 
              id={`participant-${id}`} 
              className="w-full h-full object-cover" 
              autoPlay 
              playsInline
              muted
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
          {!active && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
              <p className="text-xs text-white">Desconectado</p>
            </div>
          )}
        </div>
        
        <div className="absolute inset-x-0 bottom-0 p-2 flex justify-between items-center bg-black/60">
          <span className="text-xs text-white truncate max-w-[70%]">Participante {id.slice(0, 6)}</span>
          <div className="flex gap-1">
            <Button 
              onClick={onSelect}
              size="icon" 
              variant={selected ? "destructive" : "secondary"} 
              className="h-6 w-6"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button 
              onClick={onRemove}
              size="icon" 
              variant="outline" 
              className="h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ParticipantsTab = () => {
  const { participants, selectedCount, maxSelected, queue, toggleSelection, removeParticipant } = useParticipantStore();
  const [participantsList, setParticipantsList] = useState<string[]>([]);
  
  useEffect(() => {
    // Sort participants by selection status, then by active status, then by last active time
    const sorted = Object.keys(participants).sort((a, b) => {
      if (participants[a].selected !== participants[b].selected) {
        return participants[a].selected ? -1 : 1;
      }
      
      if (participants[a].active !== participants[b].active) {
        return participants[a].active ? -1 : 1;
      }
      
      return participants[b].lastActive - participants[a].lastActive;
    });
    
    setParticipantsList(sorted);
  }, [participants]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm">
          <span className="font-medium">{selectedCount}</span> de <span className="font-medium">{maxSelected}</span> selecionados
        </div>
        <div className="text-sm">
          <span className="font-medium">{Object.keys(participants).length}</span> participantes
          {queue.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({queue.length} na fila)
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {participantsList.length > 0 ? (
          participantsList.map((id) => (
            <ParticipantCard
              key={id}
              id={id}
              hasVideo={participants[id].hasVideo}
              active={participants[id].active}
              selected={participants[id].selected}
              onSelect={() => toggleSelection(id)}
              onRemove={() => removeParticipant(id)}
            />
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            Nenhum participante conectado.
            <p className="text-sm mt-2">Compartilhe o QR Code para que os usuários possam se conectar.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantsTab;
