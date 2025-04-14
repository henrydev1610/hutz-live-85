import { useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { TimelineItem, CallToActionType } from "@/types/lightshow";
import { generateUltrasonicAudio, detectBeats, trimAudioFile } from "@/utils/audioProcessing";

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
  const [callToAction, setCallToAction] = useState<{
    type: CallToActionType;
    imageUrl?: string;
    buttonText?: string;
    externalUrl?: string;
    couponCode?: string;
  }>({
    type: 'image'
  });
  const [audioEditInfo, setAudioEditInfo] = useState({
    startTrim: 0,
    endTrim: 0,
  });
  
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
      
      // Create faster flashes for beats (10-15ms)
      beats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.01 + Math.random() * 0.005; // 10-15ms (shorter)
          
          newPatterns.push({
            id: `flash-beat-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 95 + Math.random() * 5, // 95-100%
              blinkRate: 25 + Math.random() * 10, // 25-35 Hz (faster)
              color: '#FFFFFF'
            }
          });
        }
      });
      
      // Create slightly longer flashes for bass (15-20ms)
      bassBeats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.015 + Math.random() * 0.005; // 15-20ms (shorter)
          
          newPatterns.push({
            id: `flash-bass-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 100, // Full intensity for bass
              blinkRate: 15 + Math.random() * 10, // 15-25 Hz (faster)
              color: '#FFFFFF'
            }
          });
        }
      });
      
      // Create very short flashes for treble (8-12ms)
      trebleBeats.forEach((time, index) => {
        if (time < duration) {
          const flashDuration = 0.008 + Math.random() * 0.004; // 8-12ms (shorter)
          
          newPatterns.push({
            id: `flash-treble-${Date.now()}-${index}`,
            type: 'flashlight',
            startTime: time,
            duration: flashDuration,
            pattern: {
              intensity: 90 + Math.random() * 10, // 90-100%
              blinkRate: 30 + Math.random() * 15, // 30-45 Hz (faster)
              color: '#FFFFFF'
            }
          });
        }
      });
      
      // Add intense strobe effects with proper spacing
      // Instead of continuous lighting, we'll add spaced strobe clusters
      for (let time = 0; time < duration; time += 1.5) { // Increased spacing between clusters (1.5s)
        const clusterSize = 5 + Math.floor(Math.random() * 5); // 5-9 flashes per cluster
        for (let i = 0; i < clusterSize; i++) {
          const strokeTime = time + (i * 0.015); // Faster strobe timing (15ms spacing)
          
          if (strokeTime < duration) {
            newPatterns.push({
              id: `flash-strobe-${Date.now()}-${time}-${i}`,
              type: 'flashlight',
              startTime: strokeTime,
              duration: 0.01, // 10ms (very short flash)
              pattern: {
                intensity: 100,
                blinkRate: 40 + Math.random() * 20, // 40-60 Hz (much faster)
                color: '#FFFFFF'
              }
            });
          }
        }
      }
      
      // Add more random flashes throughout the track, but with proper spacing
      const randomFlashCount = Math.floor(duration * 10); // Increased number but will be spaced
      for (let i = 0; i < randomFlashCount; i++) {
        const randomTime = Math.random() * duration;
        
        // Check if this random time is too close to existing flashes
        const tooClose = newPatterns.some(item => 
          Math.abs(item.startTime - randomTime) < 0.05 // Minimum 50ms spacing
        );
        
        if (!tooClose) {
          newPatterns.push({
            id: `flash-random-${Date.now()}-${i}`,
            type: 'flashlight',
            startTime: randomTime,
            duration: 0.01 + Math.random() * 0.01, // 10-20ms (shorter)
            pattern: {
              intensity: 95 + Math.random() * 5, // 95-100%
              blinkRate: 25 + Math.random() * 25, // 25-50 Hz (faster)
              color: '#FFFFFF'
            }
          });
        }
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
    const newItems: TimelineItem[] = [];
    
    selectedImages.forEach((imageUrl, index) => {
      const startTime = lastImageEndTime + (index * imageDuration);
      newItems.push({
        id: `img-${Date.now()}-${index}`,
        type: 'image',
        startTime: startTime,
        duration: imageDuration,
        imageUrl
      });
    });
    
    setTimelineItems([...timelineItems, ...newItems]);
    
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
  
  const setCallToActionContent = (content: Partial<typeof callToAction>) => {
    setCallToAction({...callToAction, ...content});
  };
  
  const addCallToActionToTimeline = () => {
    if (!audioFile) {
      toast({
        title: "Erro",
        description: "É necessário carregar um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    // Add the call to action at the end of the song
    const ctaStartTime = duration > 0 ? duration : 0;
    
    const newCta: TimelineItem = {
      id: `cta-${Date.now()}`,
      type: 'callToAction',
      startTime: ctaStartTime,
      duration: 10, // Default 10 seconds display time
      content: callToAction
    };
    
    setTimelineItems(prev => {
      // Remove any existing call to action items
      const filteredItems = prev.filter(item => item.type !== 'callToAction');
      return [...filteredItems, newCta];
    });
    
    toast({
      title: "Chamada adicionada",
      description: "A chamada foi adicionada ao final da música.",
    });
  };
  
  const trimAudio = async () => {
    if (!audioFile) {
      toast({
        title: "Erro",
        description: "É necessário carregar um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    if (audioEditInfo.endTrim <= audioEditInfo.startTrim) {
      toast({
        title: "Erro",
        description: "O tempo final deve ser maior que o tempo inicial.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Editando áudio...",
      description: "Processando o corte do áudio.",
    });
    
    try {
      const trimmedAudio = await trimAudioFile(
        audioFile, 
        audioEditInfo.startTrim, 
        audioEditInfo.endTrim || duration
      );
      
      // Create a new file from the trimmed audio
      const newFile = new File([trimmedAudio], `${audioFile.name.split('.')[0]}_trimmed.wav`, {
        type: 'audio/wav'
      });
      
      handleAudioUpload(newFile);
      
      toast({
        title: "Áudio editado",
        description: "O áudio foi cortado com sucesso.",
      });
    } catch (error) {
      console.error("Error trimming audio:", error);
      toast({
        title: "Erro ao editar áudio",
        description: "Ocorreu um erro durante o processamento do áudio.",
        variant: "destructive"
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
    callToAction,
    audioEditInfo,
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
    setSelectedImages,
    setCallToActionContent,
    addCallToActionToTimeline,
    setAudioEditInfo,
    trimAudio
  };
}
