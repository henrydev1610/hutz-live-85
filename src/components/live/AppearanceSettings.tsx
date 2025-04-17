
import { Image, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AppearanceSettingsProps {
  selectedBackgroundColor: string;
  setSelectedBackgroundColor: (color: string) => void;
  backgroundImage: string | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const AppearanceSettings = ({
  selectedBackgroundColor,
  setSelectedBackgroundColor,
  backgroundImage,
  onFileSelect,
  onRemoveImage,
  fileInputRef
}: AppearanceSettingsProps) => {
  const backgroundColors = [
    '#000000', '#0F172A', '#18181B', '#292524', '#1E1E1E', '#1A1A1A',
    '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF',
    '#111827', '#1E293B', '#334155', '#475569', '#64748B',
    '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444',
    '#14532D', '#166534', '#15803D', '#16A34A', '#22C55E',
    '#0C4A6E', '#0E7490', '#0891B2', '#06B6D4', '#22D3EE'
  ];

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Cor de Fundo</Label>
        <div className="grid grid-cols-9 gap-1">
          {backgroundColors.map((color) => (
            <button
              key={color}
              className={`w-6 h-6 rounded-full border ${selectedBackgroundColor === color ? 'border-white ring-2 ring-accent' : 'border-white/20'}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedBackgroundColor(color)}
              aria-label={`Selecionar cor ${color}`}
            />
          ))}
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Imagem de Fundo</Label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={triggerFileInput} className="border-white/20">
            <Image className="h-4 w-4 mr-2" />
            Carregar Imagem
          </Button>
          <Button 
            variant="outline" 
            onClick={onRemoveImage} 
            className="border-white/20"
            disabled={!backgroundImage}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remover Imagem
          </Button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={onFileSelect}
          accept="image/*"
          className="hidden" 
        />
        
        {backgroundImage && (
          <div className="mt-4 rounded-md overflow-hidden w-full max-w-xs">
            <img 
              src={backgroundImage} 
              alt="Imagem de fundo selecionada" 
              className="w-full h-auto object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AppearanceSettings;
