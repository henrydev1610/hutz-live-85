
import { useState, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useParticipantStore } from '@/stores/participantStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const COLORS = [
  '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666',
  '#808080', '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6',
  '#FF0000', '#FF6600', '#FFCC00', '#33CC00', '#00CCFF',
  '#0066FF', '#3300FF', '#9900FF', '#FF00FF', '#FF0099',
  '#663300', '#996633', '#CCCC33', '#669900', '#00CC66',
  '#0099CC', '#3366CC', '#6633CC', '#993399', '#CC0066',
];

const LayoutTab = () => {
  const { layoutSettings, updateLayoutSettings } = useSettingsStore();
  const { setMaxSelected } = useParticipantStore();
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleMaxParticipantsChange = (value: number[]) => {
    const count = value[0];
    updateLayoutSettings({ maxParticipants: count });
    setMaxSelected(count);
  };
  
  const handleColorSelect = (color: string) => {
    updateLayoutSettings({ backgroundColor: color });
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive'
      });
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter menos que 5MB.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setImageLoading(true);
      
      // Convert to base64 for preview
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          updateLayoutSettings({ backgroundImage: event.target.result });
          setImageLoading(false);
        }
      };
      
      reader.onerror = () => {
        toast({
          title: 'Erro ao carregar',
          description: 'Não foi possível carregar a imagem.',
          variant: 'destructive'
        });
        setImageLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: 'Erro ao processar',
        description: 'Houve um erro ao processar a imagem.',
        variant: 'destructive'
      });
      setImageLoading(false);
    }
  };
  
  const clearBackgroundImage = () => {
    updateLayoutSettings({ backgroundImage: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Number of Participants Slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Número de participantes</Label>
          <span className="text-sm font-medium">{layoutSettings.maxParticipants}</span>
        </div>
        <Slider 
          value={[layoutSettings.maxParticipants]} 
          min={1} 
          max={24} 
          step={1} 
          onValueChange={handleMaxParticipantsChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>24</span>
        </div>
      </div>
      
      {/* Background Color Selector */}
      <div className="space-y-2">
        <Label>Cor de fundo</Label>
        <div className="grid grid-cols-10 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              className={`w-full aspect-square rounded-md border ${
                color === layoutSettings.backgroundColor ? 'border-accent' : 'border-border'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
              aria-label={`Cor ${color}`}
            />
          ))}
        </div>
      </div>
      
      {/* Background Image Upload */}
      <div className="space-y-2">
        <Label>Imagem de fundo</Label>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="background-image"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageLoading}
            className="flex gap-2 items-center"
          >
            <Upload className="h-4 w-4" />
            Carregar Imagem
          </Button>
          {layoutSettings.backgroundImage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearBackgroundImage}
            >
              Remover
            </Button>
          )}
        </div>
        
        {/* Image Preview */}
        {layoutSettings.backgroundImage && (
          <div className="mt-4">
            <Label className="mb-2 block">Pré-visualização</Label>
            <div className="w-full h-32 bg-secondary/30 rounded-md overflow-hidden">
              <img 
                src={layoutSettings.backgroundImage} 
                alt="Background preview" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayoutTab;
