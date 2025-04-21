import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Smartphone, Tv2, Users, Video, Plus, Search, MoreVertical, Trash2, Type, Zap } from "lucide-react";
import { getStoredSessions, removeSession, Session } from "@/utils/sessionUtils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Load sessions from localStorage
    loadSessions();
  }, []);

  const loadSessions = () => {
    const storedSessions = getStoredSessions();
    setSessions(storedSessions);
  };

  const handleCreateSession = () => {
    navigate("/create");
  };

  const handleSessionClick = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSession(sessionId);
    loadSessions();
  };

  const filteredSessions = sessions.filter(session => 
    session.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateLightshow = () => {
    navigate("/lightshow");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <div className="container py-8 mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Hutz Live</h1>
            <p className="text-muted-foreground mt-1">Crie e gerencie suas sessões interativas</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Buscar sessões..." 
                className="pl-9 bg-secondary/40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button onClick={handleCreateSession}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
            </Button>
            
            <Button variant="outline" onClick={handleCreateLightshow} className="border-white/10">
              <Zap className="mr-2 h-4 w-4" />
              Lightshow
            </Button>
          </div>
        </div>
        
        {filteredSessions.length === 0 ? (
          <Card className="bg-secondary/40 backdrop-blur-lg border-white/10">
            <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center">
              <Users className="h-16 w-16 text-primary/60 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Sem sessões ainda</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Crie sua primeira sessão para começar a interagir com sua audiência em tempo real.
              </p>
              <Button onClick={handleCreateSession}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Sessão
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <Card 
                key={session.id} 
                className="bg-secondary/40 backdrop-blur-lg border-white/10 cursor-pointer hover:bg-secondary/60 transition-colors"
                onClick={() => handleSessionClick(session.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                      Sessão ao vivo
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-secondary/95 backdrop-blur-lg border-white/10">
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <CardTitle className="flex items-center">
                    <Type className="h-5 w-5 mr-2 text-white/70" />
                    {session.name}
                  </CardTitle>
                  
                  <CardDescription>
                    Criada em {format(new Date(session.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-1.5" />
                    <span>{session.participantCount || 0} participantes</span>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button variant="outline" size="sm" className="border-white/10">
                      <Video className="h-3.5 w-3.5 mr-1.5" />
                      Transmitir
                    </Button>
                    <Button variant="outline" size="sm" className="border-white/10">
                      <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                      Dispositivos
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
