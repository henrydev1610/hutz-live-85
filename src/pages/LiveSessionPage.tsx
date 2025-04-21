
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, MonitorPlay, Smartphone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { isSessionActive, getSessionById } from "@/utils/sessionUtils";

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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
  }, [sessionId, navigate, toast]);

  const session = getSessionById(sessionId || "");

  const handleGoToTransmit = () => {
    if (sessionId) {
      navigate(`/transmit/${sessionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-8">
      <div className="container mx-auto max-w-3xl">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Dashboard
        </Button>
        
        <Card className="bg-secondary/40 backdrop-blur-lg border-white/10 mb-8">
          <CardHeader>
            <CardTitle>{session?.name || "Sessão"}</CardTitle>
            <CardDescription>Gerencie sua sessão interativa</CardDescription>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="default" 
                className="h-auto py-4 px-4"
                onClick={handleGoToTransmit}
              >
                <div className="flex flex-col items-center text-center">
                  <MonitorPlay className="h-8 w-8 mb-2" />
                  <div>
                    <p className="font-semibold">Transmitir</p>
                    <p className="text-xs opacity-80">Exiba na tela grande</p>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-4 px-4 border-white/10"
              >
                <div className="flex flex-col items-center text-center">
                  <Smartphone className="h-8 w-8 mb-2" />
                  <div>
                    <p className="font-semibold">Dispositivos</p>
                    <p className="text-xs opacity-80">Gerencie participantes</p>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-end">
            <Button variant="ghost" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
              Encerrar Sessão
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
