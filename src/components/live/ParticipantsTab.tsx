
import { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Check, X } from 'lucide-react';
import { useLiveSession } from '@/hooks/useLiveSession';

const ParticipantsTab = () => {
  const { 
    participants, 
    waitingList, 
    selectParticipant, 
    removeParticipant,
    selectedParticipants,
    maxParticipants
  } = useLiveSession();
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Participantes ({participants.length})</h3>
        <span className="text-sm text-white/70">
          {selectedParticipants.length}/{maxParticipants} selecionados
        </span>
      </div>
      
      {participants.length > 0 ? (
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-2 gap-3">
            {participants.map(participant => {
              const isSelected = selectedParticipants.some(p => p.id === participant.id);
              
              return (
                <div 
                  key={participant.id} 
                  className={`relative rounded-lg overflow-hidden border aspect-square ${isSelected ? 'border-accent' : 'border-white/10'}`}
                >
                  {participant.stream && (
                    <video
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover bg-black"
                      ref={(element) => {
                        if (element && participant.stream) {
                          element.srcObject = participant.stream;
                        }
                      }}
                    />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-secondary/80">
                    <div className="flex justify-between items-center">
                      <p className="text-sm truncate">{participant.name}</p>
                      {isSelected ? (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeParticipant(participant.id)}
                          className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => selectParticipant(participant.id)}
                          className="h-6 w-6 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          disabled={selectedParticipants.length >= maxParticipants}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-white/50">
          <p>Nenhum participante conectado</p>
          <p className="text-sm mt-2">Compartilhe o QR Code para que os participantes se conectem</p>
        </div>
      )}
      
      {waitingList.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Fila de espera ({waitingList.length})</h4>
          <ScrollArea className="h-[100px]">
            <div className="grid grid-cols-4 gap-2">
              {waitingList.map(participant => (
                <div key={participant.id} className="text-xs p-2 bg-secondary rounded truncate">
                  {participant.name}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default ParticipantsTab;
