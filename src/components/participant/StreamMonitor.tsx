import React, { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";

interface StreamMonitorProps {
  stream: MediaStream | null;
  participantId: string;
  onStreamHealthChange?: (isHealthy: boolean) => void;
}

export const StreamMonitor: React.FC<StreamMonitorProps> = ({
  stream,
  participantId,
  onStreamHealthChange
}) => {
  const { toast } = useToast();
  const [isHealthy, setIsHealthy] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
  const healthCheckRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!stream) {
      setIsHealthy(false);
      onStreamHealthChange?.(false);
      return;
    }

    console.log(`🩺 STREAM MONITOR: Starting monitoring for ${participantId}`);

    const checkStreamHealth = () => {
      try {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        const videoHealthy = videoTracks.length > 0 && videoTracks.some(t => 
          t.readyState === 'live' && t.enabled && !t.muted
        );
        
        const audioHealthy = audioTracks.length > 0 && audioTracks.some(t => 
          t.readyState === 'live' && t.enabled
        );
        
        const streamActive = stream.active;
        const overallHealthy = streamActive && (videoHealthy || audioHealthy);
        
        console.log(`🩺 STREAM MONITOR: Health check for ${participantId}:`, {
          streamActive,
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          videoHealthy,
          audioHealthy,
          overallHealthy,
          streamId: stream.id
        });

        if (overallHealthy !== isHealthy) {
          setIsHealthy(overallHealthy);
          onStreamHealthChange?.(overallHealthy);
          
          if (overallHealthy) {
            console.log(`✅ STREAM MONITOR: Stream healthy for ${participantId}`);
            toast({
              title: "Vídeo funcionando",
              description: `Stream ativo para ${participantId.substring(0, 8)}`,
            });
          } else {
            console.warn(`⚠️ STREAM MONITOR: Stream unhealthy for ${participantId}`);
            toast({
              title: "Problemas no vídeo",
              description: `Stream com falhas para ${participantId.substring(0, 8)}`,
              variant: "destructive"
            });
          }
        }
        
        setLastHealthCheck(new Date());
      } catch (error) {
        console.error(`❌ STREAM MONITOR: Error checking health for ${participantId}:`, error);
        setIsHealthy(false);
        onStreamHealthChange?.(false);
      }
    };

    // Check immediately
    checkStreamHealth();

    // Setup periodic health checks
    healthCheckRef.current = setInterval(checkStreamHealth, 5000);

    // Setup track event listeners
    const tracks = stream.getTracks();
    
    const trackHandlers = tracks.map(track => {
      const onEnded = () => {
        console.warn(`⚠️ STREAM MONITOR: Track ${track.kind} ended for ${participantId}`);
        checkStreamHealth();
      };
      
      const onMute = () => {
        console.warn(`⚠️ STREAM MONITOR: Track ${track.kind} muted for ${participantId}`);
        checkStreamHealth();
      };
      
      const onUnmute = () => {
        console.log(`🔊 STREAM MONITOR: Track ${track.kind} unmuted for ${participantId}`);
        checkStreamHealth();
      };

      track.addEventListener('ended', onEnded);
      track.addEventListener('mute', onMute);
      track.addEventListener('unmute', onUnmute);

      return { track, onEnded, onMute, onUnmute };
    });

    return () => {
      console.log(`🩺 STREAM MONITOR: Stopping monitoring for ${participantId}`);
      
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
      
      // Remove track listeners
      trackHandlers.forEach(({ track, onEnded, onMute, onUnmute }) => {
        track.removeEventListener('ended', onEnded);
        track.removeEventListener('mute', onMute);
        track.removeEventListener('unmute', onUnmute);
      });
    };
  }, [stream, participantId, isHealthy, onStreamHealthChange, toast]);

  return (
    <div className="stream-monitor">
      {/* Health indicator */}
      <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs opacity-50">
          {lastHealthCheck?.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};