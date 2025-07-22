
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FinalActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'end' | 'leave' | null;
}

const FinalActionDialog: React.FC<FinalActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type
}) => {
  if (!type) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === 'end' ? 'Encerrar Sessão' : 'Sair da Sessão'}
          </DialogTitle>
          <DialogDescription>
            {type === 'end' 
              ? 'Tem certeza que deseja encerrar a sessão? Todos os participantes serão desconectados.'
              : 'Tem certeza que deseja sair da sessão?'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={onConfirm} variant="destructive" className="flex-1">
            {type === 'end' ? 'Encerrar' : 'Sair'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinalActionDialog;
