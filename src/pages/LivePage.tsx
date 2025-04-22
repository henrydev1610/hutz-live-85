import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Copy, QrCode, Users, Video, Settings, Share2 } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import ParticipantGrid, { Participant } from '@/components/live/ParticipantGrid';
import QRCode from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

// Mock data for connected participants
interface ConnectedParticipant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  isAdmin?: boolean;
  connectedAt?: number;
}

const LivePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [sessionId, setSessionId] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeTab, setActiveTab] = useState('participants');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantStreams, setParticipantStreams] = useState<{[key: string]: MediaStream}>({});
  
  // Mock data for testing
  const connectedParticipants: ConnectedParticipant[] = [
    { id: '1', name: 'João Silva', active: true, selected: true, hasVideo: true, connectedAt: Date.now() - 300000 },
    { id: '2', name: 'Maria Oliveira', active: true, selected: false, hasVideo: false, connectedAt: Date.now() - 600000 },
    { id: '3', name: 'Carlos Santos', active: false, selected: false, hasVideo: true, connectedAt: Date.now() - 900000 },
    { id: '4', name: 'Ana Pereira', active: true, selected: true, hasVideo: true, isAdmin: true, connectedAt: Date.now() - 1200000 },
  ];

  // Make sure when creating participants to include the required joinedAt and lastActive fields
  const participantsData: Participant[] = connectedParticipants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    joinedAt: participant.connectedAt || Date.now(),
    lastActive: Date.now(),
    active: participant.active,
    selected: participant.selected,
    hasVideo: participant.hasVideo || false,
    connectedAt: participant.connectedAt
  }));
  
  useEffect(() => {
    // Initialize with mock data for now
    setParticipants(participantsData);
    
    // In a real app, you would:
    // 1. Check if there's an active session
    // 2. Connect to the session
    // 3. Load participants
    
    return () => {
      // Cleanup: close connections, etc.
    };
  }, []);
  
  const createNewSession = async () => {
    setIsCreatingSession(true);
    
    try {
      // Generate a unique session ID
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      
      // In a real app, you would:
      // 1. Create a session in your database
      // 2. Set up WebRTC/WebSocket connections
      // 3. Initialize the session state
      
      setIsSessionActive(true);
      
      toast({
        title: "Sessão criada",
        description: `Nova sessão iniciada com ID: ${newSessionId.substring(0, 8)}...`,
      });
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        variant: "destructive",
        title: "Erro ao criar sessão",
        description: "Não foi possível iniciar uma nova sessão.",
      });
    } finally {
      setIsCreatingSession(false);
    }
  };
  
  const endSession = async () => {
    try {
      // In a real app, you would:
      // 1. Close all connections
      // 2. Update the session status in your database
      // 3. Clean up resources
      
      setIsSessionActive(false);
      setSessionId('');
      setParticipants([]);
      
      toast({
        title: "Sessão encerrada",
        description: "A sessão foi encerrada com sucesso.",
      });
    } catch (error) {
      console.error("Error ending session:", error);
      toast({
        variant: "destructive",
        title: "Erro ao encerrar sessão",
        description: "Não foi possível encerrar a sessão corretamente.",
      });
    }
  };
  
  const copySessionLink = () => {
    const link = `${window.location.origin}/participant/${sessionId}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link copiado",
      description: "Link da sessão copiado para a área de transferência.",
    });
  };
  
  const handleToggleSelect = (participantId: string) => {
    setParticipants(prev => 
      prev.map(p => 
        p.id === participantId 
          ? { ...p, selected: !p.selected } 
          : p
      )
    );
  };
  
  const handleRemoveParticipant = (participantId: string) => {
    // In a real app, you would:
    // 1. Close the connection with this participant
    // 2. Update your database
    
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    
    toast({
      title: "Participante removido",
      description: "O participante foi removido da sessão.",
    });
  };
  
  const handleToggleAdminStatus = (participantId: string) => {
    setParticipants(prev => 
      prev.map(p => 
        p.id === participantId 
          ? { ...p, isAdmin: !p.isAdmin } 
          : p
      )
    );
    
    const participant = participants.find(p => p.id === participantId);
    
    toast({
      title: participant?.isAdmin ? "Admin removido" : "Admin adicionado",
      description: `${participant?.name} ${participant?.isAdmin ? "não é mais admin" : "agora é admin"}.`,
    });
  };
  
  // Render the session creation UI if no session is active
  if (!isSessionActive) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-6">Momento Live</h1>
          
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>Iniciar Nova Sessão</CardTitle>
              <CardDescription>
                Crie uma nova sessão para permitir que os participantes se conectem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/70">
                Ao iniciar uma sessão, você poderá:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-1">
                <li>Compartilhar um link ou QR code para os participantes</li>
                <li>Ver e gerenciar participantes conectados</li>
                <li>Selecionar participantes para exibição</li>
                <li>Controlar quem pode ser visto pelos outros</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={createNewSession}
                disabled={isCreatingSession}
                className="hutz-button-primary"
              >
                {isCreatingSession ? "Criando..." : "Iniciar Nova Sessão"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }
  
  // Render the active session UI
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Momento Live</h1>
            <p className="text-white/70">
              Sessão: {sessionId.substring(0, 8)}...
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="hutz-button-secondary"
              onClick={copySessionLink}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar Link
            </Button>
            
            <Button
              variant="destructive"
              onClick={endSession}
            >
              Encerrar Sessão
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
              <CardHeader className="pb-2">
                <CardTitle>Participantes</CardTitle>
                <CardDescription>
                  {participants.length} participantes conectados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ParticipantGrid 
                  sessionId={sessionId}
                  participants={participants}
                  participantStreams={participantStreams}
                  onToggleSelect={handleToggleSelect}
                  onRemoveParticipant={handleRemoveParticipant}
                  onToggleAdminStatus={handleToggleAdminStatus}
                  showAdminControls={true}
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
              <CardHeader>
                <CardTitle>Compartilhar</CardTitle>
                <CardDescription>
                  Convide participantes para a sessão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg flex justify-center">
                  <QRCode 
                    value={`${window.location.origin}/participant/${sessionId}`}
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-white/70">Link da sessão:</p>
                  <div className="flex">
                    <Input 
                      value={`${window.location.origin}/participant/${sessionId}`}
                      readOnly
                      className="hutz-input rounded-r-none"
                    />
                    <Button
                      className="rounded-l-none"
                      onClick={copySessionLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <Button className="w-full hutz-button-secondary" onClick={copySessionLink}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar Link
                </Button>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Total de participantes:</span>
                  <span className="font-bold">{participants.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Participantes ativos:</span>
                  <span className="font-bold">{participants.filter(p => p.active).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Com vídeo:</span>
                  <span className="font-bold">{participants.filter(p => p.hasVideo).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Selecionados:</span>
                  <span className="font-bold">{participants.filter(p => p.selected).length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
