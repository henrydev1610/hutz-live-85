
import React, { useEffect, useRef } from 'react';
import { TimelineItem } from '@/types/lightshow';

interface TimelineItemsTrackProps {
  type: 'image' | 'flashlight';
  title: string;
  timelineItems: TimelineItem[];
  trackDuration: number;
  selectedItemIndex: number | null;
  onItemSelect: (index: number | null) => void;
  onUpdateItem: (id: string, updates: Partial<TimelineItem>) => void;
  checkOverlap?: (itemId: string, startTime: number, duration: number) => boolean;
}

const TimelineItemsTrack = ({
  type,
  title,
  timelineItems,
  trackDuration,
  selectedItemIndex,
  onItemSelect,
  onUpdateItem,
  checkOverlap
}: TimelineItemsTrackProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!trackRef.current) return;
    
    // Clear existing elements
    while (trackRef.current.firstChild) {
      trackRef.current.removeChild(trackRef.current.firstChild);
    }
    
    const filteredItems = timelineItems.filter(item => item.type === type);
    
    filteredItems.forEach(item => {
      const leftPosition = (item.startTime / trackDuration) * 100;
      const widthPercentage = (item.duration / trackDuration) * 100;
      
      const regionElement = document.createElement('div');
      regionElement.className = 'absolute h-full rounded-md flex items-center justify-center overflow-hidden';
      regionElement.style.left = `${leftPosition}%`;
      regionElement.style.width = `${widthPercentage}%`;
      regionElement.style.backgroundColor = type === 'image' ? 'rgba(14, 165, 233, 0.3)' : '#FFFFFF';
      regionElement.style.opacity = type === 'image' ? '1' : '0.5';
      regionElement.style.border = selectedItemIndex !== null && 
        timelineItems[selectedItemIndex]?.id === item.id ? '2px solid white' : '';
      regionElement.style.zIndex = selectedItemIndex !== null && 
        timelineItems[selectedItemIndex]?.id === item.id ? '2' : '1';
      
      if (type === 'image' && item.imageUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = item.imageUrl;
        thumbnail.className = 'h-full object-cover opacity-70';
        regionElement.appendChild(thumbnail);
      }
      
      const label = document.createElement('div');
      label.className = 'absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1 rounded';
      label.textContent = `${item.startTime.toFixed(1)}s - ${(item.startTime + item.duration).toFixed(1)}s`;
      regionElement.appendChild(label);
      
      if (type === 'flashlight' && item.pattern) {
        const intensityIndicator = document.createElement('div');
        intensityIndicator.className = 'absolute top-1 right-2 text-xs font-bold';
        intensityIndicator.textContent = `${item.pattern.intensity}%`;
        regionElement.appendChild(intensityIndicator);
      }
      
      // Add interactive handles
      const leftResizeHandle = createResizeHandle('left', regionElement, item, trackRef.current!, trackDuration, onUpdateItem);
      const rightResizeHandle = createResizeHandle('right', regionElement, item, trackRef.current!, trackDuration, onUpdateItem);
      const dragHandle = createDragHandle(regionElement, item, trackRef.current!, trackDuration, onUpdateItem, checkOverlap);
      
      regionElement.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = timelineItems.findIndex(i => i.id === item.id);
        onItemSelect(index);
      });
      
      // Append in correct order for z-index
      regionElement.appendChild(dragHandle);
      regionElement.appendChild(leftResizeHandle);
      regionElement.appendChild(rightResizeHandle);
      
      trackRef.current!.appendChild(regionElement);
    });
    
    return () => {
      if (trackRef.current) {
        while (trackRef.current.firstChild) {
          trackRef.current.removeChild(trackRef.current.firstChild);
        }
      }
    };
  }, [timelineItems, type, selectedItemIndex, trackDuration, onItemSelect, onUpdateItem, checkOverlap]);

  return (
    <>
      <div className="text-xs text-white/70 font-medium mb-1">{title}</div>
      <div className="relative h-16 bg-black/30 rounded-md">
        <div 
          ref={trackRef} 
          className="relative h-full cursor-pointer"
          onClick={() => onItemSelect(null)}
        ></div>
      </div>
    </>
  );
};

// Helper function to create resize handles
function createResizeHandle(
  side: 'left' | 'right', 
  regionElement: HTMLDivElement, 
  item: TimelineItem, 
  trackElement: HTMLDivElement, 
  trackDuration: number,
  onUpdateItem: (id: string, updates: Partial<TimelineItem>) => void
) {
  const resizeHandle = document.createElement('div');
  resizeHandle.className = `absolute ${side}-0 top-0 h-full w-4 cursor-ew-resize z-10`;
  
  const handleVisual = document.createElement('div');
  handleVisual.className = `absolute ${side}-0 top-0 h-full w-2 bg-white/30 flex items-center justify-center`;
  handleVisual.innerHTML = '<div class="w-1 h-full bg-white/50"></div>';
  resizeHandle.appendChild(handleVisual);
  
  let isResizing = false;
  let startX = 0;
  let startLeft = 0;
  let startWidth = 0;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startLeft = parseFloat(regionElement.style.left);
    startWidth = regionElement.offsetWidth;
    
    document.body.style.cursor = 'ew-resize';
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing) return;
      
      moveEvent.preventDefault();
      const trackWidth = trackElement.clientWidth;
      
      if (side === 'left') {
        const dx = moveEvent.clientX - startX;
        const newLeft = Math.max(0, startLeft + (dx / trackWidth * 100));
        const newWidth = Math.max(5, startWidth - dx);
        
        const percentWidth = (newWidth / trackWidth) * 100;
        const maxLeft = 100 - percentWidth;
        
        if (newLeft <= maxLeft) {
          const newStartTime = (newLeft / 100) * trackDuration;
          const newDuration = (percentWidth / 100) * trackDuration;
          
          regionElement.style.left = `${newLeft}%`;
          regionElement.style.width = `${percentWidth}%`;
          
          // Update label
          const label = regionElement.querySelector('.absolute.bottom-1.left-2');
          if (label) {
            label.textContent = `${newStartTime.toFixed(1)}s - ${(newStartTime + newDuration).toFixed(1)}s`;
          }
          
          onUpdateItem(item.id, { 
            startTime: newStartTime,
            duration: newDuration 
          });
        }
      } else { // right handle
        const dx = moveEvent.clientX - startX;
        const newWidth = Math.max(5, startWidth + dx);
        const percentWidth = (newWidth / trackWidth) * 100;
        
        const currentLeft = parseFloat(regionElement.style.left);
        const maxWidth = (100 - currentLeft);
        
        if (percentWidth <= maxWidth) {
          const newDuration = (percentWidth / 100) * trackDuration;
          
          regionElement.style.width = `${percentWidth}%`;
          
          // Update label
          const label = regionElement.querySelector('.absolute.bottom-1.left-2');
          if (label) {
            label.textContent = `${item.startTime.toFixed(1)}s - ${(item.startTime + newDuration).toFixed(1)}s`;
          }
          
          onUpdateItem(item.id, { duration: newDuration });
        }
      }
    };
    
    const handleMouseUp = () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
  
  return resizeHandle;
}

// Helper function to create drag handle
function createDragHandle(
  regionElement: HTMLDivElement, 
  item: TimelineItem, 
  trackElement: HTMLDivElement, 
  trackDuration: number,
  onUpdateItem: (id: string, updates: Partial<TimelineItem>) => void,
  checkOverlap?: (itemId: string, startTime: number, duration: number) => boolean
) {
  const dragHandle = document.createElement('div');
  dragHandle.className = 'absolute inset-0 cursor-grab';
  dragHandle.innerHTML = '<div class="absolute top-2 right-1/2 transform translate-x-1/2 opacity-50"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v2m0 0v2m0-2h6m0 0V3m0 2v2"></path><path d="M9 17v2m0 0v2m0-2h6m0 0v-2m0 2v2"></path><path d="M5 7v10M19 7v10"></path></svg></div>';
  
  let isDragging = false;
  let startX = 0;
  let startLeft = 0;
  
  dragHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    
    isDragging = true;
    startX = e.clientX;
    startLeft = parseFloat(regionElement.style.left);
    
    dragHandle.style.cursor = 'grabbing';
    document.body.style.cursor = 'grabbing';
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      
      moveEvent.preventDefault();
      
      const trackWidth = trackElement.clientWidth;
      const dx = moveEvent.clientX - startX;
      const percentDx = (dx / trackWidth) * 100;
      const newLeft = Math.max(0, Math.min(100 - parseFloat(regionElement.style.width), startLeft + percentDx));
      
      const newStartTime = (newLeft / 100) * trackDuration;
      
      // Check for overlap only for image items if checkOverlap function is provided
      if (item.type === 'image' && checkOverlap && checkOverlap(item.id, newStartTime, item.duration)) {
        return; // Skip updating if there's overlap
      }
      
      regionElement.style.left = `${newLeft}%`;
      
      // Update label
      const label = regionElement.querySelector('.absolute.bottom-1.left-2');
      if (label) {
        label.textContent = `${newStartTime.toFixed(1)}s - ${(newStartTime + item.duration).toFixed(1)}s`;
      }
      
      onUpdateItem(item.id, { startTime: newStartTime });
    };
    
    const handleMouseUp = () => {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
  
  return dragHandle;
}

export default TimelineItemsTrack;
