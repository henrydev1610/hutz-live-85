
import { Button } from "@/components/ui/button";
import { Play, Pause, Wand2, RotateCcw, Flashlight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
