import React, { useRef, useEffect } from 'react';
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
  z-index: 100; /* Below sticky controls (z-index: 101) so playhead is hidden when scrolled behind controls */
  pointer-events: none;
  will-change: transform;
`;

/**
 * Props passed to the default playhead component or custom render function.
 * The same seven under `WaveformPlaylistProvider` and
 * `MediaElementPlaylistProvider`. Engine values (`getPlaybackTime`,
 * `getAudioContextTime`, `playbackStartTimeRef`, `audioStartPositionRef`) are
 * not props: a playhead for `WaveformPlaylistProvider` that needs them calls
 * `useEngineRefs()` from `@waveform-playlist/browser`.
 */
export interface PlayheadProps {
  /** Position in pixels from left edge (only valid when not playing) */
  position: number;
  /** Playhead color (default: #ff0000) */
  color?: string;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /**
   * Ref to the raw playback position in seconds. Use `visualTimeRef` to place
   * a playhead; this one is for logic that needs the scheduling position.
   */
  currentTimeRef: React.RefObject<number>;
  /**
   * Ref to the time a playhead should be drawn at, in seconds. Under
   * `WaveformPlaylistProvider`, while playing, it is the audible time (raw
   * minus output latency and look-ahead), and at rest the commanded position
   * (seek, pause, stop). Under `MediaElementPlaylistProvider` it is the same
   * ref as `currentTimeRef`. The provider keeps it current on every frame of
   * playback, so a playhead that reads it stays in step with the progress fill.
   */
  visualTimeRef: React.RefObject<number>;
  /** Samples per pixel - for converting time to pixels */
  samplesPerPixel: number;
  /** Sample rate - for converting time to pixels */
  sampleRate: number;
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

const PlayheadWithMarkerContainer = styled.div<{ $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 100; /* Below sticky controls (z-index: 101) so playhead is hidden when scrolled behind controls */
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
 * Uses requestAnimationFrame for smooth 60fps animation during playback.
 */
export const PlayheadWithMarker: React.FC<PlayheadProps> = ({
  color = '#ff0000',
  isPlaying,
  currentTimeRef,
  visualTimeRef,
  samplesPerPixel,
  sampleRate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        // visualTimeRef is what the listener hears, and what the progress fill
        // is drawn from: the provider updates it on every frame of playback and
        // on pause, seek and stop.
        const time = visualTimeRef.current ?? currentTimeRef.current ?? 0;
        const pos = (time * sampleRate) / samplesPerPixel;
        containerRef.current.style.transform = `translate3d(${pos}px, 0, 0)`;
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    } else {
      updatePosition();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, sampleRate, samplesPerPixel, currentTimeRef, visualTimeRef]);

  // Update position when stopped (for seeks)
  useEffect(() => {
    if (!isPlaying && containerRef.current) {
      const time = visualTimeRef.current ?? currentTimeRef.current ?? 0;
      const pos = (time * sampleRate) / samplesPerPixel;
      containerRef.current.style.transform = `translate3d(${pos}px, 0, 0)`;
    }
  });

  return (
    <PlayheadWithMarkerContainer ref={containerRef} $color={color}>
      <MarkerTriangle $color={color} />
      <MarkerLine $color={color} />
    </PlayheadWithMarkerContainer>
  );
};
