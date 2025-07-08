
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Monitor } from "lucide-react";

interface ParticipantVideoPreviewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  hasVideo: boolean;
  hasAudio: boolean;
  hasScreenShare: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({
  localVideoRef,
  hasVideo,
  hasAudio,
  hasScreenShare,
  isVideoEnabled,
  isAudioEnabled
}) => {
  const [videoLoaded, setVideoLoaded] = React.useState(false);
  
  React.useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    
    const handleLoadedData = () => {
      console.log('📹 PREVIEW: Video loaded');
      setVideoLoaded(true);
    };
    
    const handleError = () => {
      console.log('📹 PREVIEW: Video error');
      setVideoLoaded(false);
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [localVideoRef]);
  
  return (
    <Card className="mb-6 bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Sua Transmissão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ display: hasVideo && isVideoEnabled && videoLoaded ? 'block' : 'none' }}
          />
          
          {(!hasVideo || !isVideoEnabled || !videoLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">
                  {!hasVideo ? 'Câmera não disponível' : 
                   !isVideoEnabled ? 'Câmera desabilitada' : 
                   'Carregando vídeo...'}
                </p>
              </div>
            </div>
          )}
          
          <div className="absolute top-4 left-4 flex gap-2">
            {hasVideo && (
              <Badge variant={isVideoEnabled ? "default" : "destructive"}>
                {isVideoEnabled ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
              </Badge>
            )}
            {hasAudio && (
              <Badge variant={isAudioEnabled ? "default" : "destructive"}>
                {isAudioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              </Badge>
            )}
            {hasScreenShare && (
              <Badge variant="default">
                <Monitor className="h-3 w-3" />
              </Badge>
            )}
          </div>
          
          {/* Debug info */}
          <div className="absolute bottom-2 right-2 text-xs text-white/50">
            V:{hasVideo?'✓':'✗'} E:{isVideoEnabled?'✓':'✗'} L:{videoLoaded?'✓':'✗'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantVideoPreview;
