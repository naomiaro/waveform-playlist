import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { getContext } from 'tone';
import { SmartChannel, type SmartChannelProps, useTheme, usePlaylistInfo, type WaveformPlaylistTheme, waveformColorToCss } from '@waveform-playlist/ui-components';
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

const Background = styled.div<BackgroundProps>`
  position: absolute;
  top: ${(props) => props.$top}px;
  left: 0;
  width: ${(props) => props.$width}px;
  height: ${(props) => props.$height}px;
  background: ${(props) => props.$color};
  z-index: 0;
  /* Force GPU compositing layer to prevent gradient flickering during scroll */
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
`;

interface ProgressOverlayProps {
  readonly $color: string;
  readonly $height: number;
  readonly $top: number;
}

const ProgressOverlay = styled.div<ProgressOverlayProps>`
  position: absolute;
  top: ${(props) => props.$top}px;
  left: 0;
  height: ${(props) => props.$height}px;
  background: ${(props) => props.$color};
  pointer-events: none;
  z-index: 1;
  will-change: width;
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
}

/**
 * SmartChannel wrapper that adds an animated progress overlay.
 * The progress overlay shows the "played" portion of the waveform.
 * Uses requestAnimationFrame for smooth 60fps animation without React re-renders.
 */
export const ChannelWithProgress: React.FC<ChannelWithProgressProps> = ({
  clipStartSample,
  clipDurationSamples,
  ...smartChannelProps
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const theme = useTheme() as WaveformPlaylistTheme;
  const { waveHeight } = usePlaylistInfo();

  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate } = usePlaylistData();

  const progressColor = theme?.waveProgressColor || 'rgba(0, 0, 0, 0.1)';

  useEffect(() => {
    const updateProgress = () => {
      if (progressRef.current) {
        // Calculate current time from audio context
        let currentTime: number;
        if (isPlaying) {
          const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
          currentTime = (audioStartPositionRef.current ?? 0) + elapsed;
        } else {
          currentTime = currentTimeRef.current ?? 0;
        }

        // Convert current time to samples
        const currentSample = currentTime * sampleRate;

        // Calculate clip bounds in samples
        const clipEndSample = clipStartSample + clipDurationSamples;

        // Calculate how much of this clip has been played
        let progressWidth = 0;

        if (currentSample <= clipStartSample) {
          // Playhead is before this clip - no progress
          progressWidth = 0;
        } else if (currentSample >= clipEndSample) {
          // Playhead is past this clip - full progress
          progressWidth = smartChannelProps.length;
        } else {
          // Playhead is within this clip - partial progress
          const playedSamples = currentSample - clipStartSample;
          progressWidth = Math.floor(playedSamples / samplesPerPixel);
        }

        progressRef.current.style.width = `${progressWidth}px`;
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
  }, [isPlaying, sampleRate, samplesPerPixel, clipStartSample, clipDurationSamples, smartChannelProps.length, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]);

  // Also update when not playing (for seeks, stops, etc.)
  useEffect(() => {
    if (!isPlaying && progressRef.current) {
      const currentTime = currentTimeRef.current ?? 0;
      const currentSample = currentTime * sampleRate;
      const clipEndSample = clipStartSample + clipDurationSamples;

      let progressWidth = 0;
      if (currentSample <= clipStartSample) {
        progressWidth = 0;
      } else if (currentSample >= clipEndSample) {
        progressWidth = smartChannelProps.length;
      } else {
        const playedSamples = currentSample - clipStartSample;
        progressWidth = Math.floor(playedSamples / samplesPerPixel);
      }

      progressRef.current.style.width = `${progressWidth}px`;
    }
  });

  // Get the draw mode from theme (defaults to 'inverted')
  const drawMode = theme?.waveformDrawMode || 'inverted';

  let backgroundColor;
  if (drawMode === 'inverted') {

    backgroundColor = smartChannelProps.isSelected && theme
      ? theme.selectedWaveFillColor
      : theme?.waveFillColor || 'white';

  } else {
    backgroundColor = smartChannelProps.isSelected && theme
      ? theme.selectedWaveOutlineColor
      : theme?.waveOutlineColor || 'grey';
  }

  const backgroundCss = waveformColorToCss(backgroundColor);

  return (
    <ChannelWrapper>
      {/* Background layer - color depends on draw mode */}
      <Background
        $color={backgroundCss}
        $height={waveHeight}
        $top={smartChannelProps.index * waveHeight}
        $width={smartChannelProps.length}
      />
      {/* Progress overlay - shows played portion with progress color */}
      <ProgressOverlay
        ref={progressRef}
        $color={progressColor}
        $height={waveHeight}
        $top={smartChannelProps.index * waveHeight}
      />
      {/* Waveform canvas with transparent background */}
      <ChannelContainer>
        <SmartChannel {...smartChannelProps} transparentBackground />
      </ChannelContainer>
    </ChannelWrapper>
  );
};
