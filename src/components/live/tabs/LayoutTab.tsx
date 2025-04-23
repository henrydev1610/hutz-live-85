
import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Image } from "lucide-react";

const ColorPalette = () => {
  const { backgroundColor, setBackgroundColor } = useSettingsStore();
  
  // Color options
  const colorOptions = [
    "#000000", "#121212", "#1E1E1E", "#2D2D2D", 
    "#3C3C3C", "#4B4B4B", "#5A5A5A", "#696969", 
    "#787878", "#878787", "#8B5CF6", "#6366F1", 
    "#3B82F6", "#0EA5E9", "#06B6D4", "#14B8A6", 
    "#10B981", "#22C55E", "#84CC16", "#EAB308", 
    "#F59E0B", "#F97316", "#EF4444", "#DC2626", 
    "#B91C1C", "#7F1D1D", "#9D174D", "#831843", 
    "#6B21A8", "#581C87"
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {colorOptions.map((color) => (
        <button
          key={color}
          className={`w-full aspect-square rounded-md cursor-pointer transition-all ${
            backgroundColor === color ? "ring-2 ring-white scale-110" : ""
          }`}
          style={{ backgroundColor: color }}
          onClick={() => setBackgroundColor(color)}
          aria-label={`Cor ${color}`}
        />
      ))}
    </div>
  );
};

const BackgroundUploader = () => {
  const { setBackgroundImage } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    
    // Create a URL for the image file
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setBackgroundImage(event.target.result.toString());
      }
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="picture">Imagem de Fundo</Label>
        <Input 
          id="picture" 
          type="file" 
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isLoading}
        />
      </div>
      
      <Button 
        variant="outline" 
        onClick={() => setBackgroundImage(null)}
        className="mt-2"
      >
        Remover Imagem de Fundo
      </Button>
    </div>
  );
};

const LayoutTab = () => {
  const { layoutMaxParticipants, setMaxParticipants } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Número Máximo de Participantes</Label>
        <div className="space-y-4">
          <Slider 
            defaultValue={[layoutMaxParticipants]}
            min={1}
            max={24}
            step={1}
            onValueChange={(value) => setMaxParticipants(value[0])}
          />
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">1</span>
            <span className="text-sm font-medium">{layoutMaxParticipants}</span>
            <span className="text-sm text-muted-foreground">24</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="color">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="color">Cor de Fundo</TabsTrigger>
          <TabsTrigger value="image">Imagem de Fundo</TabsTrigger>
        </TabsList>
        <TabsContent value="color" className="mt-4">
          <ColorPalette />
        </TabsContent>
        <TabsContent value="image" className="mt-4">
          <BackgroundUploader />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LayoutTab;
