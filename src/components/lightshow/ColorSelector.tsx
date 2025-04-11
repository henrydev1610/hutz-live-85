
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ColorSelectorProps {
  onColorSelect: (color: string) => void;
}

const ColorSelector = ({ onColorSelect }: ColorSelectorProps) => {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  // Palette of 30 beautiful colors
  const colorPalette = [
    // Neutros
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', 
    // Cores Principais
    '#9b87f5', '#7E69AB', '#6E59A5', '#8B5CF6', '#D946EF',
    // Azuis
    '#0EA5E9', '#0284C7', '#0369A1', '#1E40AF', '#7DD3FC',
    // Vermelhos
    '#FB7185', '#F43F5E', '#BE123C', '#FDF2F8', '#FEE2E2',
    // Amarelos & Laranjas
    '#F97316', '#FDBA74', '#FEF3C7', '#FDE68A', '#FAD37F',
    // Verdes
    '#4ADE80', '#22C55E', '#15803D', '#A7F3D0', '#D1FAE5'
  ];
  
  const handleColorClick = (color: string) => {
    setSelectedColor(color);
  };
  
  const handleAddToTimeline = () => {
    if (selectedColor) {
      onColorSelect(selectedColor);
      
      toast({
        title: "Cor de fundo adicionada",
        description: "A cor foi adicionada à timeline.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Cores de Fundo</h3>
      
      <div className="grid grid-cols-5 gap-2">
        {colorPalette.map((color, index) => (
          <div 
            key={index}
            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 
              ${selectedColor === color ? 'border-accent' : 'border-transparent'}`}
            onClick={() => handleColorClick(color)}
            style={{ backgroundColor: color }}
          >
            {/* Checkmark for selected color */}
            {selectedColor === color && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-black/30"></div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedColor && (
        <div className="border border-white/10 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Cor Selecionada</h4>
          
          <div className="flex items-center space-x-4">
            <div 
              className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0"
              style={{ backgroundColor: selectedColor }}
            ></div>
            
            <Button onClick={handleAddToTimeline} className="hutz-button-primary flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Timeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSelector;
