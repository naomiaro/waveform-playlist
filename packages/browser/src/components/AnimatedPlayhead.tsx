import React, { useRef, useEffect, useId } from 'react';
import styled from 'styled-components';
import { usePlaylistInfo } from '@waveform-playlist/ui-components';
import {
  useCurrentTime,
  usePlaylistView,
  usePlaylistZoom,
  usePlaybackRefs,
  useIsPlaying,
} from '../contexts/playlistContexts';

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
 * The default playhead, under either provider. During playback the provider's
 * animation loop moves it (a registered frame callback, no loop of its own);
 * at rest it is placed after each render.
 */
export const AnimatedPlayhead: React.FC<AnimatedPlayheadProps> = ({ color = '#ff0000' }) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  // Per instance: two visualizations under one provider each have a playhead,
  // and the registry keeps one callback per id.
  const frameCallbackId = useId();

  const { currentTimeRef, visualTimeRef, registerFrameCallback, unregisterFrameCallback } =
    usePlaybackRefs();
  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only: the resting-position effect below
  // reads the refs.
  useCurrentTime();
  const { sampleRate } = usePlaylistView();
  // The view option, published by the root (#689).
  const { progressBarWidth } = usePlaylistInfo();
  const { samplesPerPixel } = usePlaylistZoom();

  // Register per-frame callback during playback
  useEffect(() => {
    if (isPlaying) {
      registerFrameCallback(
        frameCallbackId,
        ({ visualTime, sampleRate: sr, samplesPerPixel: spp }) => {
          if (playheadRef.current) {
            const px = (visualTime * sr) / spp;
            playheadRef.current.style.transform = `translate3d(${px}px, 0, 0)`;
          }
        }
      );
    }
    return () => unregisterFrameCallback(frameCallbackId);
  }, [isPlaying, frameCallbackId, registerFrameCallback, unregisterFrameCallback]);

  // Update position when not playing (seeks, stops, etc.) — no rAF needed.
  // Reads visualTimeRef so the static playhead lines up with audible output
  // (the pause/seek paths sync visualTimeRef when they update currentTimeRef).
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      const time = visualTimeRef.current ?? currentTimeRef.current ?? 0;
      const position = (time * sampleRate) / samplesPerPixel;
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
    }
  });

  return <PlayheadLine ref={playheadRef} $color={color} $width={progressBarWidth} data-playhead />;
};
