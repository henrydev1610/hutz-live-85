
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSession } from "@/utils/sessionUtils";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";

export default function CreateSessionPage() {
  const [sessionName, setSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionName.trim()) {
      toast({
        title: "Nome da sessão necessário",
        description: "Por favor, informe um nome para sua sessão.",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      const sessionId = createSession(sessionName);
      
      if (sessionId) {
        toast({
          title: "Sessão criada com sucesso",
          description: "Redirecionando para a página da sessão."
        });
        navigate(`/session/${sessionId}`);
      } else {
        throw new Error("Falha ao criar sessão");
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: "Erro ao criar sessão",
        description: "Ocorreu um erro ao criar sua sessão. Por favor, tente novamente.",
        variant: "destructive"
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-8">
      <div className="container mx-auto max-w-lg">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <Card className="bg-secondary/40 backdrop-blur-lg border-white/10">
          <CardHeader>
            <CardTitle>Criar Nova Sessão</CardTitle>
            <CardDescription>Configure os detalhes da sua sessão interativa</CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da Sessão</Label>
                <Input
                  id="sessionName"
                  placeholder="Ex: Workshop Interativo"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="bg-secondary/40 border-white/10"
                />
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Sessão"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
