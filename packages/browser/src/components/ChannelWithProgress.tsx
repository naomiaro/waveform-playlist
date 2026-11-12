import React, { useId, useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  clipPixelWidth as computeClipPixelWidth,
  type MidiNoteData,
} from '@waveform-playlist/core';
import {
  SmartChannel,
  type SmartChannelProps,
  useTheme,
  usePlaylistInfo,
  type WaveformPlaylistTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import {
  useCurrentTime,
  usePlaylistView,
  usePlaylistZoom,
  usePlaybackRefs,
  useIsPlaying,
} from '../WaveformPlaylistContext';

const ChannelWrapper = styled.div`
  position: relative;
`;

interface BackgroundProps {
  readonly $color: string;
  readonly $height: number;
  readonly $top: number;
  readonly $width: number;
}

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
  /* Force GPU compositing layer to prevent gradient flickering during scroll */
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
    height: `${props.$height}px`,
    width: `${props.$width}px`,
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

export interface ChannelWithProgressProps extends SmartChannelProps {
  /** Start sample of the clip containing this channel (for progress calculation) */
  clipStartSample: number;
  /** Duration in samples of the clip */
  clipDurationSamples: number;
  /** MIDI note data for piano-roll rendering */
  midiNotes?: MidiNoteData[];
  /** Sample rate of the clip (for MIDI note positioning) */
  clipSampleRate?: number;
  /** Clip offset in seconds (for MIDI note positioning) */
  clipOffsetSeconds?: number;
}

/**
 * SmartChannel wrapper that adds an animated progress overlay.
 * The progress overlay shows the "played" portion of the waveform.
 * Updates via the shared animation frame registry — no own rAF loop.
 */
interface ClipProgressProps {
  clipStartSample: number;
  clipDurationSamples: number;
  color: string;
  height: number;
  top: number;
}

/** Fraction of the clip that lies before `time`, 0 to 1. */
function playedRatio(
  time: number,
  sampleRate: number,
  clipStartSample: number,
  clipDurationSamples: number
): number {
  const currentSample = time * sampleRate;
  if (currentSample <= clipStartSample) return 0;
  if (currentSample >= clipStartSample + clipDurationSamples) return 1;
  return (currentSample - clipStartSample) / clipDurationSamples;
}

/**
 * The played-portion overlay of one channel. It is the only part of a channel
 * that follows the cursor, so it alone subscribes to the animation and data
 * contexts (#693): a seek, or a selection whose start moves, re-renders these
 * small overlays and not the channels (and their canvases' React trees) around
 * them.
 */
const ClipProgress: React.FC<ClipProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  color,
  height,
  top,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const callbackId = useId();
  const { currentTimeRef, visualTimeRef, registerFrameCallback, unregisterFrameCallback } =
    usePlaybackRefs();
  const { isPlaying } = useIsPlaying();
  // Subscribed for the re-render only: the effect below reads the refs.
  useCurrentTime();
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();

  // Use shared helper to compute clip pixel width (must match Clip.tsx sizing)
  // peaksData.length may be shorter than the clip when audio is shorter than configured duration
  const clipPixelWidth = computeClipPixelWidth(
    clipStartSample,
    clipDurationSamples,
    samplesPerPixel
  );

  // Register per-frame callback during playback — no own rAF loop
  useEffect(() => {
    if (isPlaying) {
      registerFrameCallback(callbackId, ({ visualTime, sampleRate: sr }) => {
        if (progressRef.current) {
          const ratio = playedRatio(visualTime, sr, clipStartSample, clipDurationSamples);
          // scaleX is composite-only — no layout reflow, GPU-accelerated
          progressRef.current.style.transform = `scaleX(${ratio})`;
        }
      });
    }
    return () => unregisterFrameCallback(callbackId);
  }, [
    isPlaying,
    clipStartSample,
    clipDurationSamples,
    callbackId,
    registerFrameCallback,
    unregisterFrameCallback,
  ]);

  // Also update when not playing (for seeks, stops, etc.). Reads visualTimeRef
  // so the static progress fill matches the playhead's audible position. No
  // dependency array on purpose: `useCurrentTime()` re-renders this component
  // whenever the resting position changes.
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      const currentTime = visualTimeRef.current ?? currentTimeRef.current ?? 0;
      const ratio = playedRatio(currentTime, sampleRate, clipStartSample, clipDurationSamples);
      progressRef.current.style.transform = `scaleX(${ratio})`;
    }
  });

  return (
    <ProgressOverlay
      ref={progressRef}
      $color={color}
      $height={height}
      $top={top}
      $width={clipPixelWidth}
    />
  );
};

export const ChannelWithProgress: React.FC<ChannelWithProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  midiNotes,
  clipSampleRate,
  clipOffsetSeconds,
  ...smartChannelProps
}) => {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { waveHeight } = usePlaylistInfo();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';

  // Get the draw mode from theme (defaults to 'inverted')
  const drawMode = theme?.waveformDrawMode || 'inverted';

  let backgroundColor;
  if (drawMode === 'inverted') {
    backgroundColor =
      smartChannelProps.isSelected && theme
        ? theme.selectedWaveFillColor
        : theme?.waveFillColor || 'white';
  } else {
    backgroundColor =
      smartChannelProps.isSelected && theme
        ? theme.selectedWaveOutlineColor
        : theme?.waveOutlineColor || 'grey';
  }

  // A clip with notes is a MIDI clip and is drawn as a piano roll; the render
  // mode applies to audio clips only (black background for a spectrogram).
  const isPianoRollMode = midiNotes != null;
  const isSpectrogramMode =
    !isPianoRollMode &&
    (smartChannelProps.renderMode === 'spectrogram' || smartChannelProps.renderMode === 'both');
  const isBothMode = !isPianoRollMode && smartChannelProps.renderMode === 'both';
  const backgroundCss = isSpectrogramMode
    ? '#000'
    : isPianoRollMode
      ? theme?.pianoRollBackgroundColor || '#1a1a2e'
      : waveformColorToCss(backgroundColor);

  // In "both" mode each half (spectrogram + waveform) is waveHeight/2 so the track
  // container stays the same height as a single-mode track.
  const halfHeight = Math.floor(waveHeight / 2);
  const effectiveHeight = waveHeight;
  const effectiveTop = isBothMode
    ? smartChannelProps.index * waveHeight
    : smartChannelProps.index * waveHeight;

  // In "both" mode, the waveform portion needs its own (non-black) background
  const waveformBackgroundCss = waveformColorToCss(backgroundColor);

  return (
    <ChannelWrapper>
      {/* Background layer - color depends on draw mode */}
      {isBothMode ? (
        <>
          {/* Spectrogram portion: black background */}
          <Background
            $color="#000"
            $height={halfHeight}
            $top={effectiveTop}
            $width={smartChannelProps.length}
          />
          {/* Waveform portion: themed background */}
          <Background
            $color={waveformBackgroundCss}
            $height={halfHeight}
            $top={effectiveTop + halfHeight}
            $width={smartChannelProps.length}
          />
        </>
      ) : (
        <Background
          $color={backgroundCss}
          $height={effectiveHeight}
          $top={effectiveTop}
          $width={smartChannelProps.length}
        />
      )}
      {/* Progress overlay - shows played portion with progress color (skip for piano-roll) */}
      {!isPianoRollMode && (
        <ClipProgress
          clipStartSample={clipStartSample}
          clipDurationSamples={clipDurationSamples}
          color={progressColor}
          height={effectiveHeight}
          top={effectiveTop}
        />
      )}
      {/* Waveform canvas with transparent background */}
      <ChannelContainer>
        <SmartChannel
          {...smartChannelProps}
          transparentBackground
          midiNotes={midiNotes}
          sampleRate={clipSampleRate}
          clipOffsetSeconds={clipOffsetSeconds}
        />
      </ChannelContainer>
    </ChannelWrapper>
  );
};
