import { useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { TimelineItem } from "@/types/lightshow";
import { generateUltrasonicAudio, detectBeats } from "@/utils/audioProcessing";

export function useLightShowLogic() {
  const { toast } = useToast();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showName, setShowName] = useState("Meu Show de Luzes");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  const imageSelector = useRef<HTMLDivElement>(null);

  const handleAudioUpload = (file: File) => {
    setAudioFile(file);
    
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    
    toast({
      title: "Áudio carregado",
      description: `${file.name} foi carregado com sucesso.`,
    });
    
    setTimelineItems([]);
    setCurrentTime(0);
  };
  
  const generateAutoSyncPatterns = async () => {
    if (!duration || !audioFile) {
      toast({
        title: "Erro",
        description: "É necessário carregar um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Gerando sincronização automática",
      description: "Processando o áudio e criando um show de luzes intenso...",
    });
    
    const nonFlashlightItems = timelineItems.filter(item => item.type !== 'flashlight');
    
    try {
      const { beats, bassBeats, trebleBeats } = await detectBeats(audioFile);
      
      const newPatterns: TimelineItem[] = [];
      
      beats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.02 + Math.random() * 0.015; 
          
          newPatterns.push({
            id: `flash-beat-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 90 + Math.random() * 10,
              blinkRate: 10 + Math.random() * 6,
              color: '#FFFFFF'
            }
          });
        }
      });
      
      bassBeats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.04 + Math.random() * 0.02;
          
          newPatterns.push({
            id: `flash-bass-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 100,
              blinkRate: 6 + Math.random() * 4,
              color: '#FFFFFF'
            }
          });
        }
      });
      
      trebleBeats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.02 + Math.random() * 0.01;
          
          newPatterns.push({
            id: `flash-treble-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 85 + Math.random() * 15,
              blinkRate: 14 + Math.random() * 6,
              color: '#FFFFFF'
            }
          });
        }
      });
      
      for (let time = 0; time < duration; time += 4) {
        for (let i = 0; i < 15; i++) {
          const strokeTime = time + (i * 0.04);
          
          if (strokeTime < duration) {
            newPatterns.push({
              id: `flash-strobe-${Date.now()}-${time}-${i}`,
              type: 'flashlight',
              startTime: strokeTime,
              duration: 0.025,
              pattern: {
                intensity: 100,
                blinkRate: 20,
                color: '#FFFFFF'
              }
            });
          }
        }
      }
      
      for (let i = 0; i < duration / 2; i++) {
        const randomTime = Math.random() * duration;
        
        newPatterns.push({
          id: `flash-random-${Date.now()}-${i}`,
          type: 'flashlight',
          startTime: randomTime,
          duration: 0.03 + Math.random() * 0.02,
          pattern: {
            intensity: 95 + Math.random() * 5,
            blinkRate: 8 + Math.random() * 12,
            color: '#FFFFFF'
          }
        });
      }
      
      setTimelineItems([...nonFlashlightItems, ...newPatterns]);
      
      toast({
        title: "Show de luzes criado!",
        description: "Um espetáculo intenso de luzes rápidas foi criado baseado nas batidas da música.",
      });
    } catch (error) {
      console.error("Error generating auto-sync patterns:", error);
      toast({
        title: "Erro na geração automática",
        description: "Ocorreu um erro ao processar o áudio.",
        variant: "destructive"
      });
    }
  };

  const addImageToTimeline = (imageUrl: string, duration: number = 5, startTime?: number) => {
    if (!audioFile) {
      toast({
        title: "Erro",
        description: "Por favor, carregue um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    const actualStartTime = startTime !== undefined ? startTime : currentTime;
    
    const newImage: TimelineItem = {
      id: `img-${Date.now()}`,
      type: 'image',
      startTime: actualStartTime,
      duration: duration,
      imageUrl
    };
    
    const images = timelineItems.filter(item => item.type === 'image');
    let hasOverlap = false;
    
    if (startTime === undefined) {
      for (const image of images) {
        const imageEnd = image.startTime + image.duration;
        const newItemEnd = newImage.startTime + newImage.duration;
        
        if ((newImage.startTime >= image.startTime && newImage.startTime < imageEnd) || 
            (newItemEnd > image.startTime && newItemEnd <= imageEnd) ||
            (newImage.startTime <= image.startTime && newItemEnd >= imageEnd)) {
          hasOverlap = true;
          break;
        }
      }
    }
    
    if (hasOverlap) {
      toast({
        title: "Sobreposição detectada",
        description: "Não é possível adicionar imagem pois há sobreposição com outra imagem existente.",
        variant: "destructive"
      });
      return;
    }
    
    setTimelineItems([...timelineItems, newImage]);
  };
  
  const handleAddSelectedImages = () => {
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
    
    const imageDuration = 10;
    
    selectedImages.forEach((imageUrl, index) => {
      const startTime = lastImageEndTime + (index * imageDuration);
      addImageToTimeline(imageUrl, imageDuration, startTime);
    });
    
    toast({
      title: "Imagens adicionadas",
      description: `${selectedImages.length} imagens foram adicionadas à timeline em sequência.`,
    });
    
    setSelectedImages([]);
  };
  
  const addFlashlightPattern = () => {
    if (!audioFile) {
      toast({
        title: "Erro",
        description: "Por favor, carregue um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    const newPattern: TimelineItem = {
      id: `flash-${Date.now()}`,
      type: 'flashlight',
      startTime: currentTime,
      duration: 0.2,
      pattern: {
        intensity: 100,
        blinkRate: 5,
        color: '#FFFFFF'
      }
    };
    
    setTimelineItems([...timelineItems, newPattern]);
  };
  
  const updateTimelineItem = (id: string, updates: Partial<TimelineItem>) => {
    setTimelineItems(timelineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };
  
  const removeTimelineItem = (id: string) => {
    setTimelineItems(timelineItems.filter(item => item.id !== id));
    setSelectedItemIndex(null);
  };
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleGenerateFile = () => {
    if (!audioFile || !timelineItems.length) {
      toast({
        title: "Não foi possível gerar o arquivo",
        description: "É necessário um áudio e pelo menos um item na timeline.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Gerando arquivo...",
      description: "Processando áudio e padrões ultrassônicos.",
    });
    
    setTimeout(() => {
      generateUltrasonicAudio(audioFile, timelineItems)
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${showName.replace(/\s+/g, '_')}_ultrasonic.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          toast({
            title: "Arquivo gerado com sucesso",
            description: "O arquivo .WAV com sinais ultrassônicos está pronto para download.",
          });
        })
        .catch(error => {
          console.error("Error generating ultrasonic audio:", error);
          toast({
            title: "Erro ao gerar arquivo",
            description: "Ocorreu um erro durante o processamento do áudio.",
            variant: "destructive"
          });
        });
    }, 2000);
  };

  const handleReset = () => {
    if (window.confirm("Tem certeza que deseja resetar todo o projeto? Todas as edições serão perdidas.")) {
      setTimelineItems([]);
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedItemIndex(null);
      
      toast({
        title: "Projeto resetado",
        description: "Todas as edições foram removidas. Você pode começar novamente.",
      });
    }
  };
  
  return {
    audioFile,
    audioUrl,
    showName,
    setShowName,
    isPlaying,
    currentTime,
    duration,
    timelineItems,
    selectedItemIndex,
    selectedImages,
    imageSelector,
    handleAudioUpload,
    generateAutoSyncPatterns,
    addImageToTimeline,
    handleAddSelectedImages,
    addFlashlightPattern,
    updateTimelineItem,
    removeTimelineItem,
    handlePlayPause,
    handleGenerateFile,
    handleReset,
    setCurrentTime,
    setDuration,
    setSelectedItemIndex,
    setSelectedImages
  };
}
