import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Check, UserPlus, UserMinus, Loader2, X, Tv2, AlertTriangle } from "lucide-react";
import { generateSessionId, isSessionActive, createSession, endSession, getSessionParticipants, addParticipantToSession, updateParticipantStatus } from "@/utils/sessionUtils";
import ParticipantGrid from "@/components/live/ParticipantGrid";
import { initHostWebRTC, cleanupWebRTC, setLocalStream } from '@/utils/webrtc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

const TelaoPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const [sessionId, setSessionId] = useState(routeSessionId || '');
  const [newSessionId, setNewSessionId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [broadcastChannel, setBroadcastChannel] = useState<BroadcastChannel | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [finalAction, setFinalAction] = useState<'redirect' | 'none'>('none');
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const [finalActionTimerId, setFinalActionTimerId] = useState<NodeJS.Timeout | null>(null);
  const [isH264Preferred, setIsH264Preferred] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState<number>(6);
  const [supabaseChannel, setSupabaseChannel] = useState<any>(null);
  const [isSessionFull, setIsSessionFull] = useState(false);
  const [sessionCheckInterval, setSessionCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [sessionHeartbeatInterval, setSessionHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (routeSessionId) {
      setSessionId(routeSessionId);
      checkAndInitializeSession(routeSessionId);
    }
  }, [routeSessionId]);

  const checkAndInitializeSession = async (id: string) => {
    if (!id) return;
    
    try {
      const isActive = isSessionActive(id);
      if (isActive) {
        initializeSession(id);
      } else {
        toast({
          title: "Sessão não encontrada",
          description: "A sessão não existe ou expirou.",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error("Error checking session:", e);
      toast({
        title: "Erro ao verificar sessão",
        description: "Não foi possível verificar o estado da sessão.",
        variant: "destructive"
      });
    }
  };

  const initializeSession = (id: string) => {
    setIsStarting(true);
    
    try {
      createSession(id);
      
      const channel = new BroadcastChannel(`telao-session-${id}`);
      setBroadcastChannel(channel);
      
      channel.addEventListener('message', handleBroadcastMessage);
      
      const participants = getSessionParticipants(id);
      setParticipantList(participants);
      
      const heartbeatInterval = setInterval(() => {
        const timestamps = participants
          .filter(p => p.active)
          .map(p => p.lastActive || 0);
        
        if (timestamps.length > 0) {
          const latestActivity = Math.max(...timestamps);
          const now = Date.now();
          
          if (now - latestActivity > 5 * 60 * 1000) {
            const stillActive = isSessionActive(id);
            if (!stillActive) {
              endLiveSession();
            }
          }
        }
      }, 60 * 1000);
      
      setSessionHeartbeatInterval(heartbeatInterval);
      setIsLive(true);
      
      generateQRCode(id);
      
      toast({
        title: "Sessão inicializada",
        description: "A sessão foi inicializada com sucesso.",
      });
    } catch (e) {
      console.error("Error initializing session:", e);
      toast({
        title: "Erro ao inicializar sessão",
        description: "Não foi possível inicializar a sessão.",
        variant: "destructive"
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleBroadcastMessage = (event: MessageEvent) => {
    const { type, id, participants, timestamp } = event.data;
    
    if (type === 'participant-join' && id) {
      handleParticipantJoin(id);
    } else if (type === 'participant-leave' && id) {
      handleParticipantLeave(id);
    } else if (type === 'participant-update' && participants) {
      setParticipantList(participants);
    }
  };

  const handleParticipantJoin = (id: string) => {
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === id);
      if (exists) {
        return prev.map(p => p.id === id ? { ...p, active: true } : p);
      }
      
      const newParticipant = {
        id,
        name: `Participante ${prev.length + 1}`,
        active: true,
        selected: prev.length === 0,
        hasVideo: false,
        connectedAt: Date.now()
      };
      
      addParticipantToSession(sessionId, id, newParticipant.name);
      
      toast({
        title: "Novo participante",
        description: `${newParticipant.name} entrou na sessão.`,
      });
      
      return [...prev, newParticipant];
    });
  };

  const handleParticipantLeave = (id: string) => {
    setParticipantList(prev => 
      prev.map(p => p.id === id ? { ...p, active: false } : p)
    );
    
    if (sessionId) {
      updateParticipantStatus(sessionId, id, { active: false });
    }
    
    cleanupWebRTC(id);
  };

  const generateQRCode = async (id: string) => {
    try {
      const origin = window.location.origin;
      const participantUrl = `${origin}/participant/${id}`;
      
      const qrDataUrl = await QRCode.toDataURL(participantUrl, {
        margin: 1,
        width: 250
      });
      
      setQrCode(qrDataUrl);
    } catch (e) {
      console.error("Error generating QR code:", e);
    }
  };

  const startLiveSession = async () => {
    setIsStarting(true);
    
    try {
      const id = newSessionId || generateSessionId();
      setSessionId(id);
      
      initializeSession(id);
      
      navigate(`/telao/${id}`, { replace: true });
    } catch (e) {
      console.error("Error starting session:", e);
      toast({
        title: "Erro ao iniciar sessão",
        description: "Não foi possível iniciar a sessão.",
        variant: "destructive"
      });
    } finally {
      setIsStarting(false);
    }
  };

  const endLiveSession = () => {
    setIsStopping(true);
    
    try {
      if (sessionId) {
        endSession(sessionId);
      }
      
      if (broadcastChannel) {
        broadcastChannel.close();
        setBroadcastChannel(null);
      }
      
      if (sessionHeartbeatInterval) {
        clearInterval(sessionHeartbeatInterval);
        setSessionHeartbeatInterval(null);
      }
      
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        setSessionCheckInterval(null);
      }
      
      cleanupWebRTC();
      
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        setScreenShareStream(null);
        setIsScreenSharing(false);
      }
      
      setIsLive(false);
      setSessionId('');
      setNewSessionId('');
      setQrCode('');
      setParticipantList([]);
      setSelectedParticipantId(null);
      
      navigate('/telao', { replace: true });
      
      toast({
        title: "Sessão encerrada",
        description: "A sessão foi encerrada com sucesso.",
      });
    } catch (e) {
      console.error("Error ending session:", e);
      toast({
        title: "Erro ao encerrar sessão",
        description: "Não foi possível encerrar a sessão corretamente.",
        variant: "destructive"
      });
    } finally {
      setIsStopping(false);
    }
  };

  const handleSelectParticipant = (id: string) => {
    setParticipantList(prev => 
      prev.map(p => ({
        ...p,
        selected: p.id === id ? !p.selected : p.selected
      }))
    );
    
    if (sessionId) {
      const participant = participantList.find(p => p.id === id);
      if (participant) {
        updateParticipantStatus(sessionId, id, { selected: !participant.selected });
      }
    }
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipantList(prev => 
      prev.filter(p => p.id !== id)
    );
    
    if (sessionId) {
      updateParticipantStatus(sessionId, id, { active: false });
    }
    
    cleanupWebRTC(id);
    
    toast({
      title: "Participante removido",
      description: "O participante foi removido da sessão.",
    });
  };

  useEffect(() => {
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      
      if (sessionHeartbeatInterval) {
        clearInterval(sessionHeartbeatInterval);
      }
      
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
      
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
      }
      
      cleanupWebRTC();
    };
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Telão</h1>
      
      {!isLive ? (
        <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Iniciar Nova Sessão</h2>
              <p className="text-muted-foreground">
                Crie uma nova sessão para começar a receber participantes no telão.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Label htmlFor="sessionId">ID da Sessão (opcional)</Label>
                <Input
                  id="sessionId"
                  placeholder="Deixe em branco para gerar automaticamente"
                  value={newSessionId}
                  onChange={(e) => setNewSessionId(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode definir um ID personalizado ou deixar em branco para gerar automaticamente.
                </p>
              </div>
              <div className="flex items-end">
                <Button 
                  className="w-full sm:w-auto hutz-button-accent" 
                  onClick={startLiveSession}
                  disabled={isStarting}
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Tv2 className="mr-2 h-4 w-4" />
                      Iniciar Sessão
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="mt-8 border-t border-white/10 pt-4">
              <h3 className="text-lg font-medium mb-2">Ou continuar uma sessão existente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-secondary/20 border border-white/5">
                  <CardContent className="p-4 flex flex-col items-center justify-center h-32">
                    <p className="text-white/50 text-center">
                      Nenhuma sessão recente encontrada
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 h-full">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600 text-white border-green-700">
                        Ao vivo
                      </Badge>
                      Sessão: {sessionId}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Compartilhe o QR code para que os participantes entrem na sessão
                    </p>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isStopping}>
                        {isStopping ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Encerrando...
                          </>
                        ) : (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            Encerrar Sessão
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Encerrar Sessão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja encerrar esta sessão? Todos os participantes serão desconectados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={endLiveSession}>Encerrar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <div className="bg-secondary/20 border border-white/10 rounded-lg p-6 flex flex-col items-center">
                    {qrCode ? (
                      <img src={qrCode} alt="QR Code" className="w-40 h-40 mb-4" />
                    ) : (
                      <div className="w-40 h-40 bg-secondary/50 rounded-lg mb-4 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
                      </div>
                    )}
                    
                    <p className="text-sm text-center text-white/70 mb-2">
                      Escaneie este QR Code para participar
                    </p>
                    
                    <div className="flex gap-2 mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          const url = `${window.location.origin}/participant/${sessionId}`;
                          navigator.clipboard.writeText(url);
                          toast({
                            title: "Link copiado",
                            description: "O link foi copiado para a área de transferência.",
                          });
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Link
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/20 border border-white/10 rounded-lg p-6">
                    <h3 className="text-lg font-medium mb-4">Estatísticas da Sessão</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-white/70">Participantes Ativos</span>
                          <span className="text-sm font-medium">
                            {participantList.filter(p => p.active).length}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent" 
                            style={{ 
                              width: `${(participantList.filter(p => p.active).length / maxParticipants) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-white/70">Participantes Selecionados</span>
                          <span className="text-sm font-medium">
                            {participantList.filter(p => p.selected).length}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-white/70">Limite de Participantes</span>
                          <span className="text-sm font-medium">{maxParticipants}</span>
                        </div>
                        <Slider
                          value={[maxParticipants]}
                          min={1}
                          max={16}
                          step={1}
                          onValueChange={(value) => setMaxParticipants(value[0])}
                          className="mt-2"
                        />
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="h264-preferred"
                          checked={isH264Preferred}
                          onCheckedChange={setIsH264Preferred}
                        />
                        <Label htmlFor="h264-preferred">Preferir codec H.264</Label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <ParticipantGrid
                  participants={participantList}
                  onSelectParticipant={handleSelectParticipant}
                  onRemoveParticipant={handleRemoveParticipant}
                />
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 mb-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4">Visualização em Tempo Real</h3>
                
                <div className="aspect-video bg-black/50 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                  {selectedParticipantId ? (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <video 
                        id="participantVideo"
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <UserPlus className="h-12 w-12 text-white/20 mx-auto mb-2" />
                      <p className="text-white/50">
                        Selecione um participante para visualizar
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={!selectedParticipantId}>
                    Ver em Tela Cheia
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4">Compartilhamento de Tela</h3>
                
                <div className="mb-4">
                  <Button 
                    className="w-full" 
                    variant={isScreenSharing ? "destructive" : "default"}
                    onClick={async () => {
                      if (isScreenSharing && screenShareStream) {
                        screenShareStream.getTracks().forEach(track => track.stop());
                        setScreenShareStream(null);
                        setIsScreenSharing(false);
                      } else {
                        try {
                          const stream = await navigator.mediaDevices.getDisplayMedia({
                            video: true,
                            audio: false,
                          });
                          
                          setScreenShareStream(stream);
                          setLocalStream(stream);
                          setIsScreenSharing(true);
                          
                          toast({
                            title: "Compartilhamento de tela ativo",
                            description: "Sua tela está sendo compartilhada com os participantes.",
                          });
                        } catch (e) {
                          console.error("Error starting screen share:", e);
                          toast({
                            title: "Erro",
                            description: "Não foi possível iniciar o compartilhamento de tela.",
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                  >
                    {isScreenSharing ? (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Parar Compartilhamento
                      </>
                    ) : (
                      <>
                        <Tv2 className="mr-2 h-4 w-4" />
                        Compartilhar Tela
                      </>
                    )}
                  </Button>
                </div>
                
                {isScreenSharing && (
                  <div className="bg-secondary/20 border border-white/10 rounded-lg p-4 text-center">
                    <div className="inline-flex items-center justify-center bg-green-500/20 text-green-500 h-8 w-8 rounded-full mb-2">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-white/70 text-sm">
                      Compartilhamento de tela ativo
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelaoPage;
