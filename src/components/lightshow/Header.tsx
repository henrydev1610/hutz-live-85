
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { TimelineItem } from "@/types/lightshow";
import { useToast } from "@/components/ui/use-toast";

interface HeaderProps {
  showName: string;
  onShowNameChange: (name: string) => void;
  handleGenerateFile: () => void;
  audioFile: File | null;
  timelineItems: TimelineItem[];
}

const Header = ({
  showName,
  onShowNameChange,
  handleGenerateFile,
  audioFile,
  timelineItems,
}: HeaderProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasImages, setHasImages] = useState(false);
  
  useEffect(() => {
    // Check if there are image items in the timeline
    const imageItems = timelineItems.filter(item => item.type === 'image');
    setHasImages(imageItems.length > 0);
  }, [timelineItems]);
  
  const handleGenerateClick = () => {
    console.log("Generate button clicked, timeline items:", timelineItems.length);
    console.log("Timeline contains images:", hasImages);
    
    // Detailed logging of each item type
    const itemTypes = timelineItems.map(item => {
      if (item.type === 'image') {
        return `image (url: ${item.imageUrl?.substring(0, 30)}...)`;
      }
      return item.type;
    });
    console.log("Timeline item details:", itemTypes);
    
    setIsGenerating(true);
    
    // Show toast to indicate generation has started
    toast({
      title: "Gerando arquivo...",
      description: "O processo pode levar alguns segundos, aguarde o download iniciar automaticamente.",
    });
    
    // Call the generate function
    handleGenerateFile();
    
    // Reset after a timeout
    setTimeout(() => {
      console.log("Generation timeout completed");
      setIsGenerating(false);
    }, 15000);
  };
  
  const isDisabled = !audioFile || !timelineItems.length;

  return (
    <div className="mb-4 flex flex-wrap gap-4 items-center">
      <div className="flex-1">
        <Label htmlFor="show-name" className="mb-2 block">Nome do Show</Label>
        <Input
          id="show-name"
          value={showName}
          onChange={(e) => onShowNameChange(e.target.value)}
          className="hutz-input w-full"
        />
      </div>
      
      <div className="flex-1 md:flex-initial flex gap-2">
        <Button 
          onClick={handleGenerateClick} 
          className={`hutz-button-accent ${isDisabled ? 'opacity-50' : 'animate-pulse'}`}
          disabled={isDisabled || isGenerating}
        >
          {isGenerating ? (
            <>
              <Download className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Gerar Arquivo .WAV
            </>
          )}
        </Button>
        
        <Button variant="outline" className="border-white/20 hover:bg-secondary">
          <Save className="h-4 w-4 mr-2" />
          Salvar Projeto
        </Button>
      </div>
    </div>
  );
};

export default Header;
