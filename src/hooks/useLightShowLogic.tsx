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
      description: "Processando o áudio e criando um show de luzes...",
    });
    
    const nonFlashlightItems = timelineItems.filter(item => item.type !== 'flashlight');
    
    try {
      const { beats, bassBeats, trebleBeats } = await detectBeats(audioFile);
      
      const newPatterns: TimelineItem[] = [];
      
      const totalSeconds = Math.ceil(duration);
      
      // Create patterns with 1.5, 2.0, or 2.5 flashes per second
      for (let second = 0; second < totalSeconds; second += 3) {
        // Regularly alternate between 1.5, 2.0, and 2.5 flashes per second
        const flashRates = [1.5, 2.0, 2.5];
        const flashesPerSecond = flashRates[second % 3];
        
        // Create pattern for a 3-second chunk
        for (let i = 0; i < 3; i++) {
          if (second + i < totalSeconds) {
            // Calculate number of flashes for this specific second
            const flashesThisSecond = flashesPerSecond;
            const flashesCount = Math.floor(flashesThisSecond);
            const partialFlash = flashesThisSecond - flashesCount;
            
            // Add whole flashes
            for (let j = 0; j < flashesCount; j++) {
              const startTime = (second + i) + (j * (1 / flashesThisSecond));
              const blinkRate = 120 + Math.random() * 30; // Slight variation in blink rate
              const intensity = 90 + Math.random() * 10; // High intensity (90-100%)
              
              newPatterns.push({
                id: `flash-auto-${Date.now()}-${second + i}-${j}`,
                type: 'flashlight',
                startTime: startTime,
                duration: 0.03 + (Math.random() * 0.02), // 0.03-0.05s duration
                pattern: {
                  intensity: intensity,
                  blinkRate: blinkRate,
                  color: '#FFFFFF'
                }
              });
            }
            
            // Add partial flash if needed
            if (partialFlash > 0) {
              const startTime = (second + i) + (flashesCount * (1 / flashesThisSecond));
              const intensity = 90 + Math.random() * 10;
              
              newPatterns.push({
                id: `flash-auto-partial-${Date.now()}-${second + i}`,
                type: 'flashlight',
                startTime: startTime,
                duration: 0.03 * partialFlash, // Shorter duration for partial flash
                pattern: {
                  intensity: intensity,
                  blinkRate: 100,
                  color: '#FFFFFF'
                }
              });
            }
          }
        }
        
        // Randomly decide if we want a pause after this 3-second chunk
        // This creates intervals >2 seconds as requested
        if (Math.random() > 0.7 && second + 5 < totalSeconds) {
          // Skip the next 2-3 seconds to create a pause
          const pauseLength = 2 + Math.floor(Math.random() * 1.5);
          second += pauseLength;
        }
      }
      
      // Add emphasis on bass and treble beats without the 0.2s pauses
      if (bassBeats.length > 0 && trebleBeats.length > 0) {
        // Process bass beats
        for (let i = 0; i < bassBeats.length; i++) {
          if (bassBeats[i] < duration) {
            // Every fourth bass beat gets a bright flash (without the 0.2s pause)
            if (i % 4 === 0) {
              newPatterns.push({
                id: `flash-bass-${Date.now()}-${i}`,
                type: 'flashlight',
                startTime: bassBeats[i],
                duration: 0.04,
                pattern: {
                  intensity: 100,
                  blinkRate: 200,
                  color: '#FFFFFF'
                }
              });
            }
          }
        }
        
        // Process treble beats
        for (let i = 0; i < trebleBeats.length; i++) {
          if (trebleBeats[i] < duration) {
            // Every fifth treble beat gets quick flash sequence (without the 0.2s pause)
            if (i % 5 === 0) {
              // Double flash at the treble beat
              for (let j = 0; j < 2; j++) {
                newPatterns.push({
                  id: `flash-treble-${Date.now()}-${i}-${j}`,
                  type: 'flashlight',
                  startTime: trebleBeats[i] + (j * 0.03),
                  duration: 0.02,
                  pattern: {
                    intensity: 100,
                    blinkRate: 220,
                    color: '#FFFFFF'
                  }
                });
              }
            }
          }
        }
      }
      
      // Sort all patterns by start time
      const sortedPatterns = [...newPatterns].sort((a, b) => a.startTime - b.startTime);
      
      // Check for gaps greater than 1 second and fill them
      const finalPatterns: TimelineItem[] = [];
      for (let i = 0; i < sortedPatterns.length; i++) {
        finalPatterns.push(sortedPatterns[i]);
        
        // Check for gaps (if not the last item)
        if (i < sortedPatterns.length - 1) {
          const currentEnd = sortedPatterns[i].startTime + sortedPatterns[i].duration;
          const nextStart = sortedPatterns[i + 1].startTime;
          
          // If gap is more than 1 second, add filler flashes
          if (nextStart - currentEnd > 1) {
            // Add a sequence of flashes in the middle of the gap
            const gapMiddle = currentEnd + ((nextStart - currentEnd) / 2);
            const flashRate = [1.5, 2.0, 2.5][Math.floor(Math.random() * 3)];
            
            // Add a sequence of 3 flashes with the chosen rate
            for (let j = 0; j < 3; j++) {
              finalPatterns.push({
                id: `flash-filler-${Date.now()}-${i}-${j}`,
                type: 'flashlight',
                startTime: gapMiddle + (j * (1 / flashRate)),
                duration: 0.03,
                pattern: {
                  intensity: 95,
                  blinkRate: 150,
                  color: '#FFFFFF'
                }
              });
            }
          }
        }
      }
      
      // Final check to prevent overlaps
      const noOverlapPatterns: TimelineItem[] = [];
      for (let i = 0; i < finalPatterns.length; i++) {
        const current = finalPatterns[i];
        
        // Adjust duration if it would overlap with the next pattern
        if (i < finalPatterns.length - 1) {
          const next = finalPatterns[i + 1];
          const currentEnd = current.startTime + current.duration;
          
          if (currentEnd > next.startTime) {
            // Adjust current duration to prevent overlap
            current.duration = Math.max(0.01, next.startTime - current.startTime - 0.005);
          }
        }
        
        noOverlapPatterns.push(current);
      }
      
      setTimelineItems([...nonFlashlightItems, ...noOverlapPatterns]);
      
      toast({
        title: "Show de luzes criado!",
        description: "Um show de luzes foi sincronizado com as batidas da música.",
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
      duration: 0.03,
      pattern: {
        intensity: 100,
        blinkRate: 120,
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
        description: "É necessário um ��udio e pelo menos um item na timeline.",
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
    
    const ctaStartTime = duration > 0 ? duration : 0;
    
    const newCta: TimelineItem = {
      id: `cta-${Date.now()}`,
      type: 'callToAction',
      startTime: ctaStartTime,
      duration: 10,
      content: callToAction
    };
    
    setTimelineItems(prev => {
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
