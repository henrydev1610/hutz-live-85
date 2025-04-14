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
      
      if (beats.length > 0) {
        beats.forEach((beat, index) => {
          if (beat < duration) {
            const isStrongBeat = index % 4 === 0;
            const beatIntensity = isStrongBeat ? 100 : 80 + Math.random() * 20;
            const beatDuration = Math.max(0.1, isStrongBeat ? 0.25 : 0.15);
            
            newPatterns.push({
              id: `flash-beat-${Date.now()}-${index}`,
              type: 'flashlight',
              startTime: beat,
              duration: beatDuration,
              pattern: {
                intensity: beatIntensity,
                blinkRate: isStrongBeat ? 200 : 120 + Math.random() * 40,
                color: '#FFFFFF'
              }
            });
            
            if (index % 8 === 0 && index > 0) {
              const flashCount = 3;
              for (let i = 0; i < flashCount; i++) {
                newPatterns.push({
                  id: `flash-cluster-${Date.now()}-${index}-${i}`,
                  type: 'flashlight',
                  startTime: beat + (i * 0.12),
                  duration: Math.max(0.1, 0.12),
                  pattern: {
                    intensity: 90 + (i * 5),
                    blinkRate: 180 + (i * 20),
                    color: '#FFFFFF'
                  }
                });
              }
            }
          }
        });
      }
      
      if (bassBeats.length > 0) {
        bassBeats.forEach((bassBeat, index) => {
          if (bassBeat < duration) {
            const bassIntensity = 100;
            const bassDuration = Math.max(0.1, 0.3);
            
            newPatterns.push({
              id: `flash-bass-${Date.now()}-${index}`,
              type: 'flashlight',
              startTime: bassBeat,
              duration: bassDuration,
              pattern: {
                intensity: bassIntensity,
                blinkRate: 180,
                color: '#FFFFFF'
              }
            });
            
            if (index % 3 === 0) {
              const decayCount = 2;
              for (let i = 1; i <= decayCount; i++) {
                newPatterns.push({
                  id: `flash-bass-decay-${Date.now()}-${index}-${i}`,
                  type: 'flashlight',
                  startTime: bassBeat + (i * 0.2),
                  duration: Math.max(0.1, 0.2 - (i * 0.05)),
                  pattern: {
                    intensity: 100 - (i * 25),
                    blinkRate: 160 - (i * 20),
                    color: '#FFFFFF'
                  }
                });
              }
            }
          }
        });
      }
      
      if (trebleBeats.length > 0) {
        trebleBeats.forEach((trebleBeat, index) => {
          if (trebleBeat < duration) {
            const trebleIntensity = 90;
            const trebleDuration = Math.max(0.1, 0.15);
            
            if (index % 2 === 0) {
              newPatterns.push({
                id: `flash-treble-${Date.now()}-${index}`,
                type: 'flashlight',
                startTime: trebleBeat,
                duration: trebleDuration,
                pattern: {
                  intensity: trebleIntensity,
                  blinkRate: 220,
                  color: '#FFFFFF'
                }
              });
            }
            
            if (index % 4 === 0) {
              newPatterns.push({
                id: `flash-treble-double-${Date.now()}-${index}`,
                type: 'flashlight',
                startTime: trebleBeat + 0.1,
                duration: Math.max(0.1, 0.12),
                pattern: {
                  intensity: 95,
                  blinkRate: 240,
                  color: '#FFFFFF'
                }
              });
            }
          }
        });
      }
      
      const sortedPatterns = [...newPatterns].sort((a, b) => a.startTime - b.startTime);
      const gapFilledPatterns: TimelineItem[] = [];
      
      for (let i = 0; i < sortedPatterns.length; i++) {
        gapFilledPatterns.push(sortedPatterns[i]);
        
        if (i < sortedPatterns.length - 1) {
          const currentEnd = sortedPatterns[i].startTime + sortedPatterns[i].duration;
          const nextStart = sortedPatterns[i + 1].startTime;
          const gap = nextStart - currentEnd;
          
          if (gap > 2) {
            const rhythmCount = Math.floor(gap / 0.5);
            for (let j = 0; j < rhythmCount; j++) {
              if (j % 2 === 0) {
                gapFilledPatterns.push({
                  id: `flash-gap-${Date.now()}-${i}-${j}`,
                  type: 'flashlight',
                  startTime: currentEnd + (j * 0.5),
                  duration: Math.max(0.1, 0.15),
                  pattern: {
                    intensity: 70 + Math.random() * 20,
                    blinkRate: 100 + Math.random() * 30,
                    color: '#FFFFFF'
                  }
                });
              }
            }
          }
        }
      }
      
      if (beats.length > 10) {
        for (let i = 10; i < beats.length; i++) {
          const currentInterval = beats[i] - beats[i-1];
          const previousInterval = beats[i-1] - beats[i-2];
          
          if (currentInterval < previousInterval * 0.8 && currentInterval < 0.5) {
            for (let j = 0; j < 5; j++) {
              gapFilledPatterns.push({
                id: `flash-buildup-${Date.now()}-${i}-${j}`,
                type: 'flashlight',
                startTime: beats[i] + (j * 0.15),
                duration: Math.max(0.1, 0.15),
                pattern: {
                  intensity: 60 + (j * 10),
                  blinkRate: 100 + (j * 30),
                  color: '#FFFFFF'
                }
              });
            }
          }
        }
      }
      
      const finalPatterns: TimelineItem[] = [];
      const sortedFinalPatterns = [...gapFilledPatterns].sort((a, b) => a.startTime - b.startTime);
      
      for (let i = 0; i < sortedFinalPatterns.length; i++) {
        const current = sortedFinalPatterns[i];
        
        current.duration = Math.max(0.1, current.duration);
        
        if (i < sortedFinalPatterns.length - 1) {
          const next = sortedFinalPatterns[i + 1];
          const currentEnd = current.startTime + current.duration;
          
          if (currentEnd > next.startTime) {
            current.duration = Math.max(0.1, next.startTime - current.startTime - 0.01);
          }
        }
        
        finalPatterns.push(current);
      }
      
      setTimelineItems([...nonFlashlightItems, ...finalPatterns]);
      
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
