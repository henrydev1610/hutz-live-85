
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Image, ImagePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';

interface ImageSelectorProps {
  onImageSelect: (imageUrl: string, duration?: number) => void;
}

const ImageSelector = ({ onImageSelect }: ImageSelectorProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDuration, setImageDuration] = useState<number>(3);
  
  // Football-related images
  const footballImages = [
    // Vibrant football images with dark backgrounds
    'https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=600&q=80', // Celebrating players
    'https://images.unsplash.com/photo-1577223625816-7546b71daf98?w=600&q=80', // Football stadium at night
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80', // Celebrating team
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80', // Football fan cheering
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80', // Football on dark field
    'https://images.unsplash.com/photo-1624526267642-5ff0fd6a5aeb?w=600&q=80', // Football close-up with dark background
    'https://images.unsplash.com/photo-1521731978332-9e9e714bdd20?w=600&q=80', // Dark stadium with lights
    'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=600&q=80', // Arena at night
    'https://images.unsplash.com/photo-1616514197671-15d99ce7253f?w=600&q=80', // Celebrating players in dark uniforms
    'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=600&q=80', // Player celebrating goal
    'https://images.unsplash.com/photo-1601512986351-9b6f6e782129?w=600&q=80', // Stadium with fans at night
    'https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=600&q=80', // Football shoes on dark background
    'https://images.unsplash.com/photo-1628891890467-b79f2c8ba7d9?w=600&q=80', // Football with flames
    'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=600&q=80', // Goalkeeper catching ball
    'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&q=80', // Football stadium lights
    'https://images.unsplash.com/photo-1599657044015-8f536824be1a?w=600&q=80', // Players celebrating on dark field
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80', // Team celebration
    'https://images.unsplash.com/photo-1547058881-aa0eed1cbed9?w=600&q=80', // Football on grass at night
    'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=600&q=80', // Dramatic football match
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80', // Fan in stadium
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
      onImageSelect(selectedImage, imageDuration);
      
      toast({
        title: "Imagem adicionada",
        description: `A imagem foi adicionada à timeline com duração de ${imageDuration} segundos.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Biblioteca de Imagens</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {footballImages.map((image, index) => (
          <div 
            key={index}
            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 
              ${selectedImage === image ? 'border-accent' : 'border-transparent'}`}
            onClick={() => setSelectedImage(image)}
          >
            <img 
              src={image} 
              alt={`Imagem de futebol ${index + 1}`} 
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
                onChange={(e) => setImageDuration(Number(e.target.value))} 
              />
            </div>
            
            <Button onClick={handleAddToTimeline} className="hutz-button-primary w-full">
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
