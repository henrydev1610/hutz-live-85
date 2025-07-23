
import React from 'react';

const LiveIndicator: React.FC = () => {
  return (
    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center z-30">
      <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
      AO VIVO
    </div>
  );
};

export default LiveIndicator;
