import React from 'react';
import styled from 'styled-components';

interface PlayheadLineProps {
  readonly $position: number;
  readonly $color: string;
}

const PlayheadLine = styled.div.attrs<PlayheadLineProps>((props) => ({
  style: {
    transform: `translate3d(${props.$position}px, 0, 0)`,
  },
}))<PlayheadLineProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`;

/**
 * Props passed to the default playhead component or custom render function.
 */
export interface PlayheadProps {
  /** Position in pixels from left edge */
  position: number;
  /** Playhead color (default: #ff0000) */
  color?: string;
}

/**
 * Type for custom playhead render functions.
 * Receives position and color, should return a positioned element.
 */
export type RenderPlayheadFunction = (props: PlayheadProps) => React.ReactNode;

/**
 * Default playhead component - a simple vertical line.
 * Uses GPU-accelerated transform for smooth animation.
 */
export const Playhead: React.FC<PlayheadProps> = ({ position, color = '#ff0000' }) => {
  return <PlayheadLine $position={position} $color={color} />;
};

// === Custom Playhead Variants ===

const PlayheadWithMarkerContainer = styled.div.attrs<PlayheadLineProps>((props) => ({
  style: {
    transform: `translate3d(${props.$position}px, 0, 0)`,
  },
}))<PlayheadLineProps>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`;

const MarkerTriangle = styled.div<{ $color: string }>`
  position: absolute;
  top: -10px;
  left: -6px;
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 10px solid ${(props) => props.$color};
`;

const MarkerLine = styled.div<{ $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: ${(props) => props.$color};
`;

/**
 * Playhead with a triangle marker at the top.
 * Provides better visual indication of the current position.
 */
export const PlayheadWithMarker: React.FC<PlayheadProps> = ({ position, color = '#ff0000' }) => {
  return (
    <PlayheadWithMarkerContainer $position={position} $color={color}>
      <MarkerTriangle $color={color} />
      <MarkerLine $color={color} />
    </PlayheadWithMarkerContainer>
  );
};
