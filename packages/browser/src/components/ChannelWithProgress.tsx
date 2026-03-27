import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  clipPixelWidth as computeClipPixelWidth,
  type MidiNoteData,
} from '@waveform-playlist/core';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import {
  SmartChannel,
  type SmartChannelProps,
  useTheme,
  usePlaylistInfo,
  type WaveformPlaylistTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import { usePlaybackAnimation, usePlaylistData } from '../WaveformPlaylistContext';

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
 * Uses requestAnimationFrame for smooth 60fps animation without React re-renders.
 */
export const ChannelWithProgress: React.FC<ChannelWithProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  midiNotes,
  clipSampleRate,
  clipOffsetSeconds,
  ...smartChannelProps
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const theme = useTheme() as WaveformPlaylistTheme;
  const { waveHeight } = usePlaylistInfo();

  const { isPlaying, currentTimeRef, getPlaybackTime } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate } = usePlaylistData();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';

  // Use shared helper to compute clip pixel width (must match Clip.tsx sizing)
  // peaksData.length may be shorter than the clip when audio is shorter than configured duration
  const clipPixelWidth = computeClipPixelWidth(
    clipStartSample,
    clipDurationSamples,
    samplesPerPixel
  );

  useEffect(() => {
    const updateProgress = () => {
      if (progressRef.current) {
        let currentTime = isPlaying ? getPlaybackTime() : (currentTimeRef.current ?? 0);
        // Subtract outputLatency during playback so progress matches speaker output
        if (isPlaying) {
          const ctx = getGlobalAudioContext();
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          currentTime = Math.max(0, currentTime - latency);
        }
        const currentSample = currentTime * sampleRate;
        const clipEndSample = clipStartSample + clipDurationSamples;

        let ratio = 0;
        if (currentSample <= clipStartSample) {
          ratio = 0;
        } else if (currentSample >= clipEndSample) {
          ratio = 1;
        } else {
          const playedSamples = currentSample - clipStartSample;
          ratio = playedSamples / clipDurationSamples;
        }

        // scaleX is composite-only — no layout reflow, GPU-accelerated
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      updateProgress();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    isPlaying,
    sampleRate,
    clipStartSample,
    clipDurationSamples,
    clipPixelWidth,
    currentTimeRef,
    getPlaybackTime,
  ]);

  // Also update when not playing (for seeks, stops, etc.)
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      const currentTime = currentTimeRef.current ?? 0;
      const currentSample = currentTime * sampleRate;
      const clipEndSample = clipStartSample + clipDurationSamples;

      let ratio = 0;
      if (currentSample <= clipStartSample) {
        ratio = 0;
      } else if (currentSample >= clipEndSample) {
        ratio = 1;
      } else {
        const playedSamples = currentSample - clipStartSample;
        ratio = playedSamples / clipDurationSamples;
      }

      progressRef.current.style.transform = `scaleX(${ratio})`;
    }
  });

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

  // Use black background for spectrogram mode, themed background for piano-roll
  const isSpectrogramMode =
    smartChannelProps.renderMode === 'spectrogram' || smartChannelProps.renderMode === 'both';
  const isPianoRollMode = smartChannelProps.renderMode === 'piano-roll';
  const isBothMode = smartChannelProps.renderMode === 'both';
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
        <ProgressOverlay
          ref={progressRef}
          $color={progressColor}
          $height={effectiveHeight}
          $top={effectiveTop}
          $width={clipPixelWidth}
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
