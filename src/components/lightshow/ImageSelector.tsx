
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Image, ImagePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface ImageSelectorProps {
  onImageSelect: (imageUrl: string, duration?: number) => void;
}

const ImageSelector = ({ onImageSelect }: ImageSelectorProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDuration, setImageDuration] = useState<number>(3);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // Football-related images (extended collection)
  const footballImages = [
    // Original images
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
    
    // Additional images
    'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&q=80', // Soccer field aerial view
    'https://images.unsplash.com/photo-1550881111-7cfde14b8073?w=600&q=80', // Football in grass close-up
    'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80', // Football stadium wide angle
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&q=80', // Player shooting ball
    'https://images.unsplash.com/photo-1480099225005-2513c8947aec?w=600&q=80', // Football players in action
    'https://images.unsplash.com/photo-1559122143-ebc6e37f3e23?w=600&q=80', // Person kicking football
    'https://images.unsplash.com/photo-1516731566880-919c39804b82?w=600&q=80', // Sunset stadium view
    'https://images.unsplash.com/photo-1638213676046-ac9d2a32192a?w=600&q=80', // Soccer ball close-up
    'https://images.unsplash.com/photo-1621570074981-363a4a6dadf2?w=600&q=80', // Football equipment
    'https://images.unsplash.com/photo-1616514197671-15d99ce7253f?w=600&q=80', // Players celebrating
    'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=600&q=80', // Stadium atmosphere with fans
    'https://images.unsplash.com/photo-1626248801379-51a0748a5f96?w=600&q=80', // Football match action
    'https://images.unsplash.com/photo-1510051640316-cee0293bb343?w=600&q=80', // Child playing football
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80', // Jubilant fan with face paint
    'https://images.unsplash.com/photo-1549221952-31d442cb858a?w=600&q=80', // Football player running
    'https://images.unsplash.com/photo-1615118265620-d8decf628275?w=600&q=80', // Stadium under lights
    'https://images.unsplash.com/photo-1518604686527-5ce91358d64e?w=600&q=80', // Player shooting at goal
    'https://images.unsplash.com/photo-1574420757511-d46da1782485?w=600&q=80', // Football players in silhouette
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&q=80', // Crowd at football match
    'https://images.unsplash.com/photo-1606925207923-c580f25966b0?w=600&q=80', // Goalkeeper diving
    'https://images.unsplash.com/photo-1627076322724-dc280daefa64?w=600&q=80', // Football training session
    'https://images.unsplash.com/photo-1624526267791-3c9a231fbb70?w=600&q=80', // Soccer cleats close-up
    'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=600&q=80', // Stadium floodlights
    'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&q=80', // Football goal net
    'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&q=80', // Fans with scarves
    'https://images.unsplash.com/photo-1601457625912-2d3cb243c8c8?w=600&q=80', // Football in air
    'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=600&q=80', // Empty stadium
    'https://images.unsplash.com/photo-1526232686644-60e20e51d86e?w=600&q=80', // Fan with a flag
    'https://images.unsplash.com/photo-1502014822147-1aedfb0676e0?w=600&q=80', // Football stadium at dusk
    'https://images.unsplash.com/photo-1617886322168-72b886573c5f?w=600&q=80', // Player dribbling with ball
    'https://images.unsplash.com/photo-1570481662006-a3a1374699e8?w=600&q=80', // Boots on a football pitch
    'https://images.unsplash.com/photo-1624526267717-fc94537388a4?w=600&q=80', // Football in motion
    'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&q=80', // Stadium from inside
    'https://images.unsplash.com/photo-1511886929837-354d544661a7?w=600&q=80', // Muddy football boots
    'https://images.unsplash.com/photo-1593075829041-ddd3abcce66e?w=600&q=80', // Football through fence
    'https://images.unsplash.com/photo-1525254574692-686fd35b6ab1?w=600&q=80', // Team in huddle
    'https://images.unsplash.com/photo-1590333748338-d12b45b5a7f2?w=600&q=80', // Fan with face paint
    'https://images.unsplash.com/photo-1579283431646-ba249c8c8dca?w=600&q=80', // Fans with banners
    'https://images.unsplash.com/photo-1624526267609-7aadbbad9e7f?w=600&q=80'  // Football on penalty spot
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

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl);
      } else {
        return [...prev, imageUrl];
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Biblioteca de Imagens</h3>
        <div className="text-sm text-white/60">
          {selectedImages.length} imagens selecionadas
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {footballImages.map((image, index) => (
          <div 
            key={index}
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
          >
            <div className="absolute top-2 left-2 z-10">
              <Checkbox 
                id={`image-${index}`}
                checked={selectedImages.includes(image)}
                onCheckedChange={() => toggleImageSelection(image)}
                className="bg-black/50 border-white/50"
              />
            </div>
            <img 
              src={image} 
              alt={`Imagem de futebol ${index + 1}`} 
              className={`w-full h-full object-cover transition-opacity ${
                selectedImage === image ? 'ring-2 ring-accent' : ''
              } ${selectedImages.includes(image) ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
              onClick={() => setSelectedImage(image)}
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
