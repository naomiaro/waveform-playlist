import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { getContext } from 'tone';
import { usePlaybackAnimation, usePlaylistData } from '../WaveformPlaylistContext';
import { useTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

const ProgressOverlay = styled.div<{ $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: ${(props) => props.$color};
  pointer-events: none;
  z-index: 50;
  will-change: width;
`;

interface AnimatedProgressProps {
  controlsOffset?: number;
}

/**
 * Animated progress overlay that updates via direct DOM manipulation.
 * Shows the "played" portion of the waveform with a colored overlay.
 * Calculates time directly from audio context for perfect synchronization.
 * Uses requestAnimationFrame for smooth 60fps animation without React re-renders.
 */
export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  controlsOffset = 0,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const theme = useTheme() as WaveformPlaylistTheme;

  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate } = usePlaylistData();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';

  useEffect(() => {
    const updateProgress = () => {
      if (progressRef.current) {
        // Calculate time directly from audio context for perfect sync
        let time: number;
        if (isPlaying) {
          const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
          time = (audioStartPositionRef.current ?? 0) + elapsed;
        } else {
          time = currentTimeRef.current ?? 0;
        }
        const width = (time * sampleRate) / samplesPerPixel + controlsOffset;
        progressRef.current.style.width = `${width}px`;
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // When stopped, update once to show final position
      updateProgress();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, sampleRate, samplesPerPixel, controlsOffset, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]);

  // Also update when not playing (for seeks, stops, etc.)
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      const time = currentTimeRef.current ?? 0;
      const width = (time * sampleRate) / samplesPerPixel + controlsOffset;
      progressRef.current.style.width = `${width}px`;
    }
  });

  return <ProgressOverlay ref={progressRef} $color={progressColor} />;
};
