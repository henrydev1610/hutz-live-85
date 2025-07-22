
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FinalActionDialogProps {
  finalActionOpen: boolean;
  setFinalActionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  finalActionTimeLeft: number;
  onCloseFinalAction: () => void;
}

const FinalActionDialog: React.FC<FinalActionDialogProps> = ({
  finalActionOpen,
  setFinalActionOpen,
  finalActionTimeLeft,
  onCloseFinalAction
}) => {
  return (
    <Dialog open={finalActionOpen} onOpenChange={setFinalActionOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ação final enviada!</DialogTitle>
          <DialogDescription>
            O conteúdo foi exibido para os participantes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <p className="text-sm text-muted-foreground">
              Esta tela será fechada automaticamente em {finalActionTimeLeft} segundos.
            </p>
          </div>
          <Button variant="outline" onClick={onCloseFinalAction}>
            Fechar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinalActionDialog;
