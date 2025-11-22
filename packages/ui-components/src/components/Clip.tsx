import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ClipHeader, CLIP_HEADER_HEIGHT } from './ClipHeader';

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
  startTime: number; // Start time in seconds
  duration: number; // Duration in seconds
  sampleRate: number;
  samplesPerPixel: number;
  // Optional header (for multi-clip editing with drag-to-move)
  showHeader?: boolean;
  disableHeaderDrag?: boolean; // Disable drag on header (for presentation-only rendering)
  isOverlay?: boolean; // Rendering in DragOverlay (disables absolute positioning)
  // Theme props for header
  clipHeaderBackgroundColor?: string;
  clipHeaderBorderColor?: string;
  clipHeaderTextColor?: string;
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
  startTime,
  duration,
  sampleRate,
  samplesPerPixel,
  showHeader = false,
  disableHeaderDrag = false,
  isOverlay = false,
  clipHeaderBackgroundColor,
  clipHeaderBorderColor,
  clipHeaderTextColor,
}) => {
  // Calculate horizontal position based on start time
  const left = Math.floor((startTime * sampleRate) / samplesPerPixel);

  // Calculate width based on duration
  const width = Math.floor((duration * sampleRate) / samplesPerPixel);

  // Use draggable only if header is shown and drag is enabled
  const enableDrag = showHeader && !disableHeaderDrag && !isOverlay;

  const draggableId = `clip-${trackIndex}-${clipIndex}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { clipId, trackIndex, clipIndex },
    disabled: !enableDrag,
  });

  // Apply transform for dragging
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : undefined,
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
    >
      {showHeader && (
        <ClipHeader
          clipId={clipId}
          trackIndex={trackIndex}
          clipIndex={clipIndex}
          trackName={trackName}
          backgroundColor={clipHeaderBackgroundColor}
          borderColor={clipHeaderBorderColor}
          textColor={clipHeaderTextColor}
          disableDrag={disableHeaderDrag}
          dragHandleProps={enableDrag ? { attributes, listeners, setActivatorNodeRef } : undefined}
        />
      )}
      <ChannelsWrapper $isOverlay={isOverlay}>
        {children}
      </ChannelsWrapper>
    </ClipContainer>
  );
};
