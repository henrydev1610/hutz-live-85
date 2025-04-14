
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Image, ImagePlus, Trash2, ListPlus, CheckSquare } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface ImageSelectorProps {
  onImageSelect: (imageUrl: string, duration?: number, startTime?: number) => void;
  timelineItems: any[]; // Timeline items to check for last image position
}

const ImageSelector = ({ onImageSelect, timelineItems }: ImageSelectorProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDuration, setImageDuration] = useState<number>(5);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  const [footballImages, setFootballImages] = useState<string[]>([]);
  
  useEffect(() => {
    const savedImages = localStorage.getItem('footballImages');
    if (savedImages) {
      setFootballImages(JSON.parse(savedImages));
    } else {
      const defaultImages = [
        'https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=600&q=80',
        'https://images.unsplash.com/photo-1577223625816-7546b71daf98?w=600&q=80',
        'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80',
        'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
        'https://images.unsplash.com/photo-1624526267642-5ff0fd6a5aeb?w=600&q=80',
        'https://images.unsplash.com/photo-1521731978332-9e9e714bdd20?w=600&q=80',
        'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=600&q=80',
        'https://images.unsplash.com/photo-1616514197671-15d99ce7253f?w=600&q=80',
        'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=600&q=80',
        'https://images.unsplash.com/photo-1601457625912-2d3cb243c8c8?w=600&q=80',
        'https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=600&q=80',
        'https://images.unsplash.com/photo-1628891890467-b79f2c8ba7d9?w=600&q=80',
        'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=600&q=80',
        'https://images.unsplash.com/photo-1624526267791-3c9a231fbb70?w=600&q=80',
        'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=600&q=80',
        'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&q=80',
        'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&q=80',
        'https://images.unsplash.com/photo-1601457625912-2d3cb243c8c8?w=600&q=80',
        'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=600&q=80',
        'https://images.unsplash.com/photo-1526232686644-60e20e51d86e?w=600&q=80',
        'https://images.unsplash.com/photo-1502014822147-1aedfb0676e0?w=600&q=80',
        'https://images.unsplash.com/photo-1617886322168-72b886573c5f?w=600&q=80',
        'https://images.unsplash.com/photo-1570481662006-a3a1374699e8?w=600&q=80',
        'https://images.unsplash.com/photo-1624526267717-fc94537388a4?w=600&q=80',
        'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&q=80',
        'https://images.unsplash.com/photo-1511886929837-354d544661a7?w=600&q=80',
        'https://images.unsplash.com/photo-1593075829041-ddd3abcce66e?w=600&q=80',
        'https://images.unsplash.com/photo-1525254574692-686fd35b6ab1?w=600&q=80',
        'https://images.unsplash.com/photo-1590333748338-d12b45b5a7f2?w=600&q=80',
        'https://images.unsplash.com/photo-1579283431646-ba249c8c8dca?w=600&q=80',
        'https://images.unsplash.com/photo-1624526267609-7aadbbad9e7f?w=600&q=80'
      ];
      setFootballImages(defaultImages);
      localStorage.setItem('footballImages', JSON.stringify(defaultImages));
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('footballImages', JSON.stringify(footballImages));
  }, [footballImages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileUrl = URL.createObjectURL(file);
      
      const newImages = [...footballImages, fileUrl];
      setFootballImages(newImages);
      localStorage.setItem('footballImages', JSON.stringify(newImages));
      
      toast({
        title: "Imagem adicionada",
        description: "A imagem foi adicionada à biblioteca com sucesso.",
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleDeleteSelected = () => {
    if (selectedImages.length === 0) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Selecione pelo menos uma imagem para excluir.",
        variant: "destructive"
      });
      return;
    }
    
    const updatedImages = footballImages.filter(image => !selectedImages.includes(image));
    setFootballImages(updatedImages);
    
    localStorage.setItem('footballImages', JSON.stringify(updatedImages));
    
    if (selectedImage && selectedImages.includes(selectedImage)) {
      setSelectedImage(null);
    }
    
    setSelectedImages([]);
    
    toast({
      title: "Imagens excluídas",
      description: `${selectedImages.length} imagens foram removidas da biblioteca.`,
    });
  };

  const handleAddSelectedToTimeline = () => {
    if (selectedImages.length === 0) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Selecione pelo menos uma imagem para adicionar à timeline.",
        variant: "destructive"
      });
      return;
    }

    let lastImageEndTime = 0;
    const imageItems = timelineItems.filter(item => item.type === 'image');
    
    if (imageItems.length > 0) {
      imageItems.forEach(item => {
        const endTime = item.startTime + item.duration;
        if (endTime > lastImageEndTime) {
          lastImageEndTime = endTime;
        }
      });
    }
    
    const imageDuration = 5;
    
    selectedImages.forEach((imageUrl, index) => {
      const startTime = lastImageEndTime + (index * imageDuration);
      onImageSelect(imageUrl, imageDuration, startTime);
    });
    
    toast({
      title: "Imagens adicionadas",
      description: `${selectedImages.length} imagens foram adicionadas à timeline em sequência.`,
    });
    
    setSelectedImages([]);
  };

  const handleSelectAll = () => {
    if (selectedImages.length === footballImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages([...footballImages]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Biblioteca de Imagens</h3>
        <div className="flex items-center gap-2">
          <div className="text-sm text-white/60">
            {selectedImages.length} imagens selecionadas
          </div>
          {selectedImages.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDeleteSelected}
              className="text-red-500 hover:text-red-400 hover:bg-red-950/20"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          )}
        </div>
      </div>
      
      {selectedImages.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              className="flex-1"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {selectedImages.length === footballImages.length ? "Desmarcar Todas" : "Selecionar Todas"}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAddSelectedToTimeline}
              className="text-accent hover:text-accent-foreground flex-1"
            >
              <ListPlus className="h-4 w-4 mr-1" />
              Adicionar à trilha
            </Button>
          </div>
          <Separator className="bg-white/10 my-4" />
        </>
      )}
      
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
        <h4 className="text-sm font-medium mb-2">Adicionar Imagem à Biblioteca</h4>
        
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
