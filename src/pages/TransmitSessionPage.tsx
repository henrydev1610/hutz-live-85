
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Laptop, QrCode, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { isSessionActive, getSessionById } from "@/utils/sessionUtils";

export default function TransmitSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transmissionOpen, setTransmissionOpen] = React.useState(false);
  const transmissionWindowRef = React.useRef<Window | null>(null);

  React.useEffect(() => {
    if (!sessionId) {
      navigate("/dashboard");
      return;
    }

    // Check if session exists and is active
    const sessionActive = isSessionActive(sessionId);
    if (!sessionActive) {
      toast({
        title: "Sessão inativa",
        description: "Esta sessão não está mais ativa ou não existe.",
        variant: "destructive"
      });
      navigate("/dashboard");
    }
    
    return () => {
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.close();
      }
    };
  }, [sessionId, navigate, toast]);

  const session = getSessionById(sessionId || "");

  const handleOpenTransmission = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.focus();
      return;
    }
    
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.9;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      '',
      'LiveTransmissionWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (newWindow) {
      transmissionWindowRef.current = newWindow;
      setTransmissionOpen(true);
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Transmissão ao Vivo - Hutz Live</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                background-color: #000;
                color: white;
                font-family: sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                width: 100vw;
              }
              .container {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
              }
              .session-name {
                font-size: 2rem;
                margin-bottom: 1rem;
              }
              .qr-placeholder {
                width: 200px;
                height: 200px;
                background-color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1rem;
              }
              .join-text {
                font-size: 1.5rem;
              }
              .live-indicator {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
              }
              .live-dot {
                width: 8px;
                height: 8px;
                background-color: #ff0000;
                border-radius: 50%;
                margin-right: 5px;
                animation: pulse 1.5s infinite;
              }
              @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 1; }
                100% { opacity: 0.6; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="session-name">${session?.name || "Sessão ao Vivo"}</div>
              <div class="qr-placeholder">QR Code virá aqui</div>
              <div class="join-text">Escaneie o QR Code para participar</div>
              
              <div class="live-indicator">
                <div class="live-dot"></div>
                AO VIVO
              </div>
            </div>
          </body>
        </html>
      `;
      
      newWindow.document.write(html);
      newWindow.document.close();
      
      newWindow.onbeforeunload = () => {
        setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      };
    }
  };
  
  const handleCloseTransmission = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      setTransmissionOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-8">
      <div className="container mx-auto max-w-2xl">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => navigate(`/session/${sessionId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Sessão
        </Button>
        
        <Card className="bg-secondary/40 backdrop-blur-lg border-white/10 mb-8">
          <CardHeader>
            <CardTitle>Transmitir: {session?.name || "Sessão"}</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-secondary/30 p-4 rounded-md">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Participantes
              </h3>
              <p className="text-muted-foreground">
                {session?.participantCount || 0} participantes conectados
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {!transmissionOpen ? (
                <Button 
                  variant="default" 
                  className="h-auto py-6"
                  onClick={handleOpenTransmission}
                >
                  <div className="flex flex-col items-center text-center">
                    <Laptop className="h-8 w-8 mb-2" />
                    <div>
                      <p className="font-semibold">Abrir Janela de Transmissão</p>
                      <p className="text-xs opacity-80">Exiba na tela grande ou projetor</p>
                    </div>
                  </div>
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  className="h-auto py-6"
                  onClick={handleCloseTransmission}
                >
                  <div className="flex flex-col items-center text-center">
                    <Laptop className="h-8 w-8 mb-2" />
                    <div>
                      <p className="font-semibold">Encerrar Transmissão</p>
                      <p className="text-xs opacity-80">Fechar janela de transmissão</p>
                    </div>
                  </div>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="h-auto py-6 border-white/10"
              >
                <div className="flex flex-col items-center text-center">
                  <QrCode className="h-8 w-8 mb-2" />
                  <div>
                    <p className="font-semibold">Gerar QR Code</p>
                    <p className="text-xs opacity-80">Para participantes se conectarem</p>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
