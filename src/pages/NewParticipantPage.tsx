import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TwilioRoomProvider } from '@/contexts/TwilioRoomContext';
import TwilioRoomView from '@/components/twilio/TwilioRoomView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import { toast } from 'sonner';
import { ArrowLeft, Smartphone, Camera } from 'lucide-react';

const NewParticipantPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Mobile-only guard
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });

  // Generate stable participant identity
  const participantIdentity = useMemo(() => 
    `participant-${Math.random().toString(36).substr(2, 9)}`, 
    []
  );

  // Custom name state
  const [customName, setCustomName] = useState('');
  const [useCustomName, setUseCustomName] = useState(false);

  // Final identity to use
  const finalIdentity = useCustomName && customName.trim() 
    ? customName.trim() 
    : participantIdentity;

  // Handle back navigation
  const handleBack = () => {
    navigate('/');
  };

  // Handle name change
  const handleNameSubmit = () => {
    if (customName.trim()) {
      setUseCustomName(true);
      toast.success(`✅ Nome definido: ${customName.trim()}`);
    }
  };

  // Show mobile guard messages
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Smartphone className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta página é exclusiva para dispositivos móveis. 
              Use seu celular para escanear o QR Code ou acessar o link.
            </p>
            <Button onClick={handleBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidated) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Validando acesso móvel...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              ID da sessão não encontrado.
            </p>
            <Button onClick={handleBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TwilioRoomProvider>
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          
          {/* Header */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                Participante - Sala {sessionId?.slice(-8)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Conectado via dispositivo móvel
              </div>
            </CardContent>
          </Card>

          {/* Name Configuration */}
          {!useCustomName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">👤 Configurar Nome (Opcional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="custom-name">Nome para exibição:</Label>
                  <Input
                    id="custom-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Digite seu nome..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleNameSubmit} 
                    disabled={!customName.trim()}
                    size="sm"
                  >
                    ✅ Usar Este Nome
                  </Button>
                  <Button 
                    onClick={() => setUseCustomName(true)} 
                    variant="outline"
                    size="sm"
                  >
                    Pular
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Room - Only show after name is configured */}
          {useCustomName && (
            <TwilioRoomView
              identity={finalIdentity}
              roomName={sessionId}
              autoConnect={true}
              showLocalVideo={true}
              className="w-full"
            />
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📱 Instruções</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  Sua câmera será ativada automaticamente
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  Use os controles para gerenciar áudio e vídeo
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">•</span>
                  Mantenha o celular na horizontal para melhor qualidade
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">•</span>
                  Certifique-se de ter uma boa conexão de internet
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">🔧 Info Técnica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div>
                  <strong>Identidade:</strong> <code className="bg-muted p-1 rounded">{finalIdentity}</code>
                </div>
                <div>
                  <strong>Sessão:</strong> <code className="bg-muted p-1 rounded">{sessionId}</code>
                </div>
                <div>
                  <strong>Dispositivo:</strong> <span className="text-green-600">📱 Móvel Validado</span>
                </div>
                <div>
                  <strong>Tecnologia:</strong> <span className="text-blue-600">🎥 Twilio Video Rooms</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Back Button */}
          <div className="pt-4">
            <Button onClick={handleBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Sair da Sala
            </Button>
          </div>

        </div>
      </div>
    </TwilioRoomProvider>
  );
};

export default NewParticipantPage;