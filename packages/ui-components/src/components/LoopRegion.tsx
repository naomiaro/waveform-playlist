import React, { useCallback, useRef, useState } from 'react';
import styled from 'styled-components';

// Draggable marker handle for timescale area
interface DraggableMarkerHandleProps {
  readonly $left: number;
  readonly $color: string;
  readonly $isStart: boolean;
  readonly $isDragging?: boolean;
}

const DraggableMarkerHandle = styled.div.attrs<DraggableMarkerHandleProps>((props) => ({
  style: {
    left: `${props.$left}px`,
  },
}))<DraggableMarkerHandleProps>`
  position: absolute;
  top: 0;
  width: 12px;
  height: 100%;
  cursor: ew-resize;
  z-index: 100;
  /* Center the handle on the marker position */
  transform: translateX(-5px);

  /* Visual marker line */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 5px;
    width: 2px;
    height: 100%;
    background: ${(props) => props.$color};
    opacity: ${(props) => (props.$isDragging ? 1 : 0.8)};
  }

  /* Triangle marker at top */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    ${(props) => (props.$isStart ? 'left: 5px' : 'left: -1px')};
    width: 0;
    height: 0;
    border-top: 10px solid ${(props) => props.$color};
    ${(props) =>
      props.$isStart
        ? 'border-right: 10px solid transparent;'
        : 'border-left: 10px solid transparent;'}
  }

  &:hover::before {
    opacity: 1;
  }
`;

// Background shading in timescale - draggable to move entire region
interface TimescaleLoopShadeProps {
  readonly $left: number;
  readonly $width: number;
  readonly $color: string;
  readonly $isDragging?: boolean;
}

const TimescaleLoopShade = styled.div.attrs<TimescaleLoopShadeProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<TimescaleLoopShadeProps>`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${(props) => props.$color};
  z-index: 50;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

export interface LoopRegionMarkersProps {
  startPosition: number; // Start position in pixels
  endPosition: number; // End position in pixels
  markerColor?: string;
  regionColor?: string;
  onLoopStartChange?: (newPositionPixels: number) => void;
  onLoopEndChange?: (newPositionPixels: number) => void;
  /** Called when the entire region is moved */
  onLoopRegionMove?: (newStartPixels: number, newEndPixels: number) => void;
  /** Minimum position in pixels (usually controls width offset) */
  minPosition?: number;
  /** Maximum position in pixels */
  maxPosition?: number;
}

/**
 * Draggable loop region markers for the timescale area.
 * These are interactive and can be dragged to adjust loop boundaries.
 * The shaded region between markers can be dragged to move the entire loop.
 */
export const LoopRegionMarkers: React.FC<LoopRegionMarkersProps> = ({
  startPosition,
  endPosition,
  markerColor = '#3b82f6',
  regionColor = 'rgba(59, 130, 246, 0.3)',
  onLoopStartChange,
  onLoopEndChange,
  onLoopRegionMove,
  minPosition = 0,
  maxPosition = Infinity,
}) => {
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | 'region' | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartPosition = useRef<number>(0);
  const dragStartEnd = useRef<number>(0);

  const width = Math.max(0, endPosition - startPosition);

  // Handle dragging individual markers
  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, marker: 'start' | 'end') => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingMarker(marker);
      dragStartX.current = e.clientX;
      dragStartPosition.current = marker === 'start' ? startPosition : endPosition;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - dragStartX.current;
        const newPosition = dragStartPosition.current + delta;

        if (marker === 'start') {
          // Start marker can't go past end marker or outside bounds
          const clampedPosition = Math.max(minPosition, Math.min(endPosition - 10, newPosition));
          onLoopStartChange?.(clampedPosition);
        } else {
          // End marker can't go before start marker or outside bounds
          const clampedPosition = Math.max(startPosition + 10, Math.min(maxPosition, newPosition));
          onLoopEndChange?.(clampedPosition);
        }
      };

      const handleMouseUp = () => {
        setDraggingMarker(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [startPosition, endPosition, minPosition, maxPosition, onLoopStartChange, onLoopEndChange]
  );

  // Handle dragging the entire region
  const handleRegionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingMarker('region');
      dragStartX.current = e.clientX;
      dragStartPosition.current = startPosition;
      dragStartEnd.current = endPosition;

      const regionWidth = endPosition - startPosition;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - dragStartX.current;
        let newStart = dragStartPosition.current + delta;
        let newEnd = dragStartEnd.current + delta;

        // Clamp to bounds while maintaining region width
        if (newStart < minPosition) {
          newStart = minPosition;
          newEnd = minPosition + regionWidth;
        }
        if (newEnd > maxPosition) {
          newEnd = maxPosition;
          newStart = maxPosition - regionWidth;
        }

        onLoopRegionMove?.(newStart, newEnd);
      };

      const handleMouseUp = () => {
        setDraggingMarker(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [startPosition, endPosition, minPosition, maxPosition, onLoopRegionMove]
  );

  if (width <= 0) {
    return null;
  }

  return (
    <>
      <TimescaleLoopShade
        $left={startPosition}
        $width={width}
        $color={regionColor}
        $isDragging={draggingMarker === 'region'}
        onMouseDown={handleRegionMouseDown}
        data-loop-region-timescale
      />
      <DraggableMarkerHandle
        $left={startPosition}
        $color={markerColor}
        $isStart={true}
        $isDragging={draggingMarker === 'start'}
        onMouseDown={(e) => handleMarkerMouseDown(e, 'start')}
        data-loop-marker-handle="start"
      />
      <DraggableMarkerHandle
        $left={endPosition}
        $color={markerColor}
        $isStart={false}
        $isDragging={draggingMarker === 'end'}
        onMouseDown={(e) => handleMarkerMouseDown(e, 'end')}
        data-loop-marker-handle="end"
      />
    </>
  );
};

// Click-to-create wrapper for timescale area
const TimescaleLoopCreator = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%; /* Stay within timescale bounds, don't extend into tracks */
  cursor: crosshair;
  z-index: 40; /* Below markers and shading */
`;

export interface TimescaleLoopRegionProps {
  /** Current loop start position in pixels */
  startPosition: number;
  /** Current loop end position in pixels */
  endPosition: number;
  markerColor?: string;
  regionColor?: string;
  /** Called when loop region changes (start pixels, end pixels) */
  onLoopRegionChange?: (startPixels: number, endPixels: number) => void;
  /** Minimum position in pixels */
  minPosition?: number;
  /** Maximum position in pixels */
  maxPosition?: number;
}

/**
 * Complete timescale loop region component with:
 * - Click and drag to create a new loop region
 * - Drag markers to resize existing loop region
 * - Drag the shaded region to move the entire loop
 */
export const TimescaleLoopRegion: React.FC<TimescaleLoopRegionProps> = ({
  startPosition,
  endPosition,
  markerColor = '#3b82f6',
  regionColor = 'rgba(59, 130, 246, 0.3)',
  onLoopRegionChange,
  minPosition = 0,
  maxPosition = Infinity,
}) => {
  const [, setIsCreating] = useState(false);
  const createStartX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasLoopRegion = endPosition > startPosition;

  // Handle creating a new loop region by clicking and dragging
  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only create new region if clicking on the background (not on markers or region)
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-loop-marker-handle]') ||
        target.closest('[data-loop-region-timescale]')
      ) {
        return;
      }

      e.preventDefault();
      setIsCreating(true);

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = e.clientX - rect.left;
      const clampedX = Math.max(minPosition, Math.min(maxPosition, clickX));
      createStartX.current = clampedX;

      // Set initial position (will be a point until dragged)
      onLoopRegionChange?.(clampedX, clampedX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX - rect.left;
        const clampedCurrentX = Math.max(minPosition, Math.min(maxPosition, currentX));

        const newStart = Math.min(createStartX.current, clampedCurrentX);
        const newEnd = Math.max(createStartX.current, clampedCurrentX);

        onLoopRegionChange?.(newStart, newEnd);
      };

      const handleMouseUp = () => {
        setIsCreating(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [minPosition, maxPosition, onLoopRegionChange]
  );

  return (
    <TimescaleLoopCreator
      ref={containerRef}
      onMouseDown={handleBackgroundMouseDown}
      data-timescale-loop-creator
    >
      {hasLoopRegion && (
        <LoopRegionMarkers
          startPosition={startPosition}
          endPosition={endPosition}
          markerColor={markerColor}
          regionColor={regionColor}
          minPosition={minPosition}
          maxPosition={maxPosition}
          onLoopStartChange={(newStart) => onLoopRegionChange?.(newStart, endPosition)}
          onLoopEndChange={(newEnd) => onLoopRegionChange?.(startPosition, newEnd)}
          onLoopRegionMove={(newStart, newEnd) => onLoopRegionChange?.(newStart, newEnd)}
        />
      )}
    </TimescaleLoopCreator>
  );
};
