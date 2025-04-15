
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
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  useEffect(() => {
    // Check if there are image items in the timeline
    const imageItems = timelineItems.filter(item => item.type === 'image');
    setHasImages(imageItems.length > 0);
    
    if (imageItems.length > 0) {
      console.log("Image items detected:", imageItems.length);
    }
  }, [timelineItems]);
  
  const handleGenerateClick = () => {
    if (isGenerating) {
      toast({
        title: "Processamento em andamento",
        description: "Um arquivo já está sendo gerado, aguarde até que seja concluído.",
      });
      return;
    }
    
    console.log("Generate button clicked, timeline items:", timelineItems.length);
    
    // Log item counts by type
    const itemCounts = {
      image: timelineItems.filter(item => item.type === 'image').length,
      flashlight: timelineItems.filter(item => item.type === 'flashlight').length,
      callToAction: timelineItems.filter(item => item.type === 'callToAction').length
    };
    console.log("Timeline items by type:", itemCounts);
    
    setIsGenerating(true);
    setDownloadProgress(0);
    
    // Start progress animation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      if (progress > 95) {
        clearInterval(progressInterval);
      } else {
        setDownloadProgress(progress);
      }
    }, 300);
    
    // Show toast to indicate generation has started
    toast({
      title: "Gerando arquivo...",
      description: "O processo pode levar alguns segundos, aguarde o download iniciar automaticamente.",
    });
    
    // Call the generate function
    try {
      handleGenerateFile();
      
      // Set a timeout to monitor if download has started
      setTimeout(() => {
        if (isGenerating) {
          console.log("Setting fallback timer to reset generating state if download doesn't start");
          setIsGenerating(false);
          clearInterval(progressInterval);
          setDownloadProgress(0);
          toast({
            title: "Problema na geração",
            description: "Houve um problema ao gerar o arquivo. Verifique o console para mais detalhes e tente novamente.",
            variant: "destructive"
          });
        }
      }, 20000);
      
    } catch (error) {
      console.error("Error during generate file:", error);
      setIsGenerating(false);
      clearInterval(progressInterval);
      setDownloadProgress(0);
      
      toast({
        title: "Erro na geração",
        description: `Ocorreu um erro ao gerar o arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    }
  };
  
  // Function to reset generating state - will be called from useLightShowLogic
  window.resetGeneratingState = () => {
    console.log("Resetting generating state from external call");
    setIsGenerating(false);
    setDownloadProgress(100);
    
    // Reset progress after showing 100%
    setTimeout(() => {
      setDownloadProgress(0);
    }, 1000);
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
        <div className="relative w-full">
          <Button 
            onClick={handleGenerateClick} 
            className={`hutz-button-accent w-full ${isDisabled ? 'opacity-50' : (!isGenerating && 'animate-pulse')}`}
            disabled={isDisabled || isGenerating}
          >
            {isGenerating ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-spin" />
                Gerando... {downloadProgress}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar Arquivo .WAV
              </>
            )}
          </Button>
          
          {isGenerating && (
            <div className="absolute left-0 bottom-0 h-1 bg-green-500 transition-all duration-300" 
                style={{ width: `${downloadProgress}%` }} />
          )}
        </div>
        
        <Button variant="outline" className="border-white/20 hover:bg-secondary">
          <Save className="h-4 w-4 mr-2" />
          Salvar Projeto
        </Button>
      </div>
    </div>
  );
};

export default Header;
