
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Image, ImagePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ImageSelectorProps {
  onImageSelect: (imageUrl: string) => void;
}

const ImageSelector = ({ onImageSelect }: ImageSelectorProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Demo images
  const demoImages = [
    '/lovable-uploads/61fbbc73-9e63-4f43-a02a-2dbd00c5763c.png',
    '/lovable-uploads/55f4c0c5-3671-43f5-87bd-24493598fb3d.png',
    'https://via.placeholder.com/300/000000/FFFFFF/?text=Exemplo+1',
    'https://via.placeholder.com/300/FF5757/FFFFFF/?text=Exemplo+2',
    'https://via.placeholder.com/300/5CE1E6/000000/?text=Exemplo+3',
    'https://via.placeholder.com/300/FFDE59/000000/?text=Exemplo+4',
  ];
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileUrl = URL.createObjectURL(file);
      setSelectedImage(fileUrl);
      
      toast({
        title: "Imagem selecionada",
        description: "Clique em 'Adicionar à Timeline' para usá-la no show.",
      });
    }
  };
  
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleAddToTimeline = () => {
    if (selectedImage) {
      onImageSelect(selectedImage);
      
      toast({
        title: "Imagem adicionada",
        description: "A imagem foi adicionada à timeline.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Biblioteca de Imagens</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {demoImages.map((image, index) => (
          <div 
            key={index}
            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 
              ${selectedImage === image ? 'border-accent' : 'border-transparent'}`}
            onClick={() => setSelectedImage(image)}
          >
            <img 
              src={image} 
              alt={`Imagem ${index + 1}`} 
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </div>
        ))}
      </div>
      
      <div className="border border-white/10 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">Enviar Imagem Personalizada</h4>
        
        <div className="flex flex-col space-y-2">
          <input 
            type="file" 
            ref={fileInputRef}
            accept="image/*" 
            className="hidden" 
            onChange={handleFileSelect} 
          />
          
          <Button onClick={handleUploadClick} variant="outline" className="w-full">
            <ImagePlus className="h-4 w-4 mr-2" />
            Selecionar Imagem
          </Button>
        </div>
      </div>
      
      {selectedImage && (
        <div className="border border-white/10 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Imagem Selecionada</h4>
          
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0">
              <img 
                src={selectedImage} 
                alt="Imagem selecionada" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <Button onClick={handleAddToTimeline} className="hutz-button-primary flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Timeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageSelector;
