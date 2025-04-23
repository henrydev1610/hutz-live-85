
import { useState, useEffect } from 'react';
import { useParticipantStore } from '@/stores/participantStore';
import { useSettingsStore } from '@/stores/settingsStore';
import Draggable from 'react-draggable';
import { QRCodeSVG } from 'qrcode.react';

const LivePreview = () => {
  const { participants } = useParticipantStore();
  const { layoutSettings, qrCodeSettings } = useSettingsStore();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [hostUrl, setHostUrl] = useState<string>('');
  
  // Get selected participants
  useEffect(() => {
    const selected = Object.keys(participants).filter(id => participants[id].selected);
    setSelectedParticipants(selected);
  }, [participants]);
  
  // Update the QR code URL
  useEffect(() => {
    // In a real application, this would be generated based on the session ID
    setHostUrl(`${window.location.origin}/participant`);
  }, []);
  
  // Create grid layout based on the number of participants
  const gridColumns = () => {
    const count = selectedParticipants.length;
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  return (
    <div
      className="w-full h-full overflow-hidden relative rounded-md"
      style={{
        backgroundColor: layoutSettings.backgroundColor,
        backgroundImage: layoutSettings.backgroundImage ? `url(${layoutSettings.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Preview Container for aspect ratio */}
      <div className="relative w-full h-full">
        {/* Participants Grid */}
        {selectedParticipants.length > 0 ? (
          <div 
            className="grid gap-1 p-1 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${gridColumns()}, 1fr)`
            }}
          >
            {selectedParticipants.map((id) => (
              <div key={id} className="bg-black rounded-sm overflow-hidden aspect-square">
                <video
                  id={`preview-${id}`}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white text-opacity-50">
            <p className="text-center">
              Nenhum participante selecionado.
              <br />
              <span className="text-sm">Selecione participantes na aba de Participantes.</span>
            </p>
          </div>
        )}
        
        {/* QR Code Overlay */}
        {qrCodeSettings.visible && (
          <Draggable
            bounds="parent"
            defaultPosition={qrCodeSettings.position}
            onStop={(_, data) => {
              const { x, y } = data;
              useSettingsStore.getState().updateQRCodeSettings({
                position: { x, y }
              });
            }}
          >
            <div 
              className="absolute cursor-move flex flex-col items-center"
              style={{ 
                width: `${qrCodeSettings.size}px`,
              }}
            >
              <div className="bg-white p-2 rounded-md shadow-lg">
                <QRCodeSVG 
                  value={hostUrl} 
                  size={qrCodeSettings.size - 16} 
                  className="w-full h-auto"
                />
              </div>
              {qrCodeSettings.text && (
                <div 
                  className="mt-2 text-center px-2 py-1 bg-black bg-opacity-50 rounded-md"
                  style={{
                    fontFamily: qrCodeSettings.fontFamily,
                    color: qrCodeSettings.fontColor
                  }}
                >
                  {qrCodeSettings.text}
                </div>
              )}
            </div>
          </Draggable>
        )}
      </div>
    </div>
  );
};

export default LivePreview;
