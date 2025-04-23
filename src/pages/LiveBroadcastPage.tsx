
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StreamPreview from '@/components/live/StreamPreview';

// In a real implementation this would get data from the parent window
// or through WebRTC connections
const LiveBroadcastPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [windowTitle, setWindowTitle] = useState('Hutz Live Broadcast');
  
  // Sample data for demonstration
  const [broadcastData, setBroadcastData] = useState({
    participants: [],
    layout: 4,
    backgroundColor: '#000000',
    backgroundImage: null,
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
    // Set window title
    document.title = `Transmissão - ${sessionId}`;
    
    // Try to get data from opener (parent window)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BROADCAST_DATA') {
        setBroadcastData(event.data.payload);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Send ready message to parent
    if (window.opener) {
      window.opener.postMessage({ type: 'BROADCAST_READY', sessionId }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId]);
  
  return (
    <div className="min-h-screen bg-black">
      {/* Full-screen broadcast view */}
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
