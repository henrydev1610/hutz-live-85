
import React from 'react';

interface TimelineMarkerProps {
  currentTime: number;
  duration: number;
}

const TimelineMarker = ({ currentTime, duration }: TimelineMarkerProps) => {
  const markerPosition = (currentTime / (duration || 1)) * 100;

  return (
    <div 
      className="absolute top-0 h-full w-0.5 bg-white z-20 pointer-events-none"
      style={{ left: `${markerPosition}%` }}
    />
  );
};

export default TimelineMarker;
