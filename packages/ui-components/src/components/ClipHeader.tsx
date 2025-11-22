import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface HeaderContainerProps {
  readonly $isDragging: boolean;
  readonly $backgroundColor?: string;
  readonly $borderColor?: string;
}

const HeaderContainer = styled.div<HeaderContainerProps>`
  position: relative;
  height: 22px;
  background: ${props => props.$backgroundColor || 'rgba(0, 0, 0, 0.1)'};
  border-bottom: 1px solid ${props => props.$borderColor || 'rgba(0, 0, 0, 0.2)'};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${props => props.$isDragging ? 'grabbing' : 'grab'};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$backgroundColor ? `${props.$backgroundColor}dd` : 'rgba(0, 0, 0, 0.15)'};
  }

  &:active {
    cursor: grabbing;
  }
`;

interface TrackNameProps {
  readonly $textColor?: string;
}

const TrackName = styled.span<TrackNameProps>`
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.$textColor || '#333'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export interface ClipHeaderProps {
  clipId: string;
  trackIndex: number;
  clipIndex: number;
  trackName: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

/**
 * ClipHeader component - Draggable title bar for audio clips
 *
 * Renders at the top of each clip (above all channels).
 * Drag the header to move the clip along the timeline.
 * Shows the track name (not clip-specific info).
 */
export const ClipHeader: FunctionComponent<ClipHeaderProps> = ({
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  backgroundColor,
  borderColor,
  textColor,
}) => {
  const id = `clip-${trackIndex}-${clipIndex}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { clipId, trackIndex, clipIndex },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <HeaderContainer
      ref={setNodeRef}
      style={style}
      $isDragging={isDragging}
      $backgroundColor={backgroundColor}
      $borderColor={borderColor}
      {...listeners}
      {...attributes}
    >
      <TrackName $textColor={textColor}>{trackName}</TrackName>
    </HeaderContainer>
  );
};
