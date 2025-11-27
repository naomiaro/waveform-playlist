import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { getContext } from 'tone';
import { usePlaybackAnimation, usePlaylistData } from '../WaveformPlaylistContext';

const PlayheadLine = styled.div<{ $color: string; $width: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${(props) => props.$width}px;
  background: ${(props) => props.$color};
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
 * Calculates time directly from audio context for perfect synchronization.
 * Uses requestAnimationFrame for smooth 60fps animation without React re-renders.
 */
export const AnimatedPlayhead: React.FC<AnimatedPlayheadProps> = ({
  color = '#ff0000',
  controlsOffset = 0,
}) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate, progressBarWidth } = usePlaylistData();

  useEffect(() => {
    const updatePosition = () => {
      if (playheadRef.current) {
        // Calculate time directly from audio context for perfect sync
        let time: number;
        if (isPlaying) {
          const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
          time = (audioStartPositionRef.current ?? 0) + elapsed;
        } else {
          time = currentTimeRef.current ?? 0;
        }
        const position = (time * sampleRate) / samplesPerPixel + controlsOffset;
        playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };

    if (isPlaying) {
      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    } else {
      // When stopped, update once to show final position
      updatePosition();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, sampleRate, samplesPerPixel, controlsOffset, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]);

  // Also update position when not playing (for seeks, stops, etc.)
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      const time = currentTimeRef.current ?? 0;
      const position = (time * sampleRate) / samplesPerPixel + controlsOffset;
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
    }
  });

  return <PlayheadLine ref={playheadRef} $color={color} $width={progressBarWidth} />;
};
