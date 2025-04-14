
import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";

interface TimelineZoomControlsProps {
  zoomLevel: number;
  onZoomChange: (value: number[]) => void;
}

const TimelineZoomControls = ({ zoomLevel, onZoomChange }: TimelineZoomControlsProps) => {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onZoomChange([Math.max(10, zoomLevel - 20)])}
        className="p-1 h-8 w-8"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      
      <Slider
        value={[zoomLevel]}
        min={10}
        max={400}
        step={10}
        className="flex-1"
        onValueChange={onZoomChange}
      />
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onZoomChange([Math.min(400, zoomLevel + 20)])}
        className="p-1 h-8 w-8"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default TimelineZoomControls;
