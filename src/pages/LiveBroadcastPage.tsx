
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StreamPreview from '@/components/live/StreamPreview';
import { Participant } from '@/types/live';

const LiveBroadcastPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [windowTitle, setWindowTitle] = useState('Hutz Live Broadcast');
  
  const [broadcastData, setBroadcastData] = useState({
    participants: [] as Participant[],
    layout: 4,
    backgroundColor: '#000000',
    backgroundImage: null as string | null,
    qrCode: {
      visible: false,
      image: '',
      position: { x: 30, y: 30 },
      size: 150
    },
    qrCodeText: {
      text: '',
      position: { x: 30, y: 200 }
    },
    qrCodeFont: 'Arial',
    qrCodeColor: '#FFFFFF'
  });
  
  useEffect(() => {
    document.title = `Transmissão - ${sessionId}`;
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BROADCAST_DATA') {
        console.log('Received broadcast data:', event.data.payload);
        setBroadcastData(event.data.payload);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    if (window.opener) {
      window.opener.postMessage({ type: 'BROADCAST_READY', sessionId }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId]);
  
  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0">
        <StreamPreview 
          participants={broadcastData.participants}
          layout={broadcastData.layout}
          backgroundColor={broadcastData.backgroundColor}
          backgroundImage={broadcastData.backgroundImage}
          qrCode={broadcastData.qrCode}
          qrCodeText={broadcastData.qrCodeText}
          qrCodeFont={broadcastData.qrCodeFont}
          qrCodeColor={broadcastData.qrCodeColor}
        />
      </div>
    </div>
  );
};

export default LiveBroadcastPage;
