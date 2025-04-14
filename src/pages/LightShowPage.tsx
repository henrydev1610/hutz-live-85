
import React, { useState, useRef } from 'react';
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
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
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
    
    const nonFlashlightItems = timelineItems.filter(item => item.type !== 'flashlight');
    
    const newPatterns: TimelineItem[] = [];
    
    for (let time = 0; time < duration; time += 0.4) {
      const randomIntensity = 80 + Math.random() * 20;
      const randomDuration = 0.1 + Math.random() * 0.15;
      const randomBlinkRate = 3 + Math.random() * 5;
      
      if (Math.random() > 0.6) {
        newPatterns.push({
          id: `flash-${Date.now()}-${time}-burst`,
          type: 'flashlight',
          startTime: time,
          duration: randomDuration,
          pattern: {
            intensity: 100,
            blinkRate: 8,
            color: '#FFFFFF'
          }
        });
      } else {
        newPatterns.push({
          id: `flash-${Date.now()}-${time}`,
          type: 'flashlight',
          startTime: time,
          duration: randomDuration,
          pattern: {
            intensity: randomIntensity,
            blinkRate: randomBlinkRate,
            color: '#FFFFFF'
          }
        });
      }
    }
    
    for (let time = 1; time < duration; time += 8) {
      for (let i = 0; i < 10; i++) {
        const strokeTime = time + (i * 0.2);
        newPatterns.push({
          id: `flash-${Date.now()}-strobe-${strokeTime}`,
          type: 'flashlight',
          startTime: strokeTime,
          duration: 0.08,
          pattern: {
            intensity: 100,
            blinkRate: 4,
            color: '#FFFFFF'
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
    if (!duration) return;
    
    toast({
      title: "Generating automatic image sequence",
      description: "Processing images and creating an automatic sequence...",
    });
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
    
    const imageDuration = 10; // Set each image to 10 seconds as requested
    
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
                handleReset={handleReset}
                selectedImages={selectedImages}
                onAddSelectedImages={handleAddSelectedImages}
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
                <TabsTrigger value="properties">Lights</TabsTrigger>
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
                  <ImageSelector 
                    onImageSelect={addImageToTimeline} 
                    timelineItems={timelineItems}
                    onSelectedImagesChange={setSelectedImages}
                  />
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
