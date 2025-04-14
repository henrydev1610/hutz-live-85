
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import { TimelineItem, WaveformRegion } from '@/types/lightshow';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, ArrowUpDown, Hand } from "lucide-react";

interface TimelineProps {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  timelineItems: TimelineItem[];
  onUpdateItem: (id: string, updates: Partial<TimelineItem>) => void;
  onRemoveItem: (id: string) => void;
  onItemSelect: (index: number | null) => void;
  selectedItemIndex: number | null;
}

const Timeline = ({
  audioUrl,
  isPlaying,
  currentTime,
  setCurrentTime,
  setDuration,
  timelineItems,
  onUpdateItem,
  onRemoveItem,
  onItemSelect,
  selectedItemIndex,
}: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [regions, setRegions] = useState<Record<string, WaveformRegion>>({});
  const [zoomLevel, setZoomLevel] = useState<number>(250); // Increased default zoom level
  
  const imageTrackRef = useRef<HTMLDivElement>(null);
  const flashlightTrackRef = useRef<HTMLDivElement>(null);
  
  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0]);
    if (wavesurferRef.current) {
      const zoomFactor = value[0] / 50;
      wavesurferRef.current.zoom(Math.max(1, zoomFactor * 20));
    }
  };
  
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;
    
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#8E9196',
      progressColor: '#9b87f5',
      cursorColor: '#FFFFFF',
      cursorWidth: 2,
      height: 160,
      barWidth: 1,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    
    const timeline = wavesurfer.registerPlugin(TimelinePlugin.create({
      container: '#timeline',
      primaryLabelInterval: 1,
      secondaryLabelInterval: 0.2,
      primaryColor: '#FFFFFF',
      secondaryColor: 'rgba(255, 255, 255, 0.7)',
    }));
    
    const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
    
    regionsRef.current = regions;
    wavesurferRef.current = wavesurfer;
    
    wavesurfer.load(audioUrl);
    
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
      const zoomFactor = zoomLevel / 50;
      wavesurfer.zoom(Math.max(1, zoomFactor * 20));
    });
    
    wavesurfer.on('timeupdate', (currentTime) => {
      setCurrentTime(currentTime);
    });
    
    wavesurfer.on('click', () => {
      onItemSelect(null);
    });
    
    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl]);
  
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);
  
  useEffect(() => {
    if (!wavesurferRef.current || !imageTrackRef.current || !flashlightTrackRef.current) return;
    
    if (regionsRef.current) {
      regionsRef.current.clearRegions();
    }
    
    const trackWidth = containerRef.current?.clientWidth || 0;
    const trackDuration = wavesurferRef.current.getDuration() || 1;
    
    const calculatePosition = (time: number) => {
      return (time / trackDuration) * 100;
    };
    
    const calculateWidth = (duration: number) => {
      return (duration / trackDuration) * 100;
    };
    
    if (imageTrackRef.current) {
      while (imageTrackRef.current.firstChild) {
        imageTrackRef.current.removeChild(imageTrackRef.current.firstChild);
      }
    }
    
    if (flashlightTrackRef.current) {
      while (flashlightTrackRef.current.firstChild) {
        flashlightTrackRef.current.removeChild(flashlightTrackRef.current.firstChild);
      }
    }
    
    timelineItems.forEach(item => {
      const leftPosition = calculatePosition(item.startTime);
      const widthPercentage = calculateWidth(item.duration);
      
      if (item.type === 'image' && imageTrackRef.current) {
        const regionElement = document.createElement('div');
        regionElement.className = 'absolute h-full rounded-md flex items-center justify-center overflow-hidden';
        regionElement.style.left = `${leftPosition}%`;
        regionElement.style.width = `${widthPercentage}%`;
        regionElement.style.backgroundColor = 'rgba(14, 165, 233, 0.3)';
        regionElement.style.border = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2px solid white' : '';
        regionElement.style.zIndex = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2' : '1';
        
        if (item.imageUrl) {
          const thumbnail = document.createElement('img');
          thumbnail.src = item.imageUrl;
          thumbnail.className = 'h-full object-cover opacity-70';
          regionElement.appendChild(thumbnail);
        }
        
        const label = document.createElement('div');
        label.className = 'absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1 rounded';
        label.textContent = `${item.startTime.toFixed(1)}s - ${(item.startTime + item.duration).toFixed(1)}s`;
        regionElement.appendChild(label);
        
        const leftResizeHandle = document.createElement('div');
        leftResizeHandle.className = 'absolute left-0 top-0 h-full w-2 bg-white/30 cursor-ew-resize flex items-center justify-center';
        leftResizeHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>';
        
        const rightResizeHandle = document.createElement('div');
        rightResizeHandle.className = 'absolute right-0 top-0 h-full w-2 bg-white/30 cursor-ew-resize flex items-center justify-center';
        rightResizeHandle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>';
        
        const dragHandle = document.createElement('div');
        dragHandle.className = 'absolute inset-0 cursor-grab';
        dragHandle.innerHTML = '<div class="absolute top-2 right-1/2 transform translate-x-1/2 opacity-50"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6"></path><path d="M9 17h6"></path><path d="m21 8-4-4-4 4"></path><path d="M17 4v10"></path></svg></div>';
        
        let isDragging = false;
        let isResizingLeft = false;
        let isResizingRight = false;
        let startX = 0;
        let startLeft = 0;
        let startWidth = 0;
        
        leftResizeHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          isResizingLeft = true;
          startX = e.clientX;
          startLeft = parseFloat(regionElement.style.left);
          startWidth = regionElement.offsetWidth;
          
          document.body.style.cursor = 'ew-resize';
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isResizingLeft) return;
            
            moveEvent.preventDefault();
            
            const dx = moveEvent.clientX - startX;
            const newLeft = Math.max(0, startLeft + (dx / trackWidth * 100));
            const newWidth = Math.max(5, startWidth - dx);
            
            const percentWidth = (newWidth / trackWidth) * 100;
            const maxLeft = 100 - percentWidth;
            
            if (newLeft <= maxLeft) {
              regionElement.style.left = `${newLeft}%`;
              regionElement.style.width = `${percentWidth}%`;
              
              const newStartTime = (newLeft / 100) * trackDuration;
              const newDuration = (percentWidth / 100) * trackDuration;
              
              label.textContent = `${newStartTime.toFixed(1)}s - ${(newStartTime + newDuration).toFixed(1)}s`;
              
              onUpdateItem(item.id, { 
                startTime: newStartTime,
                duration: newDuration 
              });
            }
          };
          
          const handleMouseUp = () => {
            isResizingLeft = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        });
        
        rightResizeHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          isResizingRight = true;
          startX = e.clientX;
          startWidth = regionElement.offsetWidth;
          
          document.body.style.cursor = 'ew-resize';
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isResizingRight) return;
            
            moveEvent.preventDefault();
            
            const dx = moveEvent.clientX - startX;
            const newWidth = Math.max(5, startWidth + dx);
            const percentWidth = (newWidth / trackWidth) * 100;
            
            regionElement.style.width = `${percentWidth}%`;
            
            const newDuration = (percentWidth / 100) * trackDuration;
            label.textContent = `${item.startTime.toFixed(1)}s - ${(item.startTime + newDuration).toFixed(1)}s`;
            
            onUpdateItem(item.id, { duration: newDuration });
          };
          
          const handleMouseUp = () => {
            isResizingRight = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        });
        
        dragHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (isResizingLeft || isResizingRight) return;
          
          isDragging = true;
          startX = e.clientX;
          startLeft = parseFloat(regionElement.style.left);
          
          dragHandle.style.cursor = 'grabbing';
          document.body.style.cursor = 'grabbing';
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDragging) return;
            
            moveEvent.preventDefault();
            
            const dx = moveEvent.clientX - startX;
            const percentDx = (dx / trackWidth) * 100;
            const newLeft = Math.max(0, Math.min(100 - parseFloat(regionElement.style.width), startLeft + percentDx));
            
            regionElement.style.left = `${newLeft}%`;
            
            const newStartTime = (newLeft / 100) * trackDuration;
            label.textContent = `${newStartTime.toFixed(1)}s - ${(newStartTime + item.duration).toFixed(1)}s`;
            
            onUpdateItem(item.id, { startTime: newStartTime });
          };
          
          const handleMouseUp = () => {
            isDragging = false;
            dragHandle.style.cursor = 'grab';
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        });
        
        regionElement.appendChild(leftResizeHandle);
        regionElement.appendChild(rightResizeHandle);
        regionElement.appendChild(dragHandle);
        
        imageTrackRef.current.appendChild(regionElement);
      } 
      else if (item.type === 'flashlight' && flashlightTrackRef.current) {
        const regionElement = document.createElement('div');
        regionElement.className = 'absolute h-full rounded-md flex items-center justify-center';
        regionElement.style.left = `${leftPosition}%`;
        regionElement.style.width = `${widthPercentage}%`;
        regionElement.style.backgroundColor = '#FFFFFF';
        regionElement.style.opacity = '0.5';
        regionElement.style.border = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2px solid white' : '';
        regionElement.style.zIndex = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2' : '1';
        
        const label = document.createElement('div');
        label.className = 'absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1 rounded';
        label.textContent = `${item.startTime.toFixed(1)}s`;
        regionElement.appendChild(label);
        
        if (item.pattern) {
          const intensityIndicator = document.createElement('div');
          intensityIndicator.className = 'absolute top-1 right-2 text-xs font-bold';
          intensityIndicator.textContent = `${item.pattern.intensity}%`;
          regionElement.appendChild(intensityIndicator);
        }
        
        regionElement.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = timelineItems.findIndex(i => i.id === item.id);
          onItemSelect(index);
        });
        
        flashlightTrackRef.current.appendChild(regionElement);
      }
    });
    
    const updateMarker = () => {
      const currentPos = calculatePosition(currentTime);
      const markers = document.querySelectorAll('.timeline-marker');
      markers.forEach(marker => {
        (marker as HTMLElement).style.left = `${currentPos}%`;
      });
    };
    
    updateMarker();
    
    return () => {
      if (imageTrackRef.current) {
        while (imageTrackRef.current.firstChild) {
          imageTrackRef.current.removeChild(imageTrackRef.current.firstChild);
        }
      }
      
      if (flashlightTrackRef.current) {
        while (flashlightTrackRef.current.firstChild) {
          flashlightTrackRef.current.removeChild(flashlightTrackRef.current.firstChild);
        }
      }
    };
  }, [timelineItems, selectedItemIndex, currentTime, isPlaying]);

  return (
    <div className="flex flex-col h-full bg-black/50 rounded-lg p-4 space-y-3">
      <div className="text-xs text-white/70 font-medium flex justify-between mb-2">
        <span>Trilha de Áudio</span>
        <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date((wavesurferRef.current?.getDuration() || 0) * 1000).toISOString().substr(14, 5)}</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleZoomChange([Math.max(10, zoomLevel - 20)])}
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
          onValueChange={handleZoomChange}
        />
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleZoomChange([Math.min(400, zoomLevel + 20)])}
          className="p-1 h-8 w-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="relative h-32 bg-black/30 rounded-md">
        <div ref={containerRef} className="h-full" />
        <div className="timeline-marker absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"></div>
      </div>
      
      <div id="timeline" className="h-10" />
      
      <div className="text-xs text-white/70 font-medium mb-1">Trilha de Imagens</div>
      <div className="relative h-16 bg-black/30 rounded-md">
        <div 
          ref={imageTrackRef} 
          className="relative h-full cursor-pointer"
          onClick={() => onItemSelect(null)}
        ></div>
        <div className="timeline-marker absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"></div>
      </div>
      
      <div className="text-xs text-white/70 font-medium mb-1">Trilha de Efeitos de Lanterna</div>
      <div className="relative h-16 bg-black/30 rounded-md">
        <div 
          ref={flashlightTrackRef} 
          className="relative h-full cursor-pointer"
          onClick={() => onItemSelect(null)}
        ></div>
        <div className="timeline-marker absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"></div>
      </div>
      
      <div className="mt-2 text-xs text-white/50 text-center">
        Clique em uma região para editar • Arraste o item para movê-lo • Arraste as bordas para ajustar a duração
      </div>
    </div>
  );
};

export default Timeline;
