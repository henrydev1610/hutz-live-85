
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSessionManager } from '@/hooks/useSessionManager';
import LivePreview from '@/components/live/LivePreview';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const BroadcastPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { joinExistingSession, endSession } = useSessionManager();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  useEffect(() => {
    if (sessionId) {
      joinExistingSession(sessionId);
    } else {
      toast({
        title: "Erro",
        description: "Sessão inválida",
        variant: "destructive"
      });
    }
    
    // Handle window close
    const handleBeforeUnload = () => {
      window.opener?.postMessage({ type: 'broadcast-closed' }, '*');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Try to enter fullscreen
    const enterFullscreen = () => {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (err) {
        console.error("Could not enter fullscreen", err);
      }
    };
    
    // Listen for messages from parent window
    const handleParentMessage = (event: MessageEvent) => {
      if (event.data === 'close-broadcast') {
        window.close();
      }
    };
    
    window.addEventListener('message', handleParentMessage);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('message', handleParentMessage);
      
      // Exit fullscreen if active
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    };
  }, [sessionId, joinExistingSession]);
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  const closeBroadcast = () => {
    window.close();
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      <div className="flex justify-between items-center p-2 bg-background/10">
        <h1 className="text-white text-lg font-medium">Transmissão ao Vivo</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={closeBroadcast}
          >
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>
      </div>
      
      <div className="flex-grow">
        <LivePreview />
      </div>
    </div>
  );
};

export default BroadcastPage;
