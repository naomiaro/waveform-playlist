import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export const CLIP_HEADER_HEIGHT = 22; // Height of the clip header in pixels

interface HeaderContainerProps {
  readonly $isDragging?: boolean;
  readonly $backgroundColor?: string;
  readonly $borderColor?: string;
  readonly $interactive?: boolean; // Whether it's draggable or just presentational
}

const HeaderContainer = styled.div<HeaderContainerProps>`
  position: relative;
  height: ${CLIP_HEADER_HEIGHT}px;
  background: ${props => props.$backgroundColor || 'rgba(0, 0, 0, 0.1)'};
  border-bottom: 1px solid ${props => props.$borderColor || 'rgba(0, 0, 0, 0.2)'};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${props => props.$interactive ? (props.$isDragging ? 'grabbing' : 'grab') : 'default'};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;

  ${props => props.$interactive && `
    &:hover {
      background: ${props.$backgroundColor ? `${props.$backgroundColor}dd` : 'rgba(0, 0, 0, 0.15)'};
    }

    &:active {
      cursor: grabbing;
    }
  `}
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

// Presentational-only header (no drag behavior)
export interface ClipHeaderPresentationalProps {
  trackName: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

export const ClipHeaderPresentational: FunctionComponent<ClipHeaderPresentationalProps> = ({
  trackName,
  backgroundColor,
  borderColor,
  textColor,
}) => {
  return (
    <HeaderContainer
      $isDragging={false}
      $backgroundColor={backgroundColor}
      $borderColor={borderColor}
      $interactive={false}
    >
      <TrackName $textColor={textColor}>{trackName}</TrackName>
    </HeaderContainer>
  );
};

export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}

export interface ClipHeaderProps {
  clipId: string;
  trackIndex: number;
  clipIndex: number;
  trackName: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  disableDrag?: boolean; // Disable drag behavior (for presentation-only rendering in overlays)
  dragHandleProps?: DragHandleProps; // Props for drag handle functionality
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
  disableDrag = false,
  dragHandleProps,
}) => {
  // Use purely presentational version when drag is disabled or no drag handle props
  if (disableDrag || !dragHandleProps) {
    return (
      <ClipHeaderPresentational
        trackName={trackName}
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        textColor={textColor}
      />
    );
  }

  const { attributes, listeners, setActivatorNodeRef } = dragHandleProps;

  return (
    <HeaderContainer
      ref={setActivatorNodeRef}
      data-clip-id={clipId}
      $backgroundColor={backgroundColor}
      $borderColor={borderColor}
      $interactive={true}
      {...listeners}
      {...attributes}
    >
      <TrackName $textColor={textColor}>{trackName}</TrackName>
    </HeaderContainer>
  );
};
