import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { usePlaybackAnimation, usePlaylistData } from '../WaveformPlaylistContext';

const PlayheadLine = styled.div.attrs<{ $color: string; $width: number }>((props) => ({
  style: {
    width: `${props.$width}px`,
    background: props.$color,
  },
}))<{ $color: string; $width: number }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 100; /* Below sticky controls (z-index: 101) so playhead is hidden when scrolled behind controls */
  pointer-events: none;
  will-change: transform;
`;

interface AnimatedPlayheadProps {
  color?: string;
  controlsOffset?: number;
}

/**
 * Animated playhead that updates position via direct DOM manipulation.
 * Reads playback time from the engine via getPlaybackTime() for Transport-synced positioning.
 * Uses requestAnimationFrame for smooth 60fps animation without React re-renders.
 */
export const AnimatedPlayhead: React.FC<AnimatedPlayheadProps> = ({
  color = '#ff0000',
  controlsOffset = 0,
}) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { isPlaying, currentTimeRef, getPlaybackTime } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate, progressBarWidth } = usePlaylistData();

  useEffect(() => {
    const updatePosition = () => {
      if (playheadRef.current) {
        const time = isPlaying ? getPlaybackTime() : (currentTimeRef.current ?? 0);
        const position = (time * sampleRate) / samplesPerPixel + controlsOffset;
        playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
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
  }, [isPlaying, sampleRate, samplesPerPixel, controlsOffset, currentTimeRef, getPlaybackTime]);

  // Also update position when not playing (for seeks, stops, etc.)
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      const time = currentTimeRef.current ?? 0;
      const position = (time * sampleRate) / samplesPerPixel + controlsOffset;
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
    }
  });

  return <PlayheadLine ref={playheadRef} $color={color} $width={progressBarWidth} data-playhead />;
};
