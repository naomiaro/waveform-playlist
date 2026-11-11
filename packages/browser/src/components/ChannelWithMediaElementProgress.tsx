import React, { useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  SmartChannel,
  type SmartChannelProps,
  useTheme,
  usePlaylistInfo,
  type WaveformPlaylistTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import { useMediaElementAnimation, useMediaElementData } from '../MediaElementPlaylistContext';

const ChannelWrapper = styled.div`
  position: relative;
`;

interface BackgroundProps {
  readonly $color: string;
  readonly $height: number;
  readonly $top: number;
  readonly $width: number;
}

// Geometry and colour go through .attrs() as inline styles: interpolated in the
// template they generate one CSS class per distinct value (every zoom step).
const Background = styled.div.attrs<BackgroundProps>((props) => ({
  style: {
    top: `${props.$top}px`,
    width: `${props.$width}px`,
    height: `${props.$height}px`,
    background: props.$color,
  },
}))<BackgroundProps>`
  position: absolute;
  left: 0;
  z-index: 0;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

interface ProgressOverlayProps {
  readonly $color: string;
  readonly $height: number;
  readonly $top: number;
  readonly $width: number;
}

const ProgressOverlay = styled.div.attrs<ProgressOverlayProps>((props) => ({
  style: {
    top: `${props.$top}px`,
    width: `${props.$width}px`,
    height: `${props.$height}px`,
    background: props.$color,
    transform: 'scaleX(0)',
  },
}))<ProgressOverlayProps>`
  position: absolute;
  left: 0;
  pointer-events: none;
  z-index: 1;
  transform-origin: left;
  /* scaleX changes are composite-only (GPU) — no layout reflow per frame */
  will-change: transform;
`;

const ChannelContainer = styled.div`
  position: relative;
  z-index: 2;
`;

export interface ChannelWithMediaElementProgressProps
  extends Omit<SmartChannelProps, 'isSelected'> {
  /** Start sample of the clip containing this channel (for progress calculation) */
  clipStartSample: number;
  /** Duration in samples of the clip */
  clipDurationSamples: number;
}

/**
 * SmartChannel wrapper for MediaElementPlaylistProvider with animated progress overlay.
 * Uses MediaElement context for time tracking instead of Tone.js audio context.
 */
export const ChannelWithMediaElementProgress: React.FC<ChannelWithMediaElementProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  ...smartChannelProps
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const theme = useTheme() as WaveformPlaylistTheme;
  const { waveHeight } = usePlaylistInfo();

  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { samplesPerPixel, sampleRate } = useMediaElementData();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';

  const channelWidth = smartChannelProps.length;

  // Played fraction of the channel, 0..1. The overlay is as wide as the channel
  // and scaled horizontally, so a frame changes only its transform.
  const computeRatio = useCallback(() => {
    const currentSample = (currentTimeRef.current ?? 0) * sampleRate;
    if (channelWidth <= 0 || currentSample <= clipStartSample) return 0;
    if (currentSample >= clipStartSample + clipDurationSamples) return 1;
    const playedPixels = (currentSample - clipStartSample) / samplesPerPixel;
    return Math.min(1, playedPixels / channelWidth);
  }, [
    currentTimeRef,
    sampleRate,
    samplesPerPixel,
    clipStartSample,
    clipDurationSamples,
    channelWidth,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    const updateProgress = () => {
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${computeRatio()})`;
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, computeRatio]);

  // When not playing, update after every render (seeks, stops, zoom changes).
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      progressRef.current.style.transform = `scaleX(${computeRatio()})`;
    }
  });

  // Get the draw mode from theme (defaults to 'inverted')
  const drawMode = theme?.waveformDrawMode || 'inverted';

  let backgroundColor;
  if (drawMode === 'inverted') {
    // For MediaElement, always treat as selected (single track)
    backgroundColor = theme?.selectedWaveFillColor || theme?.waveFillColor || 'white';
  } else {
    backgroundColor = theme?.selectedWaveOutlineColor || theme?.waveOutlineColor || 'grey';
  }

  const backgroundCss = waveformColorToCss(backgroundColor);

  return (
    <ChannelWrapper>
      <Background
        $color={backgroundCss}
        $height={waveHeight}
        $top={smartChannelProps.index * waveHeight}
        $width={channelWidth}
      />
      <ProgressOverlay
        ref={progressRef}
        $color={progressColor}
        $height={waveHeight}
        $top={smartChannelProps.index * waveHeight}
        $width={channelWidth}
      />
      <ChannelContainer>
        <SmartChannel {...smartChannelProps} isSelected={true} transparentBackground />
      </ChannelContainer>
    </ChannelWrapper>
  );
};
