
import { Button } from "@/components/ui/button";
import { Play, Pause, Wand2, RotateCcw, Flashlight, Camera, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";

interface ControlPanelProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioFile: File | null;
  onPlayPause: () => void;
  addFlashlightPattern: () => void;
  addImageToTimeline: (imageUrl: string, duration?: number, startTime?: number) => void;
  generateAutoSyncPatterns: () => void;
  handleReset: () => void;
}

const ControlPanel = ({
  isPlaying,
  currentTime,
  duration,
  audioFile,
  onPlayPause,
  addFlashlightPattern,
  addImageToTimeline,
  generateAutoSyncPatterns,
  handleReset
}: ControlPanelProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      videoElement.className = 'fixed top-4 right-4 w-64 h-48 z-50 rounded-lg shadow-lg';
      videoElement.autoplay = true;
      videoElement.id = 'webcam-preview';
      
      // Check if element already exists
      if (!document.getElementById('webcam-preview')) {
        document.body.appendChild(videoElement);
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing webcam:', error);
      toast({
        title: "Erro de acesso à câmera",
        description: "Não foi possível acessar sua webcam. Verifique as permissões.",
        variant: "destructive"
      });
      return null;
    }
  };

  const takePicture = async () => {
    if (!isPlaying) {
      toast({
        title: "Áudio não está em reprodução",
        description: "Inicie a reprodução do áudio para tirar fotos.",
        variant: "destructive"
      });
      return;
    }

    const stream = await startWebcam();
    if (!stream) return;
    
    // Give the webcam a moment to initialize
    setTimeout(() => {
      const videoElement = document.getElementById('webcam-preview') as HTMLVideoElement;
      
      // Create canvas to capture the frame
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw video frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert to image and add to timeline
        const imageUrl = canvas.toDataURL('image/png');
        addImageToTimeline(imageUrl, 5, currentTime);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        videoElement.remove();
        
        toast({
          title: "Foto capturada",
          description: `Foto adicionada à timeline no tempo ${currentTime.toFixed(2)}s`,
        });
      }
    }, 500);
  };

  const toggleRecording = async () => {
    if (!isPlaying) {
      toast({
        title: "Áudio não está em reprodução",
        description: "Inicie a reprodução do áudio para gravar vídeo.",
        variant: "destructive"
      });
      return;
    }

    if (!isRecording) {
      // Start recording
      const stream = await startWebcam();
      if (!stream) return;
      
      videoChunksRef.current = [];
      
      try {
        const mediaRecorder = new MediaRecorder(stream);
        videoRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            videoChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          const videoUrl = URL.createObjectURL(blob);
          
          // We could add this video to the timeline, but for now let's just download it
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = `video-${Date.now()}.webm`;
          a.click();
          
          // Clean up
          const videoElement = document.getElementById('webcam-preview');
          if (videoElement) {
            videoElement.remove();
          }
          stream.getTracks().forEach(track => track.stop());
          
          toast({
            title: "Vídeo salvo",
            description: "Sua gravação foi salva como um arquivo de vídeo.",
          });
        };
        
        mediaRecorder.start();
        setIsRecording(true);
        
        toast({
          title: "Gravação iniciada",
          description: "A gravação de vídeo começou.",
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Erro na gravação",
          description: "Não foi possível iniciar a gravação de vídeo.",
          variant: "destructive"
        });
      }
    } else {
      // Stop recording
      if (videoRef.current && videoRef.current.state !== 'inactive') {
        videoRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  return (
    <div className="mb-4 flex items-center space-x-2">
      <Button 
        size="sm" 
        variant={isPlaying ? "default" : "outline"} 
        onClick={onPlayPause}
        className="w-20"
      >
        {isPlaying ? (
          <><Pause className="h-4 w-4 mr-2" /> Pause</>
        ) : (
          <><Play className="h-4 w-4 mr-2" /> Play</>
        )}
      </Button>
      
      <span className="text-sm text-white/70">
        {new Date(currentTime * 1000).toISOString().substr(14, 5)} / 
        {new Date(duration * 1000).toISOString().substr(14, 5)}
      </span>
      
      <div className="ml-auto flex flex-wrap space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={takePicture}
          disabled={!audioFile}
          className="bg-blue-950/40"
        >
          <Camera className="h-4 w-4 mr-2" />
          Capturar Foto
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={toggleRecording}
          disabled={!audioFile}
          className={`${isRecording ? 'bg-red-950/60 text-white' : 'bg-red-950/40'}`}
        >
          <Video className="h-4 w-4 mr-2" />
          {isRecording ? 'Parar Gravação' : 'Gravar Vídeo'}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={addFlashlightPattern}
          disabled={!audioFile}
          className="bg-purple-950/40"
        >
          <Flashlight className="h-4 w-4 mr-2" />
          Adicionar Lanterna
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={generateAutoSyncPatterns}
          disabled={!audioFile}
          className="bg-green-950/40"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Auto Light
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={!audioFile}
          className="bg-red-950/40"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;
