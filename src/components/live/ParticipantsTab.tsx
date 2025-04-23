
import { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Check, X, Eye, EyeOff } from 'lucide-react';
import { useLiveSession } from '@/hooks/useLiveSession';

const ParticipantsTab = () => {
  const { 
    participants, 
    waitingList, 
    selectParticipant, 
    removeParticipant,
    selectedParticipants,
    maxParticipants,
    toggleParticipantVisibility,
    isParticipantVisible,
    generateSessionId,
    sessionId
  } = useLiveSession();
  
  console.log('[ParticipantsTab] Current participants:', participants);
  console.log('[ParticipantsTab] Selected participants:', selectedParticipants);
  console.log('[ParticipantsTab] Waiting list:', waitingList);
  
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
          <div className="grid grid-cols-4 gap-2">
            {participants.map(participant => {
              const isSelected = selectedParticipants.some(p => p.id === participant.id);
              const isOnline = participant.stream !== null;
              const isVisible = isParticipantVisible(participant.id);
              
              return (
                <div 
                  key={participant.id} 
                  className={`relative rounded-lg overflow-hidden border aspect-square ${isSelected ? 'border-accent' : 'border-white/10'}`}
                >
                  {participant.stream ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full bg-black">
                      <div className="bg-secondary/60 rounded-full p-4 text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-secondary/80">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <p className="text-xs truncate">{participant.name}</p>
                        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => toggleParticipantVisibility(participant.id)}
                            className="h-6 w-6 hover:bg-white/10"
                          >
                            {isVisible ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        )}
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
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-white/50">
          <p>Nenhum participante conectado</p>
          <p className="text-sm mt-2">
            {!sessionId ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={generateSessionId}
                className="mt-2"
              >
                Gerar QR Code para conectar participantes
              </Button>
            ) : (
              "Compartilhe o QR Code para que os participantes se conectem"
            )}
          </p>
        </div>
      )}
      
      {waitingList.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Fila de espera ({waitingList.length})</h4>
          <ScrollArea className="h-[100px]">
            <div className="grid grid-cols-4 gap-2">
              {waitingList.map(participant => (
                <div key={participant.id} className="text-xs p-2 bg-secondary rounded truncate flex justify-between items-center">
                  <span>{participant.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => selectParticipant(participant.id)}
                    className="h-5 w-5 text-green-500 hover:text-green-400"
                    disabled={selectedParticipants.length >= maxParticipants}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
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
