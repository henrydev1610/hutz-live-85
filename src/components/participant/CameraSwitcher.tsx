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
    return (
      <div className="text-xs text-white/50 text-center">
        {!isMobile ? 'Troca de câmera disponível apenas no celular' : 'Câmera não disponível'}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="outline"
        size="default"
        onClick={handleSwitchCamera}
        disabled={isLoading}
        className="bg-black/50 border-white/20 text-white hover:bg-white/10 px-6 py-3"
      >
        <RotateCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {currentPreference === 'user' ? (
          <>
            <Camera className="h-4 w-4 mr-1" />
            Trocar para Traseira
          </>
        ) : (
          <>
            <Video className="h-4 w-4 mr-1" />
            Trocar para Frontal
          </>
        )}
      </Button>
      
      <div className="text-xs text-white/70 text-center">
        Câmera Atual: {currentPreference === 'user' ? 'Frontal 🤳' : 'Traseira 📸'}
      </div>
    </div>
  );
};