import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  KeyboardShortcuts,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  LoopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
} from '@waveform-playlist/browser';
import {
  BeatsAndBarsProvider,
  BaseSelectSmall,
  BaseInputSmall,
  InlineLabel,
  type SnapTo,
  type ScaleMode,
} from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  padding-right: 15px;
  border-right: 1px solid var(--ifm-color-emphasis-300, #ddd);

  &:last-child {
    border-right: none;
  }
`;

// Audio files - each file is loaded and decoded once
// All from Ubiquitous for consistency
const audioFiles = [
  { id: 'kick', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus' },
  { id: 'hihat', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/02_HiHat1.opus' },
  { id: 'claps', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/04_Claps.opus' },
  { id: 'shakers', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/07_Shakers.opus' },
  { id: 'bass', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus' },
  {
    id: 'synth1',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
  },
  { id: 'synth2', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus' },
];

// Track configuration with multiple clips demonstrating gaps and positioning
const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'HiHat',
    clips: [{ fileId: 'hihat', startTime: 4, duration: 12, offset: 4 }],
  },
  {
    name: 'Claps',
    clips: [
      { fileId: 'claps', startTime: 8, duration: 4, offset: 0 },
      { fileId: 'claps', startTime: 16, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Shakers',
    clips: [
      { fileId: 'shakers', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'shakers', startTime: 10, duration: 6, offset: 6 },
    ],
  },
  {
    name: 'Bass',
    clips: [{ fileId: 'bass', startTime: 0, duration: 20, offset: 0 }],
  },
  {
    name: 'Synth 1',
    clips: [
      { fileId: 'synth1', startTime: 4, duration: 8, offset: 2 },
      { fileId: 'synth1', startTime: 14, duration: 6, offset: 10 },
    ],
  },
  {
    name: 'Synth 2',
    clips: [
      { fileId: 'synth2', startTime: 0, duration: 4, offset: 0 },
      { fileId: 'synth2', startTime: 8, duration: 4, offset: 4 },
      { fileId: 'synth2', startTime: 16, duration: 4, offset: 8 },
    ],
  },
];

// Default sample rate for placeholder clips (before audio loads)
const DEFAULT_SAMPLE_RATE = 48000;

// Build tracks from config, optionally attaching audioBuffers from loaded files
const buildTracks = (fileBuffers: Map<string, AudioBuffer>): ClipTrack[] =>
  trackConfigs.map((trackConfig) => {
    const clips = trackConfig.clips.map((clipConfig) => {
      const audioBuffer = fileBuffers.get(clipConfig.fileId);

      return createClipFromSeconds({
        audioBuffer,
        sampleRate: audioBuffer?.sampleRate ?? DEFAULT_SAMPLE_RATE,
        sourceDuration: audioBuffer?.duration ?? clipConfig.duration + clipConfig.offset,
        startTime: clipConfig.startTime,
        duration: clipConfig.duration,
        offset: clipConfig.offset,
        name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
      });
    });

    return createTrack({
      name: trackConfig.name,
      clips,
      muted: false,
      soloed: false,
      volume: 1,
      pan: 0,
    });
  });

export function BeatsAndBarsExample() {
  const { theme } = useDocusaurusTheme();

  const [scaleMode, setScaleMode] = useState<ScaleMode>('beats');
  const [bpm, setBpm] = useState(126);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [snapTo, setSnapTo] = useState<SnapTo>('beat');
  const [temporalSnap, setTemporalSnap] = useState(true);

  // Load audio files in parallel — each file updates loadedFiles independently
  const [loadedFiles, setLoadedFiles] = useState<Map<string, AudioBuffer>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    const audioContext = getGlobalAudioContext();

    audioFiles.forEach(async (file) => {
      try {
        const response = await fetch(file.src, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (!cancelled) {
          setLoadedFiles((prev) => {
            const next = new Map(prev);
            next.set(file.id, audioBuffer);
            return next;
          });
          setLoadedCount((prev) => prev + 1);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            `[waveform-playlist] Failed to load ${file.id}: ${err instanceof Error ? err.message : String(err)}`
          );
          setLoadError(err instanceof Error ? err.message : `Failed to load ${file.id}`);
          // Count failed loads so loading eventually completes
          setLoadedCount((prev) => prev + 1);
        }
      }
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, []);

  const loading = loadedCount < audioFiles.length;

  // Build tracks from config — placeholder clips render immediately,
  // audioBuffers are attached as they load (peaks fill in progressively).
  const tracks = React.useMemo(() => buildTracks(loadedFiles), [loadedFiles]);
  const [tracksState, setTracks] = useState<ClipTrack[]>(tracks);

  // Sync derived tracks into state synchronously during render.
  // useEffect sync causes a 1-render lag — if loading flips to false in a
  // separate batch, the provider sees stale tracksState and rebuilds twice.
  const prevTracksRef = useRef(tracks);
  if (tracks !== prevTracksRef.current) {
    prevTracksRef.current = tracks;
    setTracks(tracks);
  }

  const snap = scaleMode === 'beats' ? snapTo !== 'off' : temporalSnap;

  if (loadError) {
    return <div style={{ padding: '2rem', color: 'red' }}>Error loading audio: {loadError}</div>;
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracksState}
      onTracksChange={setTracks}
      samplesPerPixel={1024}
      mono
      waveHeight={100}
      automaticScroll
      controls={{ show: true, width: 200 }}
      theme={theme}
      timescale
      barWidth={4}
      barGap={0}
      deferEngineRebuild={loading}
      indefinitePlayback
    >
      <BeatsAndBarsProvider bpm={bpm} timeSignature={timeSignature} snapTo={snapTo} scaleMode={scaleMode}>
        <ClipInteractionProvider snap={snap}>
          <KeyboardShortcuts playback clipSplitting undo />
          <Controls>
            <ControlGroup>
              <PlayButton />
              <PauseButton />
              <StopButton />
              <LoopButton />
              {loading && (
                <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>
                  Loading: {loadedCount}/{audioFiles.length}
                </span>
              )}
            </ControlGroup>
            <ControlGroup>
              <ZoomInButton />
              <ZoomOutButton />
            </ControlGroup>
            <ControlGroup>
              <AudioPosition />
            </ControlGroup>
            <ControlGroup>
              <AutomaticScrollCheckbox />
            </ControlGroup>
            <ControlGroup>
              <MasterVolumeControl />
            </ControlGroup>
          </Controls>
          <Controls>
            <ControlGroup>
              <InlineLabel>
                Scale{' '}
                <BaseSelectSmall
                  value={scaleMode}
                  onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
                >
                  <option value="beats">Beats &amp; Bars</option>
                  <option value="temporal">Temporal</option>
                </BaseSelectSmall>
              </InlineLabel>
            </ControlGroup>
            {scaleMode === 'beats' ? (
              <>
                <ControlGroup>
                  <InlineLabel>
                    BPM{' '}
                    <BaseInputSmall
                      type="number"
                      min={20}
                      max={300}
                      value={bpm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 20 && val <= 300) setBpm(val);
                      }}
                      style={{ width: 60 }}
                    />
                  </InlineLabel>
                </ControlGroup>
                <ControlGroup>
                  <InlineLabel>
                    Time Sig{' '}
                    <BaseSelectSmall
                      value={`${timeSignature[0]}/${timeSignature[1]}`}
                      onChange={(e) => {
                        const [num, den] = e.target.value.split('/').map(Number);
                        setTimeSignature([num, den]);
                      }}
                    >
                      <option value="4/4">4/4</option>
                      <option value="3/4">3/4</option>
                      <option value="6/8">6/8</option>
                      <option value="2/2">2/2</option>
                      <option value="5/4">5/4</option>
                      <option value="7/8">7/8</option>
                    </BaseSelectSmall>
                  </InlineLabel>
                </ControlGroup>
                <ControlGroup>
                  <InlineLabel>
                    Snap{' '}
                    <BaseSelectSmall
                      value={snapTo}
                      onChange={(e) => setSnapTo(e.target.value as SnapTo)}
                    >
                      <option value="bar">Bar</option>
                      <option value="beat">Beat</option>
                      <option value="off">Off</option>
                    </BaseSelectSmall>
                  </InlineLabel>
                </ControlGroup>
              </>
            ) : (
              <ControlGroup>
                <InlineLabel>
                  Snap{' '}
                  <BaseSelectSmall
                    value={temporalSnap ? 'on' : 'off'}
                    onChange={(e) => setTemporalSnap(e.target.value === 'on')}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </BaseSelectSmall>
                </InlineLabel>
              </ControlGroup>
            )}
          </Controls>

          <Waveform showClipHeaders />
        </ClipInteractionProvider>
      </BeatsAndBarsProvider>
    </WaveformPlaylistProvider>
  );
}
