import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";

interface UserGestureOverlayProps {
  isVisible: boolean;
  isRecovering: boolean;
  onUserGesture: () => void;
}

export const UserGestureOverlay = ({
  isVisible,
  isRecovering,
  onUserGesture
}: UserGestureOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            {isRecovering ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : (
              <Camera className="h-12 w-12 text-primary" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isRecovering ? 'Reconnecting Camera...' : 'Camera Needs Restart'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRecovering 
                ? 'Please wait while we restore your camera connection'
                : 'Your camera has stopped sending video. Tap below to restart it.'
              }
            </p>
          </div>

          {!isRecovering && (
            <Button 
              onClick={onUserGesture}
              className="w-full"
              size="lg"
            >
              <Camera className="mr-2 h-4 w-4" />
              Restart Camera
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};