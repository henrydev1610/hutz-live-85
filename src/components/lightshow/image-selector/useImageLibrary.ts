import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useImageLibrary = () => {
  const { toast } = useToast();
  const [footballImages, setFootballImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDuration, setImageDuration] = useState<number>(5);

  useEffect(() => {
    const savedImages = localStorage.getItem('footballImages');
    if (savedImages) {
      try {
        const parsedImages = JSON.parse(savedImages);
        if (Array.isArray(parsedImages)) {
          setFootballImages(parsedImages);
        } else {
          console.error('Saved images is not an array:', parsedImages);
          setFootballImages(getDefaultImages());
        }
      } catch (error) {
        console.error('Error parsing saved images:', error);
        setFootballImages(getDefaultImages());
      }
    } else {
      setFootballImages(getDefaultImages());
      localStorage.setItem('footballImages', JSON.stringify(getDefaultImages()));
    }
  }, []);

  useEffect(() => {
    if (footballImages.length > 0) {
      localStorage.setItem('footballImages', JSON.stringify(footballImages));
    }
  }, [footballImages]);

  const getDefaultImages = () => [
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
    'https://images.unsplash.com/photo-1624526267791-3c9a231fbb70?w=600&q=80',
    'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=600&q=80',
    'https://images.unsplash.com/photo-1624526267717-fc94537388a4?w=600&q=80',
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

  const addImageToLibrary = (imageUrl: string) => {
    setFootballImages(prevImages => {
      const newImages = [...prevImages, imageUrl];
      localStorage.setItem('footballImages', JSON.stringify(newImages));
      console.log(`Added image to library: ${imageUrl}, total images: ${newImages.length}`);
      return newImages;
    });
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

  const handleSelectAll = () => {
    if (selectedImages.length === footballImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages([...footballImages]);
    }
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

  return {
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
  };
};
