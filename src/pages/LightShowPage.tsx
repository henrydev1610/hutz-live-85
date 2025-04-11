
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
  Flashlight, Zap, Download, Upload, Plus, Trash2, Palette, MagicWand
} from "lucide-react";
import { FlashlightPattern, TimelineItem } from "@/types/lightshow";
import { generateUltrasonicAudio } from "@/utils/audioProcessing";

// Predefined color palette
const colorPalette = [
  '#FF0000', '#FF3300', '#FF6600', '#FF9900', '#FFCC00', // Reds to yellows
  '#FFFF00', '#CCFF00', '#99FF00', '#66FF00', '#33FF00', // Yellows to greens
  '#00FF00', '#00FF33', '#00FF66', '#00FF99', '#00FFCC', // Greens to cyans
  '#00FFFF', '#00CCFF', '#0099FF', '#0066FF', '#0033FF', // Cyans to blues
  '#0000FF', '#3300FF', '#6600FF', '#9900FF', '#CC00FF', // Blues to magentas
  '#FF00FF', '#FF00CC', '#FF0099', '#FF0066', '#FF0033', // Magentas to pinks
];

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
  const [selectedColor, setSelectedColor] = useState('#000000');
  
  // Get selected item
  const selectedItem = selectedItemIndex !== null ? timelineItems[selectedItemIndex] : null;

  const handleAudioUpload = (file: File) => {
    setAudioFile(file);
    
    // Create object URL for the audio file
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    
    toast({
      title: "Áudio carregado",
      description: `${file.name} foi carregado com sucesso.`,
    });
    
    // Reset timeline when new audio is uploaded
    setTimelineItems([]);
    setCurrentTime(0);
  };
  
  const generateAutoSyncPatterns = () => {
    // This would be replaced with actual beat detection in a full implementation
    // For demo purposes, we'll create patterns at regular intervals
    if (!duration) return;
    
    toast({
      title: "Gerando sincronização automática",
      description: "Processando o áudio e criando padrões de lanterna...",
    });
    
    const newPatterns: TimelineItem[] = [];
    // Create a flashlight event roughly every 2 seconds
    for (let time = 0; time < duration; time += 2) {
      // Randomize colors for variety
      const randomColorIndex = Math.floor(Math.random() * colorPalette.length);
      
      newPatterns.push({
        id: `flash-${Date.now()}-${time}`,
        type: 'flashlight',
        startTime: time,
        duration: 0.5,
        pattern: {
          intensity: 50 + Math.random() * 50, // Random intensity between 50-100%
          blinkRate: 1 + Math.random() * 5,   // Random blink rate between 1-6 Hz
          color: colorPalette[randomColorIndex]
        }
      });
    }
    
    // Add the new patterns to timeline without removing existing ones
    setTimelineItems(prev => [...prev, ...newPatterns]);
    
    toast({
      title: "Sincronização automática concluída",
      description: "Padrões de lanterna criados com base no áudio.",
    });
  };
  
  const addImageToTimeline = (imageUrl: string) => {
    if (!duration) {
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
      duration: 3, // Default duration for images is 3 seconds
      imageUrl
    };
    
    setTimelineItems([...timelineItems, newImage]);
  };
  
  const addColorBackgroundToTimeline = () => {
    if (!duration) {
      toast({
        title: "Erro",
        description: "Por favor, carregue um áudio primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    const newColorBackground: TimelineItem = {
      id: `color-${Date.now()}`,
      type: 'image', // Reusing image type for color backgrounds
      startTime: currentTime,
      duration: 3, // Default duration for background color is 3 seconds
      backgroundColor: selectedColor
    };
    
    setTimelineItems([...timelineItems, newColorBackground]);
    
    toast({
      title: "Cor de fundo adicionada",
      description: "Cor de fundo adicionada à timeline.",
    });
  };
  
  const addFlashlightPattern = () => {
    if (!duration) {
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
      duration: 1, // Default duration for flashlight is 1 second
      pattern: {
        intensity: 100,
        blinkRate: 2,
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
    
    // Simulate file generation - in a real app this would process the audio
    setTimeout(() => {
      // Generate ultrasonic audio using our utility function
      generateUltrasonicAudio(audioFile, timelineItems)
        .then(blob => {
          // Create download link
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
          {/* Left panel - Timeline editor */}
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
                    onClick={addImageToTimeline}
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
                    <MagicWand className="h-4 w-4 mr-2" />
                    Auto Sync
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
          
          {/* Right panel - Properties and preview */}
          <ResizablePanel defaultSize={35} minSize={30}>
            <Tabs defaultValue="properties" className="h-full flex flex-col">
              <TabsList className="mx-4 mt-4 grid grid-cols-4">
                <TabsTrigger value="properties">Propriedades</TabsTrigger>
                <TabsTrigger value="images">Imagens</TabsTrigger>
                <TabsTrigger value="colors">Cores</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="properties" className="flex-1 p-4 overflow-y-auto">
                {selectedItem ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {selectedItem.type === 'image' ? 'Propriedades da Imagem/Cor' : 'Propriedades da Lanterna'}
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
                    
                    {selectedItem.type === 'image' && selectedItem.backgroundColor && (
                      <div className="space-y-2">
                        <Label>Cor de Fundo</Label>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded-full border"
                            style={{ backgroundColor: selectedItem.backgroundColor }}
                          />
                          <Input 
                            type="color" 
                            value={selectedItem.backgroundColor} 
                            onChange={(e) => updateTimelineItem(
                              selectedItem.id,
                              { backgroundColor: e.target.value }
                            )}
                          />
                        </div>
                      </div>
                    )}
                    
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
                                  intensity: value[0] 
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
                                  blinkRate: value[0] 
                                } 
                              }
                            )}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Cor</Label>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-10 h-10 rounded-full border"
                              style={{ backgroundColor: selectedItem.pattern.color }}
                            />
                            <Input 
                              type="color" 
                              value={selectedItem.pattern.color} 
                              onChange={(e) => updateTimelineItem(
                                selectedItem.id,
                                { 
                                  pattern: { 
                                    ...selectedItem.pattern as FlashlightPattern, 
                                    color: e.target.value 
                                  } 
                                }
                              )}
                            />
                          </div>
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
              
              <TabsContent value="colors" className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Cores de Fundo</h3>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {colorPalette.map((color, index) => (
                      <div 
                        key={index}
                        className={`aspect-square rounded-md cursor-pointer border-2 
                          ${selectedColor === color ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Cor Personalizada</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-full border"
                        style={{ backgroundColor: selectedColor }}
                      />
                      <Input 
                        type="color" 
                        value={selectedColor} 
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    onClick={addColorBackgroundToTimeline} 
                    disabled={!audioFile}
                    className="w-full hutz-button-primary"
                  >
                    <Palette className="h-4 w-4 mr-2" />
                    Adicionar Cor de Fundo à Timeline
                  </Button>
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
