import { useState, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useToast } from "@/components/ui/use-toast";
import { Download, Save } from "lucide-react";
import { TimelineItem } from "@/types/lightshow";
import { generateUltrasonicAudio } from "@/utils/audioProcessing";

// Import refactored components
import Timeline from "@/components/lightshow/Timeline";
import PhonePreview from "@/components/lightshow/PhonePreview";
import AudioUploader from "@/components/lightshow/AudioUploader";
import ImageSelector from "@/components/lightshow/ImageSelector";
import ControlPanel from "@/components/lightshow/ControlPanel";
import PropertiesPanel from "@/components/lightshow/PropertiesPanel";

const LightShowPage = () => {
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
  
  const selectedItem = selectedItemIndex !== null ? timelineItems[selectedItemIndex] : null;
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
  
  const generateAutoSyncPatterns = () => {
    if (!duration) return;
    
    toast({
      title: "Gerando sincronização automática",
      description: "Processando o áudio e criando um show de luzes intenso...",
    });
    
    // Clear any existing flashlight items
    const nonFlashlightItems = timelineItems.filter(item => item.type !== 'flashlight');
    
    const newPatterns: TimelineItem[] = [];
    
    // Create more intense, varied patterns with more spacing between flashes
    // Using a longer interval (0.4s instead of 0.1s) for more distinct flashes
    for (let time = 0; time < duration; time += 0.4) {
      // Generate random properties for more dramatic effect
      const randomIntensity = 80 + Math.random() * 20; // Higher base intensity (80-100%)
      const randomDuration = 0.1 + Math.random() * 0.15; // Slightly longer flashes for more distinct on/off states
      const randomBlinkRate = 3 + Math.random() * 5; // More varied blink rates (3-8Hz)
      
      // Add variation - occasionally add brighter bursts
      if (Math.random() > 0.6) { // Less frequent bursts (40% chance)
        newPatterns.push({
          id: `flash-${Date.now()}-${time}-burst`,
          type: 'flashlight',
          startTime: time,
          duration: randomDuration,
          pattern: {
            intensity: 100, // Max intensity for bursts
            blinkRate: 8, // Fast but not too fast
            color: '#FFFFFF' // White light
          }
        });
      } else {
        // Add more spaced out strobe effects
        newPatterns.push({
          id: `flash-${Date.now()}-${time}`,
          type: 'flashlight',
          startTime: time,
          duration: randomDuration,
          pattern: {
            intensity: randomIntensity,
            blinkRate: randomBlinkRate,
            color: '#FFFFFF' // White light
          }
        });
      }
    }
    
    // Special effect: Add intense strobe effects at intervals with more spacing
    for (let time = 1; time < duration; time += 8) { // Increased interval from 5 to 8
      for (let i = 0; i < 10; i++) { // Fewer strobes but more distinct
        const strokeTime = time + (i * 0.2); // More spacing between flashes
        newPatterns.push({
          id: `flash-${Date.now()}-strobe-${strokeTime}`,
          type: 'flashlight',
          startTime: strokeTime,
          duration: 0.08, // Slightly longer duration for more visible flashes
          pattern: {
            intensity: 100,
            blinkRate: 4, // Lower rate makes each flash more distinct
            color: '#FFFFFF' // White light only
          }
        });
      }
    }
    
    setTimelineItems([...nonFlashlightItems, ...newPatterns]);
    
    toast({
      title: "Show de luzes criado!",
      description: "Um espetáculo intenso de luzes piscantes foi criado baseado no seu áudio.",
    });
  };

  const generateAutoImageSequence = () => {
    if (!duration || !audioFile) {
      toast({
        title: "Erro",
        description: "Por favor, carregue um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    // Get all images with checked checkboxes from the ImageSelector component
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Por favor, selecione pelo menos uma imagem na biblioteca de imagens.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Gerando sequência de imagens",
      description: "Criando uma sequência automática de imagens...",
    });
    
    // Get all image URLs from selected checkboxes
    const selectedImages: string[] = [];
    checkboxes.forEach((checkbox) => {
      const parentDiv = checkbox.closest('.relative');
      if (parentDiv) {
        const imageElement = parentDiv.querySelector('img');
        if (imageElement && imageElement.src) {
          selectedImages.push(imageElement.src);
        }
      }
    });
    
    if (selectedImages.length === 0) {
      toast({
        title: "Erro ao obter imagens",
        description: "Não foi possível encontrar as imagens selecionadas.",
        variant: "destructive"
      });
      return;
    }
    
    // Remove any existing image items
    const nonImageItems = timelineItems.filter(item => item.type !== 'image');
    
    // Create a sequence of images throughout the duration
    const imageDuration = 5; // Each image shows for 5 seconds
    const totalImages = selectedImages.length;
    const newImageItems: TimelineItem[] = [];
    
    // Calculate spacing - distribute images across the duration
    const totalDuration = Math.min(duration - imageDuration, duration); // Account for last image's duration
    const step = Math.max(imageDuration, totalDuration / totalImages);
    
    // Place images one after another without overlapping
    for (let i = 0; i < totalImages; i++) {
      const imageIndex = i % selectedImages.length;
      
      // Determine the start time for this image
      let startTime = i === 0 ? 0 : newImageItems[i-1].startTime + newImageItems[i-1].duration;
      
      // Don't add images beyond the audio duration
      if (startTime + imageDuration > duration) break;
      
      newImageItems.push({
        id: `img-${Date.now()}-${i}`,
        type: 'image',
        startTime: startTime,
        duration: imageDuration,
        imageUrl: selectedImages[imageIndex]
      });
    }
    
    setTimelineItems([...nonImageItems, ...newImageItems]);
    
    toast({
      title: "Sequência de imagens criada!",
      description: `${newImageItems.length} imagens foram adicionadas à timeline.`,
    });
  };
  
  const addImageToTimeline = (imageUrl: string, duration: number = 5) => {
    if (!audioFile) {
      toast({
        title: "Erro",
        description: "Por favor, carregue um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    const newImage: TimelineItem = {
      id: `img-${Date.now()}`,
      type: 'image',
      startTime: currentTime,
      duration: duration,
      imageUrl
    };
    
    // Check for overlap with existing images
    const images = timelineItems.filter(item => item.type === 'image');
    let hasOverlap = false;
    
    for (const image of images) {
      const imageEnd = image.startTime + image.duration;
      const newItemEnd = newImage.startTime + newImage.duration;
      
      // Check if there's any overlap
      if ((newImage.startTime >= image.startTime && newImage.startTime < imageEnd) || 
          (newItemEnd > image.startTime && newItemEnd <= imageEnd) ||
          (newImage.startTime <= image.startTime && newItemEnd >= imageEnd)) {
        hasOverlap = true;
        break;
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
        color: '#FFFFFF' // Always white for flashlight (phone flashlight)
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

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <div className="container mx-auto py-4 px-4">
        <h1 className="text-3xl font-bold mb-4 hutz-gradient-text">Momento Light Show</h1>
        
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex-1">
            <Label htmlFor="show-name" className="mb-2 block">Nome do Show</Label>
            <Input
              id="show-name"
              value={showName}
              onChange={(e) => setShowName(e.target.value)}
              className="hutz-input w-full"
            />
          </div>
          
          <div className="flex-1 md:flex-initial flex gap-2">
            <Button 
              onClick={handleGenerateFile} 
              className="hutz-button-accent"
              disabled={!audioFile || !timelineItems.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Gerar Arquivo .WAV
            </Button>
            
            <Button variant="outline" className="border-white/20 hover:bg-secondary">
              <Save className="h-4 w-4 mr-2" />
              Salvar Projeto
            </Button>
          </div>
        </div>
        
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-200px)] border rounded-lg border-white/10 bg-secondary/40 backdrop-blur-lg"
        >
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="h-full flex flex-col p-4">
              <ControlPanel 
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                audioFile={audioFile}
                onPlayPause={handlePlayPause}
                addFlashlightPattern={addFlashlightPattern}
                addImageToTimeline={addImageToTimeline}
                generateAutoSyncPatterns={generateAutoSyncPatterns}
                generateAutoImageSequence={generateAutoImageSequence}
                handleReset={handleReset}
              />
              
              {!audioFile ? (
                <AudioUploader onAudioUploaded={handleAudioUpload} />
              ) : (
                <Timeline 
                  audioUrl={audioUrl}
                  isPlaying={isPlaying}
                  timelineItems={timelineItems}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                  duration={duration}
                  setDuration={setDuration}
                  onUpdateItem={updateTimelineItem}
                  onRemoveItem={removeTimelineItem}
                  onItemSelect={setSelectedItemIndex}
                  selectedItemIndex={selectedItemIndex}
                />
              )}
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={35} minSize={30}>
            <Tabs defaultValue="properties" className="h-full flex flex-col">
              <TabsList className="mx-4 mt-4 grid grid-cols-3">
                <TabsTrigger value="properties">Propriedades</TabsTrigger>
                <TabsTrigger value="images">Imagens</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="properties" className="flex-1 p-4 overflow-y-auto">
                <PropertiesPanel 
                  selectedItem={selectedItem}
                  updateTimelineItem={updateTimelineItem}
                  removeTimelineItem={removeTimelineItem}
                  duration={duration}
                />
              </TabsContent>
              
              <TabsContent value="images" className="flex-1 p-4 overflow-y-auto">
                <div ref={imageSelector}>
                  <ImageSelector onImageSelect={addImageToTimeline} />
                </div>
              </TabsContent>
              
              <TabsContent value="preview" className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
                <PhonePreview 
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  timelineItems={timelineItems}
                />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default LightShowPage;
