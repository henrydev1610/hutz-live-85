
import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useImageLibrary } from './image-selector/useImageLibrary';
import ImageLibraryHeader from './image-selector/ImageLibraryHeader';
import ImageSelectionControls from './image-selector/ImageSelectionControls';
import ImageGrid from './image-selector/ImageGrid';
import ImageUploader from './image-selector/ImageUploader';
import SelectedImagePreview from './image-selector/SelectedImagePreview';

interface ImageSelectorProps {
  onImageSelect: (imageUrl: string, duration?: number, startTime?: number) => void;
  timelineItems: any[]; // Timeline items to check for last image position
  onSelectedImagesChange?: (selectedImages: string[]) => void; // New prop to expose selected images
}

const ImageSelector = ({ onImageSelect, timelineItems, onSelectedImagesChange }: ImageSelectorProps) => {
  const { toast } = useToast();
  const {
    footballImages,
    selectedImages,
    selectedImage,
    imageDuration,
    setSelectedImage,
    setImageDuration,
    setSelectedImages,
    addImageToLibrary,
    toggleImageSelection,
    handleSelectAll,
    handleDeleteSelected,
  } = useImageLibrary();
  
  useEffect(() => {
    if (onSelectedImagesChange) {
      onSelectedImagesChange(selectedImages);
    }
  }, [selectedImages, onSelectedImagesChange]);
  
  const handleAddToTimeline = () => {
    if (selectedImage) {
      onImageSelect(selectedImage, imageDuration);
      
      toast({
        title: "Imagem adicionada",
        description: `A imagem foi adicionada à timeline com duração de ${imageDuration} segundos.`,
      });
    }
  };

  // Now this is just a notification that images are selected
  const handleAddSelectedToTimeline = () => {
    if (selectedImages.length === 0) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Selecione pelo menos uma imagem para adicionar à timeline.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Imagens prontas para adicionar",
      description: `${selectedImages.length} imagens selecionadas. Clique em "Adicionar Imagens" no painel de controle para adicioná-las à timeline.`,
    });
  };

  return (
    <div className="space-y-6">
      <ImageLibraryHeader 
        selectedImagesCount={selectedImages.length}
        onDeleteSelected={handleDeleteSelected}
      />
      
      <ImageSelectionControls
        selectedImagesCount={selectedImages.length}
        totalImagesCount={footballImages.length}
        onSelectAll={handleSelectAll}
        onDeleteSelected={handleDeleteSelected}
        onAddSelectedToTimeline={handleAddSelectedToTimeline}
      />
      
      <ImageGrid 
        images={footballImages}
        selectedImages={selectedImages}
        selectedImage={selectedImage}
        onImageSelect={setSelectedImage}
        onImageToggle={toggleImageSelection}
      />
      
      <ImageUploader onImageUpload={addImageToLibrary} />
      
      {selectedImage && (
        <SelectedImagePreview 
          selectedImage={selectedImage}
          imageDuration={imageDuration}
          onDurationChange={setImageDuration}
          onAddToTimeline={handleAddToTimeline}
        />
      )}
    </div>
  );
};

export default ImageSelector;
