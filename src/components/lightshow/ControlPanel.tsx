
import { Button } from "@/components/ui/button";
import { Play, Pause, Wand2, RotateCcw, Flashlight, ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { TimelineItem } from "@/types/lightshow";

interface ControlPanelProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioFile: File | null;
  onPlayPause: () => void;
  addFlashlightPattern: () => void;
  addImageToTimeline: (imageUrl: string, duration?: number, startTime?: number) => void;
  generateAutoSyncPatterns: () => void;
  generateAutoImageSequence?: () => void; // Optional
  handleReset: () => void;
  selectedImages?: string[]; // Array of selected images
  onAddSelectedImages?: () => void; // Callback to add selected images to timeline
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
  generateAutoImageSequence,
  handleReset,
  selectedImages = [],
  onAddSelectedImages
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
        {selectedImages && selectedImages.length > 0 && onAddSelectedImages && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddSelectedImages}
            disabled={!audioFile}
            className="bg-sky-950/40"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Adicionar Imagens ({selectedImages.length})
          </Button>
        )}
        
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
