
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Trash2 } from "lucide-react";
import { TimelineItem, FlashlightPattern } from '@/types/lightshow';

interface PropertiesPanelProps {
  selectedItem: TimelineItem | null;
  updateTimelineItem: (id: string, updates: Partial<TimelineItem>) => void;
  removeTimelineItem: (id: string) => void;
  duration: number;
}

const PropertiesPanel = ({
  selectedItem,
  updateTimelineItem,
  removeTimelineItem,
  duration
}: PropertiesPanelProps) => {
  
  if (!selectedItem) {
    return (
      <div className="h-full flex items-center justify-center text-white/50">
        <div className="text-center">
          <p>Selecione um item na timeline para editar suas propriedades</p>
        </div>
      </div>
    );
  }

  return (
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
  );
};

export default PropertiesPanel;
