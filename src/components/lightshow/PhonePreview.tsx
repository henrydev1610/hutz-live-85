
import { useState, useEffect, useRef } from 'react';
import { TimelineItem } from '@/types/lightshow';

interface PhonePreviewProps {
  isPlaying: boolean;
  currentTime: number;
  timelineItems: TimelineItem[];
}

const PhonePreview = ({ isPlaying, currentTime, timelineItems }: PhonePreviewProps) => {
  const [activeFlashlight, setActiveFlashlight] = useState(false);
  const [flashlightIntensity, setFlashlightIntensity] = useState(0);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const flashIntervalRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number | null>(null);
  
  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        window.clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      
      if (frameIdRef.current) {
        window.cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (Math.abs(currentTime - lastTimeRef.current) > 0.05) { // More frequent updates
      updateActiveElements(currentTime);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);
  
  useEffect(() => {
    updateActiveElements(currentTime);
  }, [currentTime, isPlaying, timelineItems]);
  
  const updateActiveElements = (time: number) => {
    if (flashIntervalRef.current) {
      window.clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    
    if (frameIdRef.current) {
      window.cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    
    setActiveFlashlight(false);
    setFlashlightIntensity(0);
    
    const activeItems = timelineItems.filter(item => 
      time >= item.startTime && time < (item.startTime + item.duration)
    );
    
    let activeImage: string | null = null;
    let activeBackgroundColor: string = '#000000';
    let activeFlashlightItem: TimelineItem | null = null;
    
    activeItems.forEach(item => {
      if (item.type === 'image') {
        if (item.imageUrl) {
          activeImage = item.imageUrl;
        } else if (item.backgroundColor) {
          activeBackgroundColor = item.backgroundColor;
        }
      } else if (item.type === 'flashlight' && item.pattern) {
        activeFlashlightItem = item;
      }
    });
    
    setDisplayImage(activeImage);
    setBackgroundColor(activeBackgroundColor);
    
    if (isPlaying && activeFlashlightItem && activeFlashlightItem.pattern) {
      const { intensity, blinkRate } = activeFlashlightItem.pattern;
      
      setActiveFlashlight(true);
      
      if (blinkRate > 0) {
        let isOn = true;
        let lastToggleTime = performance.now();
        // Ensure the toggle interval is small enough for fast blinking
        const toggleIntervalMs = 1000 / blinkRate;
        
        setFlashlightIntensity(intensity);
        
        const animateFlash = (timestamp: number) => {
          if (timestamp - lastToggleTime >= toggleIntervalMs) {
            isOn = !isOn;
            setFlashlightIntensity(isOn ? intensity : 0);
            lastToggleTime = timestamp;
          }
          
          frameIdRef.current = window.requestAnimationFrame(animateFlash);
        };
        
        frameIdRef.current = window.requestAnimationFrame(animateFlash);
      } else {
        setActiveFlashlight(true);
        setFlashlightIntensity(intensity);
      }
    }
  };

  useEffect(() => {
    if (!displayImage) {
      const activeImages = timelineItems.filter(item => 
        item.type === 'image' && 
        item.imageUrl &&
        currentTime >= item.startTime && 
        currentTime < (item.startTime + item.duration)
      );
      
      if (activeImages.length > 0) {
        setDisplayImage(activeImages[activeImages.length - 1].imageUrl || null);
        return;
      }
      
      const sortedImages = timelineItems
        .filter(item => item.type === 'image' && item.imageUrl)
        .sort((a, b) => {
          const aContains = currentTime >= a.startTime && currentTime < (a.startTime + a.duration);
          const bContains = currentTime >= b.startTime && currentTime < (b.startTime + b.duration);
          
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;
          
          const aDistance = Math.min(
            Math.abs(currentTime - a.startTime),
            Math.abs(currentTime - (a.startTime + a.duration))
          );
          
          const bDistance = Math.min(
            Math.abs(currentTime - b.startTime),
            Math.abs(currentTime - (b.startTime + b.duration))
          );
          
          return aDistance - bDistance;
        });
      
      if (sortedImages.length > 0) {
        setDisplayImage(sortedImages[0].imageUrl);
      }
    }
  }, [timelineItems, currentTime, displayImage]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-64 h-[500px] bg-black rounded-3xl border-8 border-gray-800 overflow-hidden shadow-xl">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-30"></div>
        
        <div 
          className="relative w-full h-full overflow-hidden"
          style={{ backgroundColor }}
        >
          {activeFlashlight && (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20 pointer-events-none">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ 
                  boxShadow: `0 0 10px 5px rgba(255, 255, 255, ${flashlightIntensity / 100})`,
                  transition: 'opacity 0.5ms linear', // Ultra fast transition
                  position: 'absolute',
                  top: '2%', // Position at the very top
                  opacity: flashlightIntensity / 100
                }}
              ></div>
            </div>
          )}
          
          {displayImage && (
            <div className="flex items-center justify-center h-full">
              <img 
                src={displayImage} 
                alt="Display content" 
                className="max-w-full max-h-full object-contain z-10"
              />
            </div>
          )}
          
          {!displayImage && (
            <div className="flex flex-col items-center justify-center h-full text-white/70 p-4">
              <div className="text-center">
                <p className="mb-2">Aponte a câmera</p>
                <p className="text-xs">Seu show de luzes interativo será exibido aqui</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-400 rounded-full z-20"></div>
      </div>
      
      <div className="mt-4 text-white/70 text-sm text-center">
        <p>Prévia do Aplicativo</p>
        <p className="text-xs mt-1">
          {isPlaying ? `Reproduzindo em ${currentTime.toFixed(2)}s` : "Visualizando preview"}
        </p>
      </div>
    </div>
  );
};

export default PhonePreview;
