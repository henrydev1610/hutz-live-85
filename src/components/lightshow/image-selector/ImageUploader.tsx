
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
}

const ImageUploader = ({ onImageUpload }: ImageUploaderProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Create an array from FileList to properly track processing
      const files = Array.from(e.target.files);
      
      // Process each file in the selection
      files.forEach(file => {
        // Read file as data URL to ensure persistence
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && event.target.result) {
            // Use the data URL which can be stored in localStorage
            const imageDataUrl = event.target.result as string;
            onImageUpload(imageDataUrl);
            
            console.log(`Processing image: ${file.name}, saved as data URL`);
          }
        };
        // Read the file as a data URL
        reader.readAsDataURL(file);
      });
      
      // Show a single toast for all images
      const fileCount = files.length;
      toast({
        title: fileCount > 1 ? "Imagens adicionadas" : "Imagem adicionada",
        description: fileCount > 1 
          ? `${fileCount} imagens foram adicionadas à biblioteca com sucesso.`
          : "A imagem foi adicionada à biblioteca com sucesso.",
      });
      
      // Reset the file input to allow selecting the same files again
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
      <h4 className="text-sm font-medium mb-2">Adicionar Imagens à Biblioteca</h4>
      
      <div className="flex flex-col space-y-2">
        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*" 
          className="hidden" 
          onChange={handleFileSelect}
          multiple // Enable multiple file selection
        />
        
        <Button onClick={handleUploadClick} variant="outline" className="w-full">
          <ImagePlus className="h-4 w-4 mr-2" />
          Selecionar Imagens
        </Button>
      </div>
    </div>
  );
};

export default ImageUploader;
