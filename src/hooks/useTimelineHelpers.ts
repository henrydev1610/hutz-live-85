
import { TimelineItem } from '@/types/lightshow';

export function useTimelineHelpers() {
  // Helper function to detect overlapping image items
  const checkImageOverlap = (
    itemId: string, 
    startTime: number, 
    duration: number, 
    timelineItems: TimelineItem[]
  ) => {
    // Only check for images
    const images = timelineItems.filter(item => item.type === 'image' && item.id !== itemId);
    
    for (const image of images) {
      const imageEnd = image.startTime + image.duration;
      const newItemEnd = startTime + duration;
      
      // Check if there's any overlap
      if ((startTime >= image.startTime && startTime < imageEnd) || 
          (newItemEnd > image.startTime && newItemEnd <= imageEnd) ||
          (startTime <= image.startTime && newItemEnd >= imageEnd)) {
        return true;
      }
    }
    
    return false;
  };

  return {
    checkImageOverlap
  };
}
