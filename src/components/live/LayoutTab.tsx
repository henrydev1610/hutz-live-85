import { useState, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useLiveSession } from '@/contexts/LiveSessionContext';

const LayoutTab = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { 
    setLayout, 
    setBackgroundColor, 
    setBackgroundImage,
    layout,
    backgroundColor
  } = useLiveSession();
  
  // Predefined color options
  const colorOptions = [
    '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', 
    '#1E3A8A', '#1D4ED8', '#0EA5E9', '#06B6D4', '#14B8A6',
    '#10B981', '#22C55E', '#84CC16', '#EAB308', '#F59E0B',
    '#F97316', '#EF4444', '#DC2626', '#B91C1C', '#7F1D1D',
    '#9333EA', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F472B6', '#FB7185', '#FFFFFF', '#F3F4F6', '#D1D5DB'
  ];

  const handleImageUpload = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setBackgroundImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Número de participantes visíveis</Label>
        <Slider 
          value={[layout]} 
          min={1} 
          max={24} 
          step={1}
          onValueChange={(values) => setLayout(values[0])}
          className="mb-2"
        />
        <div className="flex justify-between text-sm text-white/70">
          <span>1</span>
          <span>{layout}</span>
          <span>24</span>
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Cor de fundo</Label>
        <div className="grid grid-cols-6 gap-2 mt-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              className={`w-full aspect-square rounded-md border ${backgroundColor === color ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => setBackgroundColor(color)}
              aria-label={`Selecionar cor ${color}`}
            />
          ))}
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Imagem de fundo</Label>
        <Input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
        <Button 
          type="button" 
          onClick={handleImageUpload} 
          className="w-full"
        >
          Carregar imagem
        </Button>
      </div>
    </div>
  );
};

export default LayoutTab;
