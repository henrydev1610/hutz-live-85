
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import { TimelineItem, WaveformRegion } from '@/types/lightshow';

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
  
  // Track references
  const imageTrackRef = useRef<HTMLDivElement>(null);
  const flashlightTrackRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;
    
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#8E9196',
      progressColor: '#9b87f5',
      cursorColor: '#FFFFFF',
      cursorWidth: 2,
      height: 160, // Increased height for more detailed view
      barWidth: 1,  // Thinner bars for more detail
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    
    const timeline = wavesurfer.registerPlugin(TimelinePlugin.create({
      container: '#timeline',
      primaryLabelInterval: 1, // Increased precision to 1 second intervals
      secondaryLabelInterval: 0.2, // More precise marking at 0.2 second intervals
      primaryColor: '#FFFFFF',
      secondaryColor: 'rgba(255, 255, 255, 0.7)',
    }));
    
    const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
    
    regionsRef.current = regions;
    wavesurferRef.current = wavesurfer;
    
    wavesurfer.load(audioUrl);
    
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });
    
    wavesurfer.on('timeupdate', (currentTime) => {
      setCurrentTime(currentTime);
    });
    
    wavesurfer.on('click', () => {
      // Deselect when clicking on the waveform
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
    
    // Clear previous regions
    if (regionsRef.current) {
      regionsRef.current.clearRegions();
    }
    
    // Get track widths to match waveform
    const trackWidth = containerRef.current?.clientWidth || 0;
    const trackDuration = wavesurferRef.current.getDuration() || 1;
    
    // Helper to calculate position percentage
    const calculatePosition = (time: number) => {
      return (time / trackDuration) * 100;
    };
    
    // Helper to calculate width percentage
    const calculateWidth = (duration: number) => {
      return (duration / trackDuration) * 100;
    };
    
    // Process and create regions for each track
    timelineItems.forEach(item => {
      const leftPosition = calculatePosition(item.startTime);
      const widthPercentage = calculateWidth(item.duration);
      
      if (item.type === 'image' && imageTrackRef.current) {
        // Create an image region in the image track
        const regionElement = document.createElement('div');
        regionElement.className = 'absolute h-full rounded-md flex items-center justify-center overflow-hidden';
        regionElement.style.left = `${leftPosition}%`;
        regionElement.style.width = `${widthPercentage}%`;
        regionElement.style.backgroundColor = 'rgba(14, 165, 233, 0.3)';
        regionElement.style.border = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2px solid white' : '';
        regionElement.style.zIndex = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2' : '1';
          
        // Add thumbnail if available
        if (item.imageUrl) {
          const thumbnail = document.createElement('img');
          thumbnail.src = item.imageUrl;
          thumbnail.className = 'h-full object-cover opacity-70';
          regionElement.appendChild(thumbnail);
        }
        
        // Add label
        const label = document.createElement('div');
        label.className = 'absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1 rounded';
        label.textContent = `${item.startTime.toFixed(1)}s`;
        regionElement.appendChild(label);
        
        // Add click handler
        regionElement.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = timelineItems.findIndex(i => i.id === item.id);
          onItemSelect(index);
        });
        
        // Add drag capabilities
        regionElement.setAttribute('draggable', 'true');
        
        imageTrackRef.current.appendChild(regionElement);
      } 
      else if (item.type === 'flashlight' && flashlightTrackRef.current) {
        // Create a flashlight region in the flashlight track
        const regionElement = document.createElement('div');
        regionElement.className = 'absolute h-full rounded-md flex items-center justify-center';
        regionElement.style.left = `${leftPosition}%`;
        regionElement.style.width = `${widthPercentage}%`;
        regionElement.style.backgroundColor = item.pattern?.color || 'rgba(139, 92, 246, 0.3)';
        regionElement.style.opacity = '0.5';
        regionElement.style.border = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2px solid white' : '';
        regionElement.style.zIndex = selectedItemIndex !== null && 
          timelineItems[selectedItemIndex]?.id === item.id ? '2' : '1';
        
        // Add label
        const label = document.createElement('div');
        label.className = 'absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1 rounded';
        label.textContent = `${item.startTime.toFixed(1)}s`;
        regionElement.appendChild(label);
        
        // Add intensity indicator
        if (item.pattern) {
          const intensityIndicator = document.createElement('div');
          intensityIndicator.className = 'absolute top-1 right-2 text-xs font-bold';
          intensityIndicator.textContent = `${item.pattern.intensity}%`;
          regionElement.appendChild(intensityIndicator);
        }
        
        // Add click handler
        regionElement.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = timelineItems.findIndex(i => i.id === item.id);
          onItemSelect(index);
        });
        
        // Add drag capabilities
        regionElement.setAttribute('draggable', 'true');
        
        flashlightTrackRef.current.appendChild(regionElement);
      }
    });
    
    // Create a timeline marker that follows playback
    const updateMarker = () => {
      const currentPos = calculatePosition(currentTime);
      const markers = document.querySelectorAll('.timeline-marker');
      markers.forEach(marker => {
        (marker as HTMLElement).style.left = `${currentPos}%`;
      });
    };
    
    updateMarker();
    
    // Clean up function to remove created DOM elements
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
      
      {/* Audio waveform track - now taller for more detail */}
      <div className="relative h-32 bg-black/30 rounded-md">
        <div ref={containerRef} className="h-full" />
        <div className="timeline-marker absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"></div>
      </div>
      
      {/* Time ruler - now with more precise markings */}
      <div id="timeline" className="h-10" />
      
      {/* Image track */}
      <div className="text-xs text-white/70 font-medium mb-1">Trilha de Imagens</div>
      <div className="relative h-16 bg-black/30 rounded-md">
        <div 
          ref={imageTrackRef} 
          className="relative h-full cursor-pointer"
          onClick={() => onItemSelect(null)}
        ></div>
        <div className="timeline-marker absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"></div>
      </div>
      
      {/* Flashlight track */}
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
        Clique em uma região para editar • Adicione conteúdo às trilhas específicas
      </div>
    </div>
  );
};

export default Timeline;
