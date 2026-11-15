/**
 * Mobile-optimized Multi-Clip Example
 *
 * Demonstrates touch-friendly clip dragging and trimming:
 * - Touch delay (250ms) to distinguish drag from scroll gestures
 * - Larger touch targets (24px) for clip boundaries
 * - Simplified controls optimized for mobile screens
 * - Fewer tracks for better mobile performance
 *
 * Usage tip: Touch and hold a clip header to drag it.
 * Touch and hold a clip edge to trim it.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import type WaveformData from 'waveform-data';
import { createTrack, type ArrangementTrack, type LoadingClip } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  loadWaveformData,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformClipHeaders,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { SourceLoadError } from './SourceLoadError';
import { LoadingBadge } from './LoadingBadge';

const Container = styled.div`
  /* Prevent accidental text selection while dragging on mobile */
  user-select: none;
  -webkit-user-select: none;

  /* Prevent pull-to-refresh on mobile while interacting with playlist */
  overscroll-behavior: contain;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
  padding: 8px;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border-radius: 8px;

  /* Make buttons larger on mobile */
  @media (max-width: 768px) {
    button {
      min-width: 44px;
      min-height: 44px;
      padding: 8px 12px;
    }
  }
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Instructions = styled.div`
  /* The positioning parent of the loading badge in its top-right corner */
  position: relative;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dadde1);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ifm-font-color-base);

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--ifm-color-primary);
  }

  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  li strong {
    display: inline;
    margin-bottom: 0;
  }
`;

// Simplified audio files for mobile - fewer tracks (with BBC peaks)
const audioFiles = [
  {
    id: 'kick',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.dat',
  },
  {
    id: 'bass',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.dat',
  },
  {
    id: 'synth',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat',
  },
];

// Simplified track configuration - 3 tracks for mobile
const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 4, duration: 12, offset: 2 },
    ],
  },
  {
    name: 'Synth',
    clips: [
      { fileId: 'synth', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'synth', startTime: 10, duration: 8, offset: 6 },
    ],
  },
];

const fileSrc = (fileId: string): string => {
  const file = audioFiles.find((f) => f.id === fileId);
  if (!file) throw new Error(`Audio file not found for ID: ${fileId}`);
  return file.src;
};

// Build tracks from config once the peaks are known. Each clip is a loading
// clip in seconds that names its audio file and carries the file's peaks (when
// they loaded), so it is drawn at once; the arrangement makes it a playable
// clip when the file has decoded.
const buildTracks = (peaks: ReadonlyMap<string, WaveformData>): ArrangementTrack[] =>
  trackConfigs.map((trackConfig) => {
    const clips: LoadingClip[] = trackConfig.clips.map((clipConfig, index) => {
      const waveformData = peaks.get(clipConfig.fileId);
      return {
        id: `${clipConfig.fileId}-${index}`,
        src: fileSrc(clipConfig.fileId),
        start: clipConfig.startTime,
        duration: clipConfig.duration,
        offset: clipConfig.offset,
        name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
        ...(waveformData ? { waveformData } : {}),
      };
    });

    return {
      ...createTrack({
        name: trackConfig.name,
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      }),
      clips,
    };
  });

/** The peaks of every file that has them; a file whose peaks fail is drawn from its audio. */
async function loadAllPeaks(): Promise<Map<string, WaveformData>> {
  const results = await Promise.all(
    audioFiles.map(async (file) => {
      try {
        return [file.id, await loadWaveformData(file.peaksSrc)] as const;
      } catch (err) {
        console.error(`Failed to load peaks for ${file.id}:`, err);
        return null;
      }
    })
  );
  return new Map(
    results.filter((result): result is readonly [string, WaveformData] => result !== null)
  );
}

export function MobileMultiClipExample() {
  const { theme } = useDocusaurusTheme();
  // Starts empty: the tracks are added once every peaks file has been fetched,
  // and the playlist is shown from then on
  const arrangement = useCreateArrangement();
  const [peaksSettled, setPeaksSettled] = useState(false);
  const sources = useArrangementSources(arrangement);
  const loadedCount = sources.sources.size - sources.pendingCount - sources.failedCount;
  const loading = !peaksSettled || sources.isLoading;

  // Fetch the peaks first (small), then declare the tracks: the audio loads
  // in the background while the waveforms are drawn from the peaks
  useEffect(() => {
    let cancelled = false;
    loadAllPeaks().then((peaks) => {
      if (cancelled) return;
      // Tracks already there (an effect run again by Fast Refresh) are not added twice
      if (arrangement.getTracks().length === 0) {
        buildTracks(peaks).forEach((track) => arrangement.addTrack(track));
        // The first load is not an undo step
        arrangement.clearHistory();
      }
      setPeaksSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [arrangement]);

  return (
    <Container>
      <Instructions>
        <strong>Touch Controls</strong>
        {/* The page's one loading text, mounted from the first render: the
            peaks load before the editor exists, then the audio */}
        <LoadingBadge active={loading} placement="box-corner">
          (Loading: {loadedCount}/{audioFiles.length} files)
        </LoadingBadge>
        <ul>
          <li><strong>Scroll:</strong> Swipe left/right on the waveform area</li>
          <li><strong>Move clip:</strong> Touch and hold the clip header (250ms), then drag</li>
          <li><strong>Trim clip:</strong> Touch and hold a clip edge, then drag</li>
          <li><strong>Seek:</strong> Tap on the waveform to set playhead position</li>
        </ul>
      </Instructions>

      {peaksSettled && (
        <WaveformPlaylistProvider
          arrangement={arrangement}
          sampleRate={48000}
          samplesPerPixel={1024}
          mono
          automaticScroll={false}
          theme={theme}
        >
          <ClipInteractionProvider touchOptimized>
            <Controls>
              <ControlGroup>
                <PlayButton />
                <PauseButton />
                <StopButton />
              </ControlGroup>
              <ControlGroup>
                <ZoomInButton />
                <ZoomOutButton />
              </ControlGroup>
              <ControlGroup>
                <AudioPosition />
              </ControlGroup>
              <ControlGroup>
                <SourceLoadError arrangement={arrangement} />
              </ControlGroup>
            </Controls>

            {/* The provider's touchOptimized also widens the clip trim handles */}
            <WaveformViewOptions waveHeight={120} barWidth={4} barGap={0}>
              <WaveformRoot>
                <WaveformTimescale />
                <WaveformLoopRegion />
                <WaveformTrackControls width={100} />
                <WaveformTracks>
                  <WaveformClipHeaders />
                </WaveformTracks>
                <WaveformSelection />
                <WaveformPlayhead />
              </WaveformRoot>
            </WaveformViewOptions>
          </ClipInteractionProvider>
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
