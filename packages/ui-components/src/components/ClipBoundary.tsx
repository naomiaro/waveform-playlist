import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

export const CLIP_BOUNDARY_WIDTH = 8; // Width of the draggable boundary in pixels
export const CLIP_BOUNDARY_WIDTH_TOUCH = 24; // Larger touch target for mobile (minimum 44px recommended, but 24px works well for trim handles)

type BoundaryEdge = 'left' | 'right';

interface BoundaryContainerProps {
  readonly $edge: BoundaryEdge;
  readonly $isDragging?: boolean;
  readonly $isHovered?: boolean;
  readonly $touchOptimized?: boolean;
}

const BoundaryContainer = styled.div<BoundaryContainerProps>`
  position: absolute;
  ${(props) => (props.$edge === 'left' ? 'left: 0;' : 'right: 0;')}
  top: 0;
  bottom: 0;
  width: ${(props) => (props.$touchOptimized ? CLIP_BOUNDARY_WIDTH_TOUCH : CLIP_BOUNDARY_WIDTH)}px;
  cursor: col-resize;
  user-select: none;
  z-index: 105; /* Above waveform, below header */
  pointer-events: auto; /* Re-enable pointer events (parent ClipContainer has pointer-events: none) */
  touch-action: none; /* Prevent browser scroll during drag on touch devices */

  /* Invisible by default, visible on hover */
  background: ${(props) =>
    props.$isDragging
      ? 'rgba(255, 255, 255, 0.4)'
      : props.$isHovered
        ? 'rgba(255, 255, 255, 0.2)'
        : 'transparent'};

  ${(props) =>
    props.$edge === 'left'
      ? `border-left: 2px solid ${
          props.$isDragging
            ? 'rgba(255, 255, 255, 0.8)'
            : props.$isHovered
              ? 'rgba(255, 255, 255, 0.5)'
              : 'transparent'
        };`
      : `border-right: 2px solid ${
          props.$isDragging
            ? 'rgba(255, 255, 255, 0.8)'
            : props.$isHovered
              ? 'rgba(255, 255, 255, 0.5)'
              : 'transparent'
        };`}

  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    ${(props) =>
      props.$edge === 'left'
        ? 'border-left: 2px solid rgba(255, 255, 255, 0.5);'
        : 'border-right: 2px solid rgba(255, 255, 255, 0.5);'}
  }

  &:active {
    background: rgba(255, 255, 255, 0.4);
    ${(props) =>
      props.$edge === 'left'
        ? 'border-left: 2px solid rgba(255, 255, 255, 0.8);'
        : 'border-right: 2px solid rgba(255, 255, 255, 0.8);'}
  }
`;

interface BoundaryDragHandleProps {
  ref: (element: Element | null) => void;
  isDragging?: boolean;
}

export interface ClipBoundaryProps {
  clipId: string;
  trackIndex: number;
  clipIndex: number;
  edge: BoundaryEdge;
  dragHandleProps?: BoundaryDragHandleProps;
  /**
   * Enable larger touch targets for mobile devices.
   * When true, boundary width increases from 8px to 24px for easier touch targeting.
   */
  touchOptimized?: boolean;
}

/**
 * ClipBoundary component - Draggable edge for trimming clips
 *
 * Renders at the left or right edge of a clip.
 * Drag to trim the clip (adjust offset and duration).
 * Supports bidirectional trimming (trim in and out).
 *
 * On mobile (touchOptimized=true), boundaries are wider for easier targeting.
 */
export const ClipBoundary: FunctionComponent<ClipBoundaryProps> = ({
  clipId,
  trackIndex: _trackIndex,
  clipIndex: _clipIndex,
  edge,
  dragHandleProps,
  touchOptimized = false,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  if (!dragHandleProps) {
    // No drag handle props provided, render non-interactive boundary
    return null;
  }

  const { ref: boundaryRef, isDragging } = dragHandleProps;

  return (
    <BoundaryContainer
      ref={boundaryRef}
      data-clip-id={clipId}
      data-boundary-edge={edge}
      $edge={edge}
      $isDragging={isDragging}
      $isHovered={isHovered}
      $touchOptimized={touchOptimized}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
};
