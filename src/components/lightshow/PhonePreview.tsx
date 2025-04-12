
import { useState, useEffect, useRef } from 'react';
import { TimelineItem } from '@/types/lightshow';

interface PhonePreviewProps {
  isPlaying: boolean;
  currentTime: number;
  timelineItems: TimelineItem[];
}

const PhonePreview = ({ isPlaying, currentTime, timelineItems }: PhonePreviewProps) => {
  const [activeFlashlight, setActiveFlashlight] = useState(false);
  const [flashlightColor, setFlashlightColor] = useState('#FFFFFF');
  const [flashlightIntensity, setFlashlightIntensity] = useState(0);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const flashIntervalRef = useRef<number | null>(null);
  
  // Clear any existing intervals when component unmounts
  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        window.clearInterval(flashIntervalRef.current);
      }
    };
  }, []);
  
  // Update active items based on current time
  useEffect(() => {
    // Clear any existing flash intervals
    if (flashIntervalRef.current) {
      window.clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    
    // Reset states
    setActiveFlashlight(false);
    setFlashlightIntensity(0);
    
    if (!isPlaying) return;
    
    // Find active items at current time
    const activeItems = timelineItems.filter(item => 
      currentTime >= item.startTime && currentTime < (item.startTime + item.duration)
    );
    
    // Process active items
    let activeImage: string | null = null;
    let activeBackgroundColor: string = '#000000';
    let activeFlashlightItem: TimelineItem | null = null;
    
    activeItems.forEach(item => {
      if (item.type === 'image') {
        if (item.imageUrl) {
          // Last image in the list will be shown (in case of overlapping images)
          activeImage = item.imageUrl;
        } else if (item.backgroundColor) {
          // Use background color if specified
          activeBackgroundColor = item.backgroundColor;
        }
      } else if (item.type === 'flashlight' && item.pattern) {
        // Using the last active flashlight (in case of overlapping)
        activeFlashlightItem = item;
      }
    });
    
    // Update display image and background
    setDisplayImage(activeImage);
    setBackgroundColor(activeBackgroundColor);
    
    // Handle flashlight
    if (activeFlashlightItem && activeFlashlightItem.pattern) {
      const { intensity, blinkRate, color } = activeFlashlightItem.pattern;
      setFlashlightColor(color);
      
      if (blinkRate > 0) {
        // Set up flashing with the specified rate - faster blinking (0.2s)
        const intervalMs = 200; // 0.2 seconds, or 5Hz
        let isOn = true;
        
        setActiveFlashlight(true);
        setFlashlightIntensity(intensity);
        
        flashIntervalRef.current = window.setInterval(() => {
          isOn = !isOn;
          setFlashlightIntensity(isOn ? intensity : 0);
        }, intervalMs);
      } else {
        // Steady light, no flashing
        setActiveFlashlight(true);
        setFlashlightIntensity(intensity);
      }
    }
  }, [currentTime, isPlaying, timelineItems]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-64 h-[500px] bg-black rounded-3xl border-8 border-gray-800 overflow-hidden shadow-xl">
        {/* Phone "notch" */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-30"></div>
        
        {/* Phone screen */}
        <div 
          className="relative w-full h-full overflow-hidden"
          style={{ backgroundColor }}
        >
          {/* Flashlight spot effect at top center */}
          {activeFlashlight && (
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
              <div 
                className="w-6 h-6 rounded-full transition-opacity duration-100"
                style={{ 
                  boxShadow: `0 0 20px 10px ${flashlightColor}`,
                  opacity: flashlightIntensity / 100
                }}
              ></div>
            </div>
          )}
          
          {/* Display image if any */}
          {displayImage && (
            <div className="flex items-center justify-center h-full">
              <img 
                src={displayImage} 
                alt="Display content" 
                className="max-w-full max-h-full object-contain z-10"
              />
            </div>
          )}
          
          {/* Default content when nothing is playing */}
          {!isPlaying && !displayImage && (
            <div className="flex flex-col items-center justify-center h-full text-white/70 p-4">
              <div className="text-center">
                <p className="mb-2">Aponte a câmera</p>
                <p className="text-xs">Seu show de luzes interativo será exibido aqui</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Home indicator */}
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-400 rounded-full z-20"></div>
      </div>
      
      <div className="mt-4 text-white/70 text-sm text-center">
        <p>Prévia do Aplicativo</p>
        <p className="text-xs mt-1">
          {isPlaying ? "Reproduzindo..." : "Pressione Play para visualizar"}
        </p>
      </div>
    </div>
  );
};

export default PhonePreview;
