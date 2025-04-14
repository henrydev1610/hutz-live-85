
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface ImageGridProps {
  images: string[];
  selectedImages: string[];
  selectedImage: string | null;
  onImageSelect: (imageUrl: string) => void;
  onImageToggle: (imageUrl: string) => void;
}

const ImageGrid = ({
  images,
  selectedImages,
  selectedImage,
  onImageSelect,
  onImageToggle
}: ImageGridProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {images.map((image, index) => (
        <div 
          key={index}
          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
        >
          <div className="absolute top-2 left-2 z-10">
            <Checkbox 
              id={`image-${index}`}
              checked={selectedImages.includes(image)}
              onCheckedChange={() => onImageToggle(image)}
              className="bg-black/50 border-white/50"
            />
          </div>
          <img 
            src={image} 
            alt={`Imagem de futebol ${index + 1}`} 
            className={`w-full h-full object-cover transition-opacity ${
              selectedImage === image ? 'ring-2 ring-accent' : ''
            } ${selectedImages.includes(image) ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
            onClick={() => onImageSelect(image)}
          />
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
