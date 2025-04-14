
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SelectedImagePreviewProps {
  selectedImage: string;
  imageDuration: number;
  onDurationChange: (duration: number) => void;
  onAddToTimeline: () => void;
}

const SelectedImagePreview = ({
  selectedImage,
  imageDuration,
  onDurationChange,
  onAddToTimeline
}: SelectedImagePreviewProps) => {
  const { toast } = useToast();

  return (
    <div className="border border-white/10 rounded-lg p-4">
      <h4 className="text-sm font-medium mb-2">Imagem Selecionada</h4>
      
      <div className="space-y-4">
        <div className="w-full rounded-md overflow-hidden">
          <img 
            src={selectedImage} 
            alt="Imagem selecionada" 
            className="w-full h-auto object-cover max-h-32"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="imageDuration">Duração da Imagem (segundos)</Label>
          <Input 
            id="imageDuration" 
            type="number" 
            min={0.5} 
            step={0.5} 
            value={imageDuration} 
            onChange={(e) => onDurationChange(Number(e.target.value))} 
          />
        </div>
        
        <Button onClick={onAddToTimeline} className="hutz-button-primary w-full">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar à Timeline
        </Button>
      </div>
    </div>
  );
};

export default SelectedImagePreview;
