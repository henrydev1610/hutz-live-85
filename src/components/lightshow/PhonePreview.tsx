
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
  
  // Clear any existing intervals when component unmounts
  useEffect(() => {
    return () => {
      if (flashIntervalRef.current) {
        if (typeof flashIntervalRef.current === 'number') {
          if (flashIntervalRef.current > 10) { // Arbitrary threshold to distinguish between setInterval and rAF
            window.cancelAnimationFrame(flashIntervalRef.current);
          } else {
            window.clearInterval(flashIntervalRef.current);
          }
        }
        flashIntervalRef.current = null;
      }
    };
  }, []);
  
  // Monitor time changes to detect discontinuity
  useEffect(() => {
    // If there's a time jump (seek operation), reset active elements
    if (Math.abs(currentTime - lastTimeRef.current) > 0.1) { // More than 100ms jump
      // Reset states immediately to reflect new position
      updateActiveElements(currentTime);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);
  
  // Update active items based on current time
  useEffect(() => {
    updateActiveElements(currentTime);
  }, [currentTime, isPlaying, timelineItems]);
  
  const updateActiveElements = (time: number) => {
    // Clear any existing flash intervals
    if (flashIntervalRef.current) {
      if (typeof flashIntervalRef.current === 'number') {
        if (flashIntervalRef.current > 10) { // Arbitrary threshold to distinguish between setInterval and rAF
          window.cancelAnimationFrame(flashIntervalRef.current);
        } else {
          window.clearInterval(flashIntervalRef.current);
        }
      }
      flashIntervalRef.current = null;
    }
    
    // Reset states
    setActiveFlashlight(false);
    setFlashlightIntensity(0);
    
    // Find active items at current time
    const activeItems = timelineItems.filter(item => 
      time >= item.startTime && time < (item.startTime + item.duration)
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
    
    // Handle flashlight - only when playing
    if (isPlaying && activeFlashlightItem && activeFlashlightItem.pattern) {
      const { intensity, blinkRate } = activeFlashlightItem.pattern;
      
      // Set base flashlight state
      setActiveFlashlight(true);
      
      if (blinkRate > 0) {
        // For faster blinking effects (over 10Hz), use RAF for smoother animation
        if (blinkRate > 10) {
          let isOn = true;
          let lastToggleTime = performance.now();
          const toggleIntervalMs = 1000 / blinkRate;
          
          // Start with light on
          setFlashlightIntensity(intensity);
          
          // Use more efficient animation frame for very fast blinking
          const animateFlash = (timestamp: number) => {
            if (timestamp - lastToggleTime >= toggleIntervalMs) {
              isOn = !isOn;
              setFlashlightIntensity(isOn ? intensity : 0);
              lastToggleTime = timestamp;
            }
            
            flashIntervalRef.current = window.requestAnimationFrame(animateFlash) as unknown as number;
          };
          
          // Start the animation
          flashIntervalRef.current = window.requestAnimationFrame(animateFlash) as unknown as number;
        } else {
          // For slower blinking, setInterval is fine
          // Set up flashing with the specified rate
          const intervalMs = Math.max(10, 1000 / blinkRate); // Minimum 10ms interval (100Hz max)
          let isOn = true;
          
          // Start with light on
          setFlashlightIntensity(intensity);
          
          flashIntervalRef.current = window.setInterval(() => {
            isOn = !isOn;
            setFlashlightIntensity(isOn ? intensity : 0);
          }, intervalMs);
        }
      } else {
        // Steady light, no flashing
        setActiveFlashlight(true);
        setFlashlightIntensity(intensity);
      }
    }
  };

  // Find an image to display even when not playing
  useEffect(() => {
    // If we don't have an active image from the timeline, find the closest image to display
    if (!displayImage) {
      // First try to find images that contain the current time
      const activeImages = timelineItems.filter(item => 
        item.type === 'image' && 
        item.imageUrl &&
        currentTime >= item.startTime && 
        currentTime < (item.startTime + item.duration)
      );
      
      if (activeImages.length > 0) {
        // Use the last image (top layer)
        setDisplayImage(activeImages[activeImages.length - 1].imageUrl || null);
        return;
      }
      
      // If no active images, find the closest one
      const sortedImages = timelineItems
        .filter(item => item.type === 'image' && item.imageUrl)
        .sort((a, b) => {
          // If one item contains the current time, prefer it
          const aContains = currentTime >= a.startTime && currentTime < (a.startTime + a.duration);
          const bContains = currentTime >= b.startTime && currentTime < (b.startTime + b.duration);
          
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;
          
          // Calculate distance to current time
          const aDistance = Math.min(
            Math.abs(currentTime - a.startTime),
            Math.abs(currentTime - (a.startTime + a.duration))
          );
          
          const bDistance = Math.min(
            Math.abs(currentTime - b.startTime),
            Math.abs(currentTime - (b.startTime + b.duration))
          );
          
          // Return the closest one
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
        {/* Phone "notch" */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-30"></div>
        
        {/* Phone screen */}
        <div 
          className="relative w-full h-full overflow-hidden"
          style={{ backgroundColor }}
        >
          {/* Flashlight spot effect at top center - always white */}
          {activeFlashlight && (
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
              <div 
                className="w-6 h-6 rounded-full"
                style={{ 
                  boxShadow: `0 0 20px 10px #FFFFFF`,
                  opacity: flashlightIntensity / 100,
                  transition: 'opacity 30ms linear' // Even faster transitions for better sync
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
          {!displayImage && (
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
          {isPlaying ? `Reproduzindo em ${currentTime.toFixed(2)}s` : "Visualizando preview"}
        </p>
      </div>
    </div>
  );
};

export default PhonePreview;
