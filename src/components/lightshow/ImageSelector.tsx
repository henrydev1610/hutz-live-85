
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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
      // Just add the single selected image
      onImageSelect(selectedImage, imageDuration);
      
      toast({
        title: "Imagem adicionada",
        description: `A imagem foi adicionada à timeline com duração de ${imageDuration} segundos.`,
      });
    }
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
    
    // Get the lastEndTime first
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
    
    const fixedDuration = 5; // Changed from 10 to 5 seconds duration as requested
    
    // We'll directly call the parent's handler for each image
    selectedImages.forEach((imageUrl, index) => {
      const startTime = lastImageEndTime + (index * fixedDuration);
      onImageSelect(imageUrl, fixedDuration, startTime);
    });
    
    toast({
      title: "Imagens adicionadas",
      description: `${selectedImages.length} imagens foram adicionadas à timeline em sequência.`,
    });
    
    // Clear selection after adding
    setSelectedImages([]);
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
        onAddSelected={handleAddSelectedToTimeline}
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
