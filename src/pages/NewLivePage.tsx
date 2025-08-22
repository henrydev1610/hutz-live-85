import React, { useState, useMemo } from 'react';
import { TwilioRoomProvider } from '@/contexts/TwilioRoomContext';
import TwilioRoomView from '@/components/twilio/TwilioRoomView';
import { generateSessionId } from '@/utils/sessionUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';

const NewLivePage: React.FC = () => {
  // Generate stable session ID and identity
  const sessionId = useMemo(() => generateSessionId(), []);
  const hostIdentity = useMemo(() => `host-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // QR Code state
  const [qrCodeURL, setQrCodeURL] = useState<string>('');
  const [showQRCode, setShowQRCode] = useState(false);

  // Generate QR Code for participants
  const generateQRCode = async () => {
    try {
      console.log('🔗 Generating QR Code for session:', sessionId);
      
      const baseURL = window.location.origin;
      const participantURL = `${baseURL}/participant/${sessionId}?qr=true&mobile=true`;
      
      // Generate QR code using qrcode library
      const QRCode = await import('qrcode');
      const qrDataURL = await QRCode.toDataURL(participantURL, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeURL(qrDataURL);
      setShowQRCode(true);
      
      toast.success('✅ QR Code gerado com sucesso!');
      console.log('✅ QR Code generated:', participantURL);
      
    } catch (error) {
      console.error('❌ Failed to generate QR Code:', error);
      toast.error('❌ Erro ao gerar QR Code');
    }
  };

  // Copy participant link
  const copyParticipantLink = () => {
    const baseURL = window.location.origin;
    const participantURL = `${baseURL}/participant/${sessionId}?qr=true&mobile=true`;
    
    navigator.clipboard.writeText(participantURL).then(() => {
      toast.success('🔗 Link copiado para a área de transferência');
    }).catch(() => {
      toast.error('❌ Erro ao copiar link');
    });
  };

  return (
    <TwilioRoomProvider>
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📹 Sala ao Vivo - Twilio Video Rooms
                <span className="text-sm font-normal text-muted-foreground">
                  ID: {sessionId}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={generateQRCode} className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Gerar QR Code
                </Button>
                
                <Button onClick={copyParticipantLink} variant="outline" className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Copiar Link
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Display */}
          {showQRCode && qrCodeURL && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code para Participantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="bg-white p-4 rounded-lg border">
                    <img src={qrCodeURL} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <Label htmlFor="participant-link">Link para Participantes:</Label>
                      <Input
                        id="participant-link"
                        value={`${window.location.origin}/participant/${sessionId}?qr=true&mobile=true`}
                        readOnly
                        className="mt-1"
                      />
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">📱 Instruções:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Participantes devem escanear o QR Code com celular</li>
                        <li>• Ou acessar o link diretamente no celular</li>
                        <li>• A câmera será ativada automaticamente</li>
                        <li>• Funciona apenas em dispositivos móveis</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Video Room */}
          <TwilioRoomView
            identity={hostIdentity}
            roomName={sessionId}
            autoConnect={true}
            showLocalVideo={true}
            className="w-full"
          />

          {/* Debug Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">🔧 Debug Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Session ID:</strong><br />
                  <code className="text-xs bg-muted p-1 rounded">{sessionId}</code>
                </div>
                <div>
                  <strong>Host Identity:</strong><br />
                  <code className="text-xs bg-muted p-1 rounded">{hostIdentity}</code>
                </div>
                <div>
                  <strong>Technology:</strong><br />
                  <span className="text-green-600">✅ 100% Twilio Video Rooms</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </TwilioRoomProvider>
  );
};

export default NewLivePage;