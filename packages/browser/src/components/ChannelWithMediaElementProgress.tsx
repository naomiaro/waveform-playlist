import React, { useCallback, useRef, useEffect, useId } from 'react';
import styled from 'styled-components';
import {
  SmartChannel,
  type SmartChannelProps,
  useTheme,
  usePlaylistInfo,
  type WaveformPlaylistTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import {
  useIsPlaying,
  useCurrentTime,
  usePlaybackRefs,
  usePlaylistView,
  usePlaylistZoom,
} from '../contexts/playlistContexts';

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

interface MediaElementProgressProps {
  clipStartSample: number;
  clipDurationSamples: number;
  channelWidth: number;
  top: number;
  height: number;
  color: string;
}

/**
 * The progress overlay of one channel. The only part of the channel that
 * follows playback and the resting cursor (#688): a seek, a stop or a
 * leftward selection drag renders this and not the waveform beside it.
 */
const MediaElementProgress: React.FC<MediaElementProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  channelWidth,
  top,
  height,
  color,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const frameCallbackId = useId();
  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only: the effect below reads the ref.
  useCurrentTime();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { visualTimeRef, registerFrameCallback, unregisterFrameCallback } = usePlaybackRefs();

  // Played fraction of the channel, 0..1, at a time in seconds. The overlay is
  // as wide as the channel and scaled horizontally, so a frame changes only
  // its transform.
  const computeRatio = useCallback(
    (time: number) => {
      const currentSample = time * sampleRate;
      if (channelWidth <= 0 || currentSample <= clipStartSample) return 0;
      if (currentSample >= clipStartSample + clipDurationSamples) return 1;
      const playedPixels = (currentSample - clipStartSample) / samplesPerPixel;
      return Math.min(1, playedPixels / channelWidth);
    },
    [sampleRate, samplesPerPixel, clipStartSample, clipDurationSamples, channelWidth]
  );

  // While playing, the provider's animation loop draws the progress: a
  // registered frame callback, no loop of its own.
  useEffect(() => {
    if (isPlaying) {
      registerFrameCallback(frameCallbackId, ({ visualTime }) => {
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${computeRatio(visualTime)})`;
        }
      });
    }
    return () => unregisterFrameCallback(frameCallbackId);
  }, [isPlaying, frameCallbackId, computeRatio, registerFrameCallback, unregisterFrameCallback]);

  // When not playing, update after every render (seeks, stops, zoom changes).
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      progressRef.current.style.transform = `scaleX(${computeRatio(visualTimeRef.current ?? 0)})`;
    }
  });

  return (
    <ProgressOverlay
      ref={progressRef}
      $color={color}
      $height={height}
      $top={top}
      $width={channelWidth}
    />
  );
};

/**
 * SmartChannel wrapper for MediaElementPlaylistProvider with animated progress overlay.
 * The channel itself reads no playback state; its `MediaElementProgress` child does.
 */
export const ChannelWithMediaElementProgress: React.FC<ChannelWithMediaElementProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  ...smartChannelProps
}) => {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { waveHeight } = usePlaylistInfo();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';
  const channelWidth = smartChannelProps.length;

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
  const top = smartChannelProps.index * waveHeight;

  return (
    <ChannelWrapper>
      <Background $color={backgroundCss} $height={waveHeight} $top={top} $width={channelWidth} />
      <MediaElementProgress
        clipStartSample={clipStartSample}
        clipDurationSamples={clipDurationSamples}
        channelWidth={channelWidth}
        top={top}
        height={waveHeight}
        color={progressColor}
      />
      <ChannelContainer>
        <SmartChannel {...smartChannelProps} isSelected={true} transparentBackground />
      </ChannelContainer>
    </ChannelWrapper>
  );
};
