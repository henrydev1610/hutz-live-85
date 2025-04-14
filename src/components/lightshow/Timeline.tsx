
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { TimelineItem } from '@/types/lightshow';
import TimelineZoomControls from './timeline/TimelineZoomControls';
import WaveformDisplay from './timeline/WaveformDisplay';
import TimelineItemsTrack from './timeline/TimelineItemsTrack';
import TimelineMarker from './timeline/TimelineMarker';
import { useTimelineHelpers } from '@/hooks/useTimelineHelpers';

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
  duration,
  timelineItems,
  onUpdateItem,
  onRemoveItem,
  onItemSelect,
  selectedItemIndex,
}: TimelineProps) => {
  const [zoomLevel, setZoomLevel] = useState<number>(250);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const { checkImageOverlap } = useTimelineHelpers();
  
  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0]);
  };
  
  const handleWavesurferReady = (wavesurfer: WaveSurfer, regions: RegionsPlugin) => {
    wavesurferRef.current = wavesurfer;
    regionsRef.current = regions;
  };
  
  // Handle delete key press for removing selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedItemIndex !== null) {
        const selectedItem = timelineItems[selectedItemIndex];
        if (selectedItem) {
          onRemoveItem(selectedItem.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItemIndex, timelineItems, onRemoveItem]);

  // Function to check for overlaps of timeline items
  const checkItemOverlap = (itemId: string, startTime: number, duration: number) => {
    return checkImageOverlap(itemId, startTime, duration, timelineItems);
  };

  return (
    <div className="flex flex-col h-full bg-black/50 rounded-lg p-4 space-y-3">
      <div className="text-xs text-white/70 font-medium flex justify-between mb-2">
        <span>Trilha de Áudio</span>
        <span>
          {new Date(currentTime * 1000).toISOString().substr(14, 5)} / 
          {new Date((wavesurferRef.current?.getDuration() || 0) * 1000).toISOString().substr(14, 5)}
        </span>
      </div>
      
      <TimelineZoomControls 
        zoomLevel={zoomLevel}
        onZoomChange={handleZoomChange}
      />
      
      <div className="relative">
        <WaveformDisplay 
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          setDuration={setDuration}
          zoomLevel={zoomLevel}
          onWavesurferReady={handleWavesurferReady}
          onItemSelect={onItemSelect}
        />
        <TimelineMarker currentTime={currentTime} duration={duration} />
      </div>
      
      <TimelineItemsTrack 
        type="image"
        title="Trilha de Imagens"
        timelineItems={timelineItems}
        trackDuration={duration}
        selectedItemIndex={selectedItemIndex}
        onItemSelect={onItemSelect}
        onUpdateItem={onUpdateItem}
        checkOverlap={checkItemOverlap}
      />
      
      <TimelineItemsTrack 
        type="flashlight"
        title="Trilha de Efeitos de Lanterna"
        timelineItems={timelineItems}
        trackDuration={duration}
        selectedItemIndex={selectedItemIndex}
        onItemSelect={onItemSelect}
        onUpdateItem={onUpdateItem}
      />
      
      <div className="mt-2 text-xs text-white/50 text-center">
        Clique em uma região para editar • Arraste o item para movê-lo • Arraste as bordas para ajustar a duração • Tecla Delete para remover item selecionado
      </div>
    </div>
  );
};

export default Timeline;
