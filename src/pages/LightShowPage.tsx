import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import Timeline from "@/components/lightshow/Timeline";
import PhonePreview from "@/components/lightshow/PhonePreview";
import AudioUploader from "@/components/lightshow/AudioUploader";
import ImageSelector from "@/components/lightshow/ImageSelector";
import { 
  Play, Pause, Save, Music, Image as ImageIcon, 
  Flashlight, Zap, Download, Upload, Plus, Trash2, Wand2, RotateCcw
} from "lucide-react";
import { FlashlightPattern, TimelineItem } from "@/types/lightshow";
import { generateUltrasonicAudio } from "@/utils/audioProcessing";

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
    
    // Create more intense, varied patterns (every 0.1s for more intensity)
    for (let time = 0; time < duration; time += 0.1) {
      // Generate random properties for more dramatic effect
      const randomIntensity = 80 + Math.random() * 20; // Higher base intensity (80-100%)
      const randomDuration = 0.05 + Math.random() * 0.1; // Very short flashes for more intensity
      const randomBlinkRate = 8 + Math.random() * 2; // Fast blink rate (8-10Hz)
      
      // Add variation - occasionally add brighter bursts
      if (Math.random() > 0.4) { // More frequent bursts (60% chance)
        newPatterns.push({
          id: `flash-${Date.now()}-${time}-burst`,
          type: 'flashlight',
          startTime: time,
          duration: randomDuration,
          pattern: {
            intensity: 100, // Max intensity for bursts
            blinkRate: 10, // Fastest blink rate
            color: '#FFFFFF' // White light
          }
        });
      } else {
        // Add rapid strobe effects
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
    
    // Special effect: Add intense strobe effects at intervals
    for (let time = 1; time < duration; time += 5) {
      for (let i = 0; i < 15; i++) { // More strobe effects
        const strokeTime = time + (i * 0.05); // Faster sequence
        newPatterns.push({
          id: `flash-${Date.now()}-strobe-${strokeTime}`,
          type: 'flashlight',
          startTime: strokeTime,
          duration: 0.03, // Very short duration for rapid flashes
          pattern: {
            intensity: 100,
            blinkRate: 10,
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
  
  const addImageToTimeline = (imageUrl: string, duration: number = 3) => {
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
            
            <Button 
              variant="outline" 
              className="border-white/20 hover:bg-destructive/20 text-destructive"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
        
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-200px)] border rounded-lg border-white/10 bg-secondary/40 backdrop-blur-lg"
        >
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="h-full flex flex-col p-4">
              <div className="mb-4 flex items-center space-x-2">
                <Button 
                  size="sm" 
                  variant={isPlaying ? "default" : "outline"} 
                  onClick={handlePlayPause}
                  className="w-20"
                >
                  {isPlaying ? (
                    <><Pause className="h-4 w-4 mr-2" /> Pause</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" /> Play</>
                  )}
                </Button>
                
                <span className="text-sm text-white/70">
                  {new Date(currentTime * 1000).toISOString().substr(14, 5)} / 
                  {new Date(duration * 1000).toISOString().substr(14, 5)}
                </span>
                
                <div className="ml-auto flex flex-wrap space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addImageToTimeline("https://via.placeholder.com/300/000000/FFFFFF/?text=Selecione+Imagem")}
                    disabled={!audioFile}
                    className="bg-sky-950/40"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Adicionar Imagem
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addFlashlightPattern}
                    disabled={!audioFile}
                    className="bg-purple-950/40"
                  >
                    <Flashlight className="h-4 w-4 mr-2" />
                    Adicionar Lanterna
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateAutoSyncPatterns}
                    disabled={!audioFile}
                    className="bg-green-950/40"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Auto
                  </Button>
                </div>
              </div>
              
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
                {selectedItem ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {selectedItem.type === 'image' ? 'Propriedades da Imagem' : 'Propriedades da Lanterna'}
                    </h3>
                    
                    <div className="space-y-2">
                      <Label>Tempo Inicial (segundos)</Label>
                      <Input 
                        type="number" 
                        min={0} 
                        max={duration} 
                        step={0.1}
                        value={selectedItem.startTime} 
                        onChange={(e) => updateTimelineItem(
                          selectedItem.id,
                          { startTime: parseFloat(e.target.value) }
                        )}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Duração (segundos)</Label>
                      <Input 
                        type="number" 
                        min={0.1} 
                        max={duration - selectedItem.startTime} 
                        step={0.1}
                        value={selectedItem.duration} 
                        onChange={(e) => updateTimelineItem(
                          selectedItem.id,
                          { duration: parseFloat(e.target.value) }
                        )}
                      />
                    </div>
                    
                    {selectedItem.type === 'flashlight' && selectedItem.pattern && (
                      <>
                        <div className="space-y-2">
                          <Label>Intensidade ({selectedItem.pattern.intensity}%)</Label>
                          <Slider
                            value={[selectedItem.pattern.intensity]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(value) => updateTimelineItem(
                              selectedItem.id,
                              { 
                                pattern: { 
                                  ...selectedItem.pattern as FlashlightPattern, 
                                  intensity: value[0],
                                  color: '#FFFFFF' // Keep white color
                                } 
                              }
                            )}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Taxa de Piscadas ({selectedItem.pattern.blinkRate} Hz)</Label>
                          <Slider
                            value={[selectedItem.pattern.blinkRate]}
                            min={0.5}
                            max={10}
                            step={0.5}
                            onValueChange={(value) => updateTimelineItem(
                              selectedItem.id,
                              { 
                                pattern: { 
                                  ...selectedItem.pattern as FlashlightPattern, 
                                  blinkRate: value[0],
                                  color: '#FFFFFF' // Keep white color
                                } 
                              }
                            )}
                          />
                        </div>
                      </>
                    )}
                    
                    <Button 
                      variant="destructive" 
                      onClick={() => removeTimelineItem(selectedItem.id)}
                      className="w-full mt-4"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Item
                    </Button>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/50">
                    <div className="text-center">
                      <p>Selecione um item na timeline para editar suas propriedades</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="images" className="flex-1 p-4 overflow-y-auto">
                <ImageSelector onImageSelect={addImageToTimeline} />
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
