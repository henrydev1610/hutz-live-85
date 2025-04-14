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
      
      // Create beat intervals array to analyze tempo
      const beatIntervals: number[] = [];
      for (let i = 1; i < beats.length; i++) {
        beatIntervals.push(beats[i] - beats[i-1]);
      }
      
      // Calculate average beat interval for tempo analysis
      const averageInterval = beatIntervals.length > 0 
        ? beatIntervals.reduce((sum, interval) => sum + interval, 0) / beatIntervals.length
        : 0.5; // default if no beats detected
      
      // Ensure even distribution of light patterns throughout the song
      // Add regular beat patterns throughout the entire duration
      const beatSpacing = Math.max(0.5, Math.min(2, totalSeconds / 250)); // Adjust spacing based on song length
      
      for (let time = 0; time < totalSeconds; time += beatSpacing) {
        // Determine local tempo by finding beats near this time
        const nearbyBeats = beats.filter(b => Math.abs(b - time) < 1.5);
        const localIntervals: number[] = [];
        
        for (let i = 0; i < nearbyBeats.length - 1; i++) {
          localIntervals.push(nearbyBeats[i+1] - nearbyBeats[i]);
        }
        
        const localTempo = localIntervals.length > 0
          ? localIntervals.reduce((sum, interval) => sum + interval, 0) / localIntervals.length
          : averageInterval;
        
        // Determine tempo category
        const isFastSection = localTempo < 0.3; // Faster than 200 BPM
        const isSlowSection = localTempo > 0.6; // Slower than 100 BPM
        
        // Adjust blink rate based on tempo - as per requirements
        let blinkRate = 240; // Medium pace - 1.5 blinks per second (180-240Hz)
        
        if (isFastSection) {
          blinkRate = 300; // Fast pace - 2 blinks per second (300Hz)
        } else if (isSlowSection) {
          blinkRate = 100; // Slow pace - 1 blink per second (100Hz)
        }
        
        // Determine intensity based on whether this time is close to a detected beat
        const isNearBeat = beats.some(b => Math.abs(b - time) < 0.2);
        const isNearBassBeat = bassBeats.some(b => Math.abs(b - time) < 0.2);
        
        let intensity = isNearBeat ? 90 : 70;
        if (isNearBassBeat) intensity = 100; // Bass beats get maximum intensity
        
        // Longer flash duration for slower beats, shorter for faster beats
        const flashDuration = Math.max(0.1, isNearBassBeat 
          ? (isSlowSection ? 0.35 : 0.25) 
          : (isSlowSection ? 0.2 : 0.15));
        
        newPatterns.push({
          id: `flash-regular-${Date.now()}-${time.toFixed(2)}`,
          type: 'flashlight',
          startTime: time,
          duration: flashDuration,
          pattern: {
            intensity: intensity,
            blinkRate: blinkRate,
            color: '#FFFFFF'
          }
        });
      }
      
      // Add special emphasis on actual beats for more dynamics
      if (beats.length > 0) {
        beats.forEach((beat, index) => {
          if (beat < duration && index % 3 === 0) { // Only use every third beat to avoid too much density
            // Determine local tempo
            const startIdx = Math.max(0, index - 2);
            const endIdx = Math.min(beats.length - 2, index + 2);
            const localIntervals: number[] = [];
            
            for (let i = startIdx; i <= endIdx; i++) {
              if (i + 1 < beats.length) {
                localIntervals.push(beats[i+1] - beats[i]);
              }
            }
            
            const localTempo = localIntervals.length > 0
              ? localIntervals.reduce((sum, interval) => sum + interval, 0) / localIntervals.length
              : averageInterval;
            
            // Determine tempo category
            const isFastSection = localTempo < 0.3;
            const isSlowSection = localTempo > 0.6;
            
            // Adjust blink rate based on tempo
            let blinkRate = 240; // Medium pace
            
            if (isFastSection) {
              blinkRate = 300; // Fast pace
            } else if (isSlowSection) {
              blinkRate = 100; // Slow pace
            }
            
            // Adjust duration based on tempo
            const beatDuration = Math.max(0.1, isSlowSection ? 0.3 : 0.2);
            
            newPatterns.push({
              id: `flash-emphasis-${Date.now()}-${index}`,
              type: 'flashlight',
              startTime: beat,
              duration: beatDuration,
              pattern: {
                intensity: 100,
                blinkRate: blinkRate,
                color: '#FFFFFF'
              }
            });
          }
        });
      }
      
      // Add bass emphasis patterns
      if (bassBeats.length > 0) {
        bassBeats.forEach((bassBeat, index) => {
          if (bassBeat < duration && index % 2 === 0) { // Use every second bass beat
            // Find the closest beat to determine tempo context
            let closestBeatIndex = 0;
            let minDistance = Number.MAX_VALUE;
            
            for (let i = 0; i < beats.length; i++) {
              const distance = Math.abs(beats[i] - bassBeat);
              if (distance < minDistance) {
                minDistance = distance;
                closestBeatIndex = i;
              }
            }
            
            // Determine local tempo
            const startIdx = Math.max(0, closestBeatIndex - 2);
            const endIdx = Math.min(beats.length - 2, closestBeatIndex + 2);
            const localIntervals: number[] = [];
            
            for (let i = startIdx; i <= endIdx; i++) {
              if (i + 1 < beats.length) {
                localIntervals.push(beats[i+1] - beats[i]);
              }
            }
            
            const localTempo = localIntervals.length > 0
              ? localIntervals.reduce((sum, interval) => sum + interval, 0) / localIntervals.length
              : averageInterval;
            
            const isFastSection = localTempo < 0.3;
            const isSlowSection = localTempo > 0.6;
            
            // Adjust blink rate for bass beats based on tempo
            const bassBlinkRate = isFastSection ? 300 : (isSlowSection ? 100 : 240);
            
            // Bass beats usually need slightly longer duration
            const bassDuration = Math.max(0.1, isSlowSection ? 0.4 : 0.3);
            
            newPatterns.push({
              id: `flash-bass-${Date.now()}-${index}`,
              type: 'flashlight',
              startTime: bassBeat,
              duration: bassDuration,
              pattern: {
                intensity: 100,
                blinkRate: bassBlinkRate,
                color: '#FFFFFF'
              }
            });
          }
        });
      }
      
      // Sort all patterns by start time and remove any overlaps
      const sortedPatterns = [...newPatterns].sort((a, b) => a.startTime - b.startTime);
      const finalPatterns: TimelineItem[] = [];
      
      // Process patterns to avoid excessive density
      let lastEndTime = -0.5; // Start negative to allow immediate first pattern
      
      for (const pattern of sortedPatterns) {
        // Ensure minimum spacing between patterns
        if (pattern.startTime >= lastEndTime) {
          // Ensure minimum duration
          pattern.duration = Math.max(0.1, pattern.duration);
          finalPatterns.push(pattern);
          lastEndTime = pattern.startTime + pattern.duration + 0.05; // Add small buffer
        }
      }
      
      // Fill any large gaps in the timeline
      const gapFilledPatterns = [...finalPatterns];
      
      for (let i = 0; i < finalPatterns.length - 1; i++) {
        const currentEnd = finalPatterns[i].startTime + finalPatterns[i].duration;
        const nextStart = finalPatterns[i + 1].startTime;
        const gap = nextStart - currentEnd;
        
        // Fill gaps larger than 3 seconds
        if (gap > 3) {
          const midPoint = currentEnd + (gap / 2);
          
          gapFilledPatterns.push({
            id: `flash-gap-${Date.now()}-${i}`,
            type: 'flashlight',
            startTime: midPoint,
            duration: 0.2,
            pattern: {
              intensity: 80,
              blinkRate: 180,
              color: '#FFFFFF'
            }
          });
        }
      }
      
      // Sort once more to include gap fillers
      const finalSortedPatterns = [...gapFilledPatterns].sort((a, b) => a.startTime - b.startTime);
      
      setTimelineItems([...nonFlashlightItems, ...finalSortedPatterns]);
      
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
