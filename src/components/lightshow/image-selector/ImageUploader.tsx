
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
}

const ImageUploader = ({ onImageUpload }: ImageUploaderProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileUrl = URL.createObjectURL(file);
      
      onImageUpload(fileUrl);
      
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

  return (
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
  );
};

export default ImageUploader;
