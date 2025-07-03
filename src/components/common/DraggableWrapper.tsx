
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface DraggableWrapperProps {
  children: React.ReactNode;
  bounds?: 'parent' | { left: number; right: number; top: number; bottom: number };
  position: { x: number; y: number };
  onStart?: () => void;
  onStop?: (e: MouseEvent, data: { x: number; y: number }) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const DraggableWrapper: React.FC<DraggableWrapperProps> = ({
  children,
  bounds = 'parent',
  position,
  onStart,
  onStop,
  disabled = false,
  className = '',
  style = {}
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, elementX: 0, elementY: 0 });

  const getBounds = useCallback(() => {
    if (!elementRef.current || bounds !== 'parent') {
      return bounds === 'parent' ? { left: 0, right: 0, top: 0, bottom: 0 } : bounds;
    }

    const parent = elementRef.current.parentElement;
    if (!parent) return { left: 0, right: 0, top: 0, bottom: 0 };

    const parentRect = parent.getBoundingClientRect();
    const elementRect = elementRef.current.getBoundingClientRect();

    return {
      left: 0,
      top: 0,
      right: parentRect.width - elementRect.width,
      bottom: parentRect.height - elementRect.height
    };
  }, [bounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elementX: position.x,
      elementY: position.y
    });
    
    if (onStart) {
      onStart();
    }
  }, [disabled, position, onStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    let newX = dragStart.elementX + deltaX;
    let newY = dragStart.elementY + deltaY;

    // Apply bounds
    const currentBounds = getBounds();
    if (typeof currentBounds === 'object') {
      newX = Math.max(currentBounds.left, Math.min(newX, currentBounds.right));
      newY = Math.max(currentBounds.top, Math.min(newY, currentBounds.bottom));
    }

    // Update position through callback
    if (onStop) {
      onStop(e, { x: newX, y: newY });
    }
  }, [isDragging, dragStart, getBounds, onStop]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    let newX = dragStart.elementX + deltaX;
    let newY = dragStart.elementY + deltaY;

    // Apply bounds
    const currentBounds = getBounds();
    if (typeof currentBounds === 'object') {
      newX = Math.max(currentBounds.left, Math.min(newX, currentBounds.right));
      newY = Math.max(currentBounds.top, Math.min(newY, currentBounds.bottom));
    }

    if (onStop) {
      onStop(e, { x: newX, y: newY });
    }
  }, [isDragging, dragStart, getBounds, onStop]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        ...style
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default DraggableWrapper;
