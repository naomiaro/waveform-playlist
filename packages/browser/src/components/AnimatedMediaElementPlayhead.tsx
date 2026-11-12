import React, { useRef, useEffect, useId } from 'react';
import styled from 'styled-components';
import {
  useIsPlaying,
  useCurrentTime,
  usePlaybackRefs,
  usePlaylistView,
  usePlaylistZoom,
} from '../contexts/playlistContexts';

const PlayheadLine = styled.div<{ $color: string; $width: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${(props) => props.$width}px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 100;
  pointer-events: none;
  will-change: transform;
`;

interface AnimatedMediaElementPlayheadProps {
  color?: string;
}

/**
 * Animated playhead for MediaElementPlaylistProvider. During playback the
 * provider's animation loop moves it (a registered frame callback, no loop of
 * its own); at rest it is placed after each render.
 */
export const AnimatedMediaElementPlayhead: React.FC<AnimatedMediaElementPlayheadProps> = ({
  color = '#ff0000',
}) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  // Per instance: two playlists under one provider each have a playhead.
  const frameCallbackId = useId();

  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only: the resting-position effect below
  // reads the ref, and must run again on a seek, a pause and a stop.
  useCurrentTime();
  const { sampleRate, progressBarWidth } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { visualTimeRef, registerFrameCallback, unregisterFrameCallback } = usePlaybackRefs();

  useEffect(() => {
    if (isPlaying) {
      registerFrameCallback(
        frameCallbackId,
        ({ visualTime, sampleRate: sr, samplesPerPixel: spp }) => {
          if (playheadRef.current) {
            const position = (visualTime * sr) / spp;
            playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
          }
        }
      );
    }
    return () => unregisterFrameCallback(frameCallbackId);
  }, [isPlaying, frameCallbackId, registerFrameCallback, unregisterFrameCallback]);

  // Not playing: place it after every render (seeks, stops, a new track).
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      const position = ((visualTimeRef.current ?? 0) * sampleRate) / samplesPerPixel;
      playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
    }
  });

  return <PlayheadLine ref={playheadRef} $color={color} $width={progressBarWidth} data-playhead />;
};
