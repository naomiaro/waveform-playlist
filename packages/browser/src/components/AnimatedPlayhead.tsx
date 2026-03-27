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
}

/**
 * Animated playhead that updates position via the shared animation frame registry.
 * No own rAF loop — the WaveformPlaylistContext animation loop drives all visual updates.
 */
export const AnimatedPlayhead: React.FC<AnimatedPlayheadProps> = ({ color = '#ff0000' }) => {
  const playheadRef = useRef<HTMLDivElement>(null);

  const { isPlaying, currentTimeRef, registerFrameCallback, unregisterFrameCallback } =
    usePlaybackAnimation();
  const { samplesPerPixel, sampleRate, progressBarWidth } = usePlaylistData();

  // Register per-frame callback during playback
  useEffect(() => {
    const id = 'playhead';
    if (isPlaying) {
      registerFrameCallback(id, ({ visualTime, sampleRate: sr, samplesPerPixel: spp }) => {
        if (playheadRef.current) {
          const px = (visualTime * sr) / spp;
          playheadRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
        }
      });
    }
    return () => unregisterFrameCallback(id);
  }, [isPlaying, registerFrameCallback, unregisterFrameCallback]);

  // Update position when not playing (seeks, stops, etc.) — no rAF needed
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      const time = currentTimeRef.current ?? 0;
      const position = (time * sampleRate) / samplesPerPixel;
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
    }
  });

  return <PlayheadLine ref={playheadRef} $color={color} $width={progressBarWidth} data-playhead />;
};
