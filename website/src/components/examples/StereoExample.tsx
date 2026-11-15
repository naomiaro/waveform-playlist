/**
 * Stereo Example
 *
 * Demonstrates stereo waveform rendering with separate L/R channels:
 * - Load stereo audio tracks
 * - Display separate left and right waveform channels
 * - Play/pause/stop controls
 */

import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
import type { AudioTrackOptions } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
`;

// Stereo tracks - these are stereo files from the Ubiquitous album
const audioConfigs: AudioTrackOptions[] = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
    name: 'Synth 1 (Stereo)',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus',
    name: 'Synth 2 (Stereo)',
  },
];

export function StereoExample() {
  const { theme } = useDocusaurusTheme();

  // The arrangement owns the tracks and loads their audio - each row shows a
  // placeholder until its file has decoded
  const arrangement = useCreateArrangement(() => audioConfigs.map((config) => audioTrack(config)));
  const sources = useArrangementSources(arrangement);
  const totalCount = sources.sources.size;
  const loadedCount = totalCount - sources.pendingCount - sources.failedCount;
  const failed = Array.from(sources.sources).find(([, state]) => state.status === 'failed');

  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      sampleRate={48000}
      samplesPerPixel={1024}
      theme={theme}
    >
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
        {sources.isLoading && <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {loadedCount}/{totalCount}</span>}
        {failed && (
          <span style={{ fontSize: '0.875rem', color: 'red' }}>
            Error loading audio: {failed[1].error?.message}{' '}
            <button type="button" onClick={() => arrangement.retry(failed[0])}>
              Retry
            </button>
          </span>
        )}
      </Controls>

      <WaveformViewOptions barWidth={2} barGap={0}>
        <WaveformRoot>
          <WaveformTrackControls />
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
