
import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

interface WaveformDisplayProps {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  zoomLevel: number;
  onWavesurferReady: (wavesurfer: WaveSurfer, regions: RegionsPlugin) => void;
  onItemSelect: (index: number | null) => void;
}

const WaveformDisplay = ({
  audioUrl,
  isPlaying,
  currentTime,
  setCurrentTime,
  setDuration,
  zoomLevel,
  onWavesurferReady,
  onItemSelect
}: WaveformDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const audioLoadedRef = useRef<boolean>(false);
  
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;
    
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      audioLoadedRef.current = false;
    }
    
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
      style: {
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 1)',
        backgroundColor: 'transparent'
      }
    }));
    
    const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
    
    regionsRef.current = regions;
    wavesurferRef.current = wavesurfer;
    
    wavesurfer.load(audioUrl);
    
    wavesurfer.on('ready', () => {
      audioLoadedRef.current = true;
      setDuration(wavesurfer.getDuration());
      const zoomFactor = zoomLevel / 50;
      wavesurfer.zoom(Math.max(1, zoomFactor * 20));
      onWavesurferReady(wavesurfer, regions);
    });
    
    wavesurfer.on('timeupdate', (currentTime) => {
      setCurrentTime(currentTime);
    });
    
    wavesurfer.on('click', () => {
      onItemSelect(null);
    });
    
    return () => {
      if (wavesurfer) {
        try {
          wavesurfer.destroy();
        } catch (error) {
          console.error("Error destroying wavesurfer:", error);
        }
      }
    };
  }, [audioUrl, onWavesurferReady, onItemSelect, setCurrentTime, setDuration, zoomLevel]);
  
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);
  
  useEffect(() => {
    // Only apply zoom if wavesurfer is initialized and audio is loaded
    if (!wavesurferRef.current || !audioLoadedRef.current) return;
    
    try {
      const zoomFactor = zoomLevel / 50;
      wavesurferRef.current.zoom(Math.max(1, zoomFactor * 20));
    } catch (error) {
      console.error("Error applying zoom:", error);
    }
  }, [zoomLevel]);

  return (
    <>
      <div className="relative h-32 bg-black/30 rounded-md">
        <div ref={containerRef} className="h-full" />
      </div>
      <div id="timeline" className="h-10" />
    </>
  );
};

export default WaveformDisplay;
