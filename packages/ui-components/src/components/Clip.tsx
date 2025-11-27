import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ClipHeader, CLIP_HEADER_HEIGHT } from './ClipHeader';
import { ClipBoundary, CLIP_BOUNDARY_WIDTH } from './ClipBoundary';
import { FadeOverlay } from './FadeOverlay';
import type { Fade } from '@waveform-playlist/core';

interface ClipContainerProps {
  readonly $left?: number; // Horizontal position in pixels (optional for DragOverlay)
  readonly $width?: number; // Width in pixels (optional for DragOverlay)
  readonly $isOverlay?: boolean; // Whether this is rendering in DragOverlay
  readonly $isDragging?: boolean; // Whether this clip is being dragged
}

const ClipContainer = styled.div.attrs<ClipContainerProps>((props) => ({
  style: props.$isOverlay ? {} : {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<ClipContainerProps>`
  position: ${props => props.$isOverlay ? 'relative' : 'absolute'};
  top: 0;
  height: ${props => props.$isOverlay ? 'auto' : '100%'};
  width: ${props => props.$isOverlay ? `${props.$width}px` : 'auto'};
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  z-index: 10; /* Above progress overlay (z-index: 2) but below controls/playhead */
  pointer-events: none; /* Let clicks pass through to ClickOverlay for playhead positioning */

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

interface ChannelsWrapperProps {
  readonly $isOverlay?: boolean;
}

const ChannelsWrapper = styled.div<ChannelsWrapperProps>`
  flex: 1;
  position: relative;
  overflow: ${props => props.$isOverlay ? 'visible' : 'hidden'};
`;

export interface ClipProps {
  className?: string;
  children?: ReactNode;
  clipId: string; // Unique clip ID
  trackIndex: number; // Track index (for drag operations)
  clipIndex: number; // Clip index within track (for drag operations)
  trackName: string; // Track name (shown in header)
  startSample: number; // Start position in samples
  durationSamples: number; // Duration in samples
  samplesPerPixel: number;
  // Optional header (for multi-clip editing with drag-to-move)
  showHeader?: boolean;
  disableHeaderDrag?: boolean; // Disable drag on header (for presentation-only rendering)
  isOverlay?: boolean; // Rendering in DragOverlay (disables absolute positioning)
  // Track selection
  isSelected?: boolean; // Whether the track is selected
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void; // Called when clip is pressed (for track selection - fires before drag)
  trackId?: string; // Track ID for identifying which track this clip belongs to
  // Fade configuration
  fadeIn?: Fade; // Fade in effect
  fadeOut?: Fade; // Fade out effect
  sampleRate?: number; // Sample rate for converting fade duration to pixels
  showFades?: boolean; // Show fade in/out overlays
}

/**
 * Clip component for rendering individual audio clips within a track
 *
 * Each clip is positioned based on its startTime and has a width based on its duration.
 * This allows multiple clips to be arranged on a single track with gaps or overlaps.
 *
 * Includes a draggable ClipHeader at the top for repositioning clips on the timeline.
 */
export const Clip: FunctionComponent<ClipProps> = ({
  children,
  className,
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  startSample,
  durationSamples,
  samplesPerPixel,
  showHeader = false,
  disableHeaderDrag = false,
  isOverlay = false,
  isSelected = false,
  onMouseDown,
  trackId,
  fadeIn,
  fadeOut,
  sampleRate = 44100,
  showFades = false,
}) => {
  // Calculate horizontal position based on start sample
  // Use Math.floor to always snap to pixel boundaries
  const left = Math.floor(startSample / samplesPerPixel);

  // Calculate width as the difference between end and start pixel positions
  // This ensures clips are perfectly adjacent with no gaps
  const endPixel = Math.floor((startSample + durationSamples) / samplesPerPixel);
  const width = endPixel - left;

  // Use draggable only if header is shown and drag is enabled
  const enableDrag = showHeader && !disableHeaderDrag && !isOverlay;

  // Main clip draggable (for moving entire clip)
  const draggableId = `clip-${trackIndex}-${clipIndex}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { clipId, trackIndex, clipIndex },
    disabled: !enableDrag,
  });

  // Left boundary draggable (for trimming start)
  const leftBoundaryId = `clip-boundary-left-${trackIndex}-${clipIndex}`;
  const {
    attributes: leftBoundaryAttributes,
    listeners: leftBoundaryListeners,
    setActivatorNodeRef: setLeftBoundaryActivatorRef,
    isDragging: isLeftBoundaryDragging,
  } = useDraggable({
    id: leftBoundaryId,
    data: { clipId, trackIndex, clipIndex, boundary: 'left' },
    disabled: !enableDrag,
  });

  // Right boundary draggable (for trimming end)
  const rightBoundaryId = `clip-boundary-right-${trackIndex}-${clipIndex}`;
  const {
    attributes: rightBoundaryAttributes,
    listeners: rightBoundaryListeners,
    setActivatorNodeRef: setRightBoundaryActivatorRef,
    isDragging: isRightBoundaryDragging,
  } = useDraggable({
    id: rightBoundaryId,
    data: { clipId, trackIndex, clipIndex, boundary: 'right' },
    disabled: !enableDrag,
  });

  // Apply transform for dragging
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : undefined, // Below controls (z-index: 999) but above other clips
  } : undefined;

  return (
    <ClipContainer
      ref={setNodeRef}
      style={style}
      className={className}
      $left={left}
      $width={width}
      $isOverlay={isOverlay}
      data-clip-container="true"
      data-track-id={trackId}
      onMouseDown={onMouseDown}
    >
      {showHeader && (
        <ClipHeader
          clipId={clipId}
          trackIndex={trackIndex}
          clipIndex={clipIndex}
          trackName={trackName}
          isSelected={isSelected}
          disableDrag={disableHeaderDrag}
          dragHandleProps={enableDrag ? { attributes, listeners, setActivatorNodeRef } : undefined}
        />
      )}
      <ChannelsWrapper $isOverlay={isOverlay}>
        {children}
        {/* Fade overlays */}
        {showFades && fadeIn && fadeIn.duration > 0 && (
          <FadeOverlay
            left={0}
            width={Math.floor((fadeIn.duration * sampleRate) / samplesPerPixel)}
            type="fadeIn"
            curveType={fadeIn.type}
          />
        )}
        {showFades && fadeOut && fadeOut.duration > 0 && (
          <FadeOverlay
            left={width - Math.floor((fadeOut.duration * sampleRate) / samplesPerPixel)}
            width={Math.floor((fadeOut.duration * sampleRate) / samplesPerPixel)}
            type="fadeOut"
            curveType={fadeOut.type}
          />
        )}
      </ChannelsWrapper>
      {/* Clip boundaries - outside ChannelsWrapper to avoid overflow:hidden clipping */}
      {showHeader && !disableHeaderDrag && !isOverlay && (
        <>
          <ClipBoundary
            clipId={clipId}
            trackIndex={trackIndex}
            clipIndex={clipIndex}
            edge="left"
            dragHandleProps={{
              attributes: leftBoundaryAttributes,
              listeners: leftBoundaryListeners,
              setActivatorNodeRef: setLeftBoundaryActivatorRef,
              isDragging: isLeftBoundaryDragging,
            }}
          />
          <ClipBoundary
            clipId={clipId}
            trackIndex={trackIndex}
            clipIndex={clipIndex}
            edge="right"
            dragHandleProps={{
              attributes: rightBoundaryAttributes,
              listeners: rightBoundaryListeners,
              setActivatorNodeRef: setRightBoundaryActivatorRef,
              isDragging: isRightBoundaryDragging,
            }}
          />
        </>
      )}
    </ClipContainer>
  );
};
