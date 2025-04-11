
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
  
  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;
    
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#8E9196',
      progressColor: '#9b87f5',
      cursorColor: '#FFFFFF',
      cursorWidth: 2,
      height: 128,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    
    const timeline = wavesurfer.registerPlugin(TimelinePlugin.create({
      container: '#timeline',
      primaryLabelInterval: 5,
      secondaryLabelInterval: 1,
      // Updated property names for the TimelinePlugin
      primaryFontColor: 'rgba(255, 255, 255, 0.7)',
      secondaryFontColor: 'rgba(255, 255, 255, 0.5)',
      primaryColor: 'rgba(255, 255, 255, 0.5)',
      secondaryColor: 'rgba(255, 255, 255, 0.2)',
    }));
    
    // Fix: Create the RegionsPlugin with empty options
    const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
    
    regionsRef.current = regions;
    wavesurferRef.current = wavesurfer;
    
    // Load audio
    wavesurfer.load(audioUrl);
    
    // Set up event handlers
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });
    
    wavesurfer.on('timeupdate', (currentTime) => {
      setCurrentTime(currentTime);
    });
    
    regions.on('region-clicked', (region) => {
      const index = timelineItems.findIndex(item => item.id === region.id);
      onItemSelect(index);
    });
    
    regions.on('region-updated', (region) => {
      const { id, start, end } = region;
      const item = timelineItems.find(item => item.id === id);
      
      if (item) {
        onUpdateItem(id, {
          startTime: start,
          duration: end - start,
        });
      }
    });
    
    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl]);
  
  // Handle play/pause
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);
  
  // Update regions when timeline items change
  useEffect(() => {
    if (!regionsRef.current || !wavesurferRef.current) return;
    
    // Clear existing regions
    regionsRef.current.clearRegions();
    
    // Add new regions for each timeline item
    timelineItems.forEach(item => {
      // Define color based on item type
      const color = item.type === 'image' 
        ? 'rgba(14, 165, 233, 0.3)' // Blue for images
        : 'rgba(139, 92, 246, 0.3)'; // Purple for flashlight
      
      // Create region with the correct options format
      const region = regionsRef.current?.addRegion({
        id: item.id,
        start: item.startTime,
        end: item.startTime + item.duration,
        color,
        drag: true,
        resize: true,
        // Store metadata using attributes rather than data property
        attributes: {
          type: item.type,
          item: JSON.stringify(item)
        }
      });
      
      if (region) {
        // Check if this is the selected region
        const index = timelineItems.findIndex(i => i.id === item.id);
        if (index === selectedItemIndex) {
          region.element.style.border = '2px solid white';
          region.element.style.zIndex = '2';
        } else {
          region.element.style.border = '';
          region.element.style.zIndex = '1';
        }
      }
    });
  }, [timelineItems, selectedItemIndex]);

  return (
    <div className="flex flex-col h-full bg-black/50 rounded-lg p-4">
      <div ref={containerRef} className="flex-1" />
      <div id="timeline" className="h-20" />
      
      <div className="mt-2 text-xs text-white/50 text-center">
        Arraste as regiões para ajustar o tempo • Clique em uma região para editar • Duplo clique para remover
      </div>
    </div>
  );
};

export default Timeline;
