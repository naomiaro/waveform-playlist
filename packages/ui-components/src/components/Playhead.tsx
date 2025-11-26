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
  /** Position in pixels from left edge (only valid when not playing) */
  position: number;
  /** Playhead color (default: #ff0000) */
  color?: string;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Ref to current time in seconds - use for smooth animation during playback */
  currentTimeRef: React.RefObject<number>;
  /** Audio context start time when playback began - for calculating elapsed time */
  playbackStartTimeRef: React.RefObject<number>;
  /** Audio position when playback started - for calculating current position */
  audioStartPositionRef: React.RefObject<number>;
  /** Samples per pixel - for converting time to pixels */
  samplesPerPixel: number;
  /** Sample rate - for converting time to pixels */
  sampleRate: number;
  /** Controls offset in pixels */
  controlsOffset: number;
}

/**
 * Type for custom playhead render functions.
 * Receives position, color, and animation refs for smooth 60fps animation.
 * Custom playheads should use requestAnimationFrame with the refs during playback.
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
