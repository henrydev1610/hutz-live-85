
import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Camera, Video, Smartphone } from 'lucide-react';
import { detectMobileAggressively, getCameraPreference, setCameraPreference } from '@/utils/media/deviceDetection';

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
  const isMobile = detectMobileAggressively();
  const currentPreference = getCameraPreference();

  const handleSwitchCamera = async () => {
    const newFacing = currentPreference === 'user' ? 'environment' : 'user';
    
    console.log(`📱 CAMERA SWITCH: Switching from ${currentPreference} to ${newFacing}`);
    
    try {
      setCameraPreference(newFacing);
      await onSwitchCamera(newFacing);
      console.log(`✅ CAMERA SWITCH: Successfully switched to ${newFacing}`);
    } catch (error) {
      console.error('❌ CAMERA SWITCH: Failed to switch camera:', error);
      // Revert preference on failure
      setCameraPreference(currentPreference);
    }
  };

  // Only show camera switcher on mobile devices with video
  if (!isMobile || !hasVideo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-black/30 rounded-lg border border-white/10">
      <Smartphone className="h-4 w-4 text-green-400" />
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleSwitchCamera}
        disabled={isLoading}
        className="bg-black/50 border-white/20 text-white hover:bg-white/10 transition-all duration-200"
      >
        <RotateCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {currentPreference === 'user' ? (
          <>
            <Video className="h-4 w-4 mr-1" />
            → Traseira
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-1" />
            → Frontal
          </>
        )}
      </Button>
      
      <div className="text-xs text-white/70">
        <div className="font-medium">
          📱 Móvel: {currentPreference === 'user' ? '🤳 Frontal' : '📷 Traseira'}
        </div>
        <div className="text-[10px] opacity-60">
          {currentPreference === 'environment' ? 'Melhor para transmissão' : 'Câmera selfie'}
        </div>
      </div>
    </div>
  );
};
