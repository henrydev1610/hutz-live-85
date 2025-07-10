import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Camera, Video } from 'lucide-react';
import { detectMobile, getCameraPreference, setCameraPreference } from '@/utils/media/deviceDetection';

interface CameraSwitcherProps {
  onSwitchCamera: (facing: 'user' | 'environment') => Promise<void>;
  isLoading?: boolean;
  hasVideo?: boolean;
}

export const CameraSwitcher: React.FC<CameraSwitcherProps> = ({
  onSwitchCamera,
  isLoading = false,
  hasVideo = false
}) => {
  const isMobile = detectMobile();
  const currentPreference = getCameraPreference();

  const handleSwitchCamera = async () => {
    const newFacing = currentPreference === 'user' ? 'environment' : 'user';
    setCameraPreference(newFacing);
    
    console.log(`📱 Switching camera from ${currentPreference} to ${newFacing}`);
    
    try {
      await onSwitchCamera(newFacing);
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
      // Revert preference on failure
      setCameraPreference(currentPreference);
    }
  };

  // Only show camera switcher on mobile devices with video
  if (!isMobile || !hasVideo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSwitchCamera}
        disabled={isLoading}
        className="bg-black/50 border-white/20 text-white hover:bg-white/10"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        {currentPreference === 'user' ? (
          <>
            <Camera className="h-4 w-4 mr-1" />
            Frontal
          </>
        ) : (
          <>
            <Video className="h-4 w-4 mr-1" />
            Traseira
          </>
        )}
      </Button>
      
      <div className="text-xs text-white/70">
        Câmera: {currentPreference === 'user' ? 'Frontal' : 'Traseira'}
      </div>
    </div>
  );
};