import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export const CLIP_HEADER_HEIGHT = 22; // Height of the clip header in pixels

interface HeaderContainerProps {
  readonly $isDragging?: boolean;
  readonly $interactive?: boolean; // Whether it's draggable or just presentational
  readonly $isSelected?: boolean; // Whether the track is selected
}

const HeaderContainer = styled.div<HeaderContainerProps>`
  position: relative;
  height: ${CLIP_HEADER_HEIGHT}px;
  background: ${props => props.$isSelected
    ? props.theme.selectedClipHeaderBackgroundColor
    : props.theme.clipHeaderBackgroundColor};
  border-bottom: 1px solid ${props => props.theme.clipHeaderBorderColor};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${props => props.$interactive ? (props.$isDragging ? 'grabbing' : 'grab') : 'default'};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;
  pointer-events: auto; /* Re-enable pointer events (parent ClipContainer has pointer-events: none) */

  ${props => props.$interactive && `
    &:hover {
      background: ${props.theme.clipHeaderBackgroundColor}dd;
    }

    &:active {
      cursor: grabbing;
    }
  `}
`;

const TrackName = styled.span`
  font-size: 11px;
  font-weight: 600;
  font-family: ${props => props.theme.clipHeaderFontFamily};
  color: ${props => props.theme.clipHeaderTextColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// Presentational-only header (no drag behavior)
export interface ClipHeaderPresentationalProps {
  trackName: string;
  isSelected?: boolean; // Whether the track is selected
}

export const ClipHeaderPresentational: FunctionComponent<ClipHeaderPresentationalProps> = ({
  trackName,
  isSelected = false,
}) => {
  return (
    <HeaderContainer
      $isDragging={false}
      $interactive={false}
      $isSelected={isSelected}
    >
      <TrackName>{trackName}</TrackName>
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
  isSelected?: boolean; // Whether the track is selected
  disableDrag?: boolean; // Disable drag behavior (for presentation-only rendering in overlays)
  dragHandleProps?: DragHandleProps; // Props for drag handle functionality
}

/**
 * ClipHeader component - Draggable title bar for audio clips
 *
 * Renders at the top of each clip (above all channels).
 * Drag the header to move the clip along the timeline.
 * Shows the track name (not clip-specific info).
 *
 * Theme colors (from useTheme):
 * - clipHeaderBackgroundColor / selectedClipHeaderBackgroundColor
 * - clipHeaderBorderColor
 * - clipHeaderTextColor
 */
export const ClipHeader: FunctionComponent<ClipHeaderProps> = ({
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  isSelected = false,
  disableDrag = false,
  dragHandleProps,
}) => {
  // Use purely presentational version when drag is disabled or no drag handle props
  if (disableDrag || !dragHandleProps) {
    return (
      <ClipHeaderPresentational
        trackName={trackName}
        isSelected={isSelected}
      />
    );
  }

  const { attributes, listeners, setActivatorNodeRef } = dragHandleProps;

  return (
    <HeaderContainer
      ref={setActivatorNodeRef}
      data-clip-id={clipId}
      $interactive={true}
      $isSelected={isSelected}
      {...listeners}
      {...attributes}
    >
      <TrackName>{trackName}</TrackName>
    </HeaderContainer>
  );
};
