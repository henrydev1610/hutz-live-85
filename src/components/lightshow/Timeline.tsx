
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import { MediaTrackType, TimelineItem, TrackConfig, WaveformRegion } from '@/types/lightshow';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Plus } from 'lucide-react';

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
  onAddItem: (type: MediaTrackType) => void;
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
  onAddItem,
}: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [regions, setRegions] = useState<Record<string, WaveformRegion>>({});
  const [tracks, setTracks] = useState<TrackConfig[]>([
    { id: 'audio', name: 'Áudio', type: 'audio', color: '#4B5563', visible: true },
    { id: 'image', name: 'Imagens', type: 'image', color: '#0EA5E9', visible: true },
    { id: 'flashlight', name: 'Luz do Celular', type: 'flashlight', color: '#8B5CF6', visible: true },
    { id: 'background', name: 'Cor de Fundo', type: 'background', color: '#F59E0B', visible: true },
  ]);
  
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
      // Corrected property names for TimelinePlugin
      primaryColor: '#FFFFFF',
      secondaryColor: 'rgba(255, 255, 255, 0.7)',
      // FontSize is used instead of fontColor
      fontSize: 10,
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
  
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);
  
  useEffect(() => {
    if (!regionsRef.current || !wavesurferRef.current) return;
    
    regionsRef.current.clearRegions();
    
    // Filter items by visible tracks
    const visibleTrackIds = tracks.filter(t => t.visible).map(t => t.id);
    const visibleItems = timelineItems.filter(item => visibleTrackIds.includes(item.type));
    
    visibleItems.forEach(item => {
      const trackConfig = tracks.find(t => t.type === item.type);
      const color = trackConfig ? `${trackConfig.color}80` : 'rgba(128, 128, 128, 0.3)'; // Add 50% transparency
      
      const region = regionsRef.current?.addRegion({
        id: item.id,
        start: item.startTime,
        end: item.startTime + item.duration,
        color,
        drag: true,
        resize: true,
        content: JSON.stringify({
          type: item.type,
          item: JSON.stringify(item)
        })
      });
      
      if (region) {
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
  }, [timelineItems, selectedItemIndex, tracks]);

  const toggleTrackVisibility = (trackId: string) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, visible: !track.visible } : track
    ));
  };

  return (
    <div className="flex flex-col h-full bg-black/50 rounded-lg p-4">
      <div className="flex mb-4 gap-2 overflow-x-auto pb-2">
        {tracks.map(track => (
          <div 
            key={track.id} 
            className="flex items-center gap-1"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleTrackVisibility(track.id)}
              className="h-7 px-2"
            >
              {track.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </Button>
            <div 
              className="px-3 py-1 rounded-md text-xs text-white flex items-center gap-1"
              style={{ backgroundColor: track.color }}
            >
              {track.name}
            </div>
            {track.id !== 'audio' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddItem(track.type)}
              >
                <Plus size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <div ref={containerRef} className="flex-1" />
      <div id="timeline" className="h-20" />
      
      <div className="mt-2 text-xs text-white/50 text-center">
        Arraste as regiões para ajustar o tempo • Clique em uma região para editar • Duplo clique para remover
      </div>
    </div>
  );
};

export default Timeline;
