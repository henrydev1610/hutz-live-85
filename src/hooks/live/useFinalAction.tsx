
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

interface UseFinalActionProps {
  finalActionOpen: boolean;
  finalActionTimeLeft: number;
  finalActionTimerId: number | null;
  setFinalActionTimeLeft: (timeLeft: number | ((prev: number) => number)) => void;
  setFinalActionTimerId: (timerId: number | null) => void;
  setFinalActionOpen: (open: boolean) => void;
}

export const useFinalAction = ({
  finalActionOpen,
  finalActionTimeLeft,
  finalActionTimerId,
  setFinalActionTimeLeft,
  setFinalActionTimerId,
  setFinalActionOpen
}: UseFinalActionProps) => {
  const { toast } = useToast();

  useEffect(() => {
    if (finalActionOpen && finalActionTimeLeft > 0) {
      const timerId = window.setInterval(() => {
        setFinalActionTimeLeft((prev) => prev - 1);
      }, 1000);
      
      setFinalActionTimerId(timerId as unknown as number);
      
      return () => {
        if (timerId) clearInterval(timerId);
      };
    } else if (finalActionTimeLeft <= 0) {
      closeFinalAction();
    }
  }, [finalActionOpen, finalActionTimeLeft]);

  const closeFinalAction = () => {
    if (finalActionTimerId) {
      clearInterval(finalActionTimerId);
      setFinalActionTimerId(null);
    }
    setFinalActionOpen(false);
    setFinalActionTimeLeft(20);
    
    toast({
      title: "Transmissão finalizada",
      description: "A transmissão foi encerrada com sucesso."
    });
  };

  return {
    closeFinalAction
  };
};
